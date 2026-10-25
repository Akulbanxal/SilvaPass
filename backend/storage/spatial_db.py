"""
SQLite Persistence Layer for Plots, Spatial Indexing, and Ambiguous Review Queue.
"""
import sqlite3
import json
import uuid
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

from backend.geo.models import PlotStatus, ReviewStatus, MatchClassification, SimilarityEvidence, PlotRegistrationResult
from backend.geo.validator import validate_geojson_geometry
from backend.geo.matcher import compute_geometry_similarity
import shapely
from shapely import wkt


from contextlib import contextmanager


class SpatialStorage:
    def __init__(self, db_path: str = "./silvapass.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Plots table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS plots (
                    plot_id TEXT PRIMARY KEY,
                    canonical_fingerprint TEXT NOT NULL,
                    canonical_wkt TEXT NOT NULL,
                    raw_geojson TEXT NOT NULL,
                    geom_type TEXT NOT NULL,
                    geodesic_area_ha REAL NOT NULL,
                    vertex_count INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)

            # Spatial index table: maps plot_id to H3 cell indices for rapid candidate filtering
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS plot_spatial_index (
                    h3_cell TEXT NOT NULL,
                    plot_id TEXT NOT NULL,
                    PRIMARY KEY (h3_cell, plot_id),
                    FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_spatial_h3 ON plot_spatial_index (h3_cell)")

            # Spatial review queue table: holds ambiguous conflicts requiring human adjudication
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS spatial_reviews (
                    review_id TEXT PRIMARY KEY,
                    submitted_plot_id TEXT NOT NULL,
                    conflicting_plot_id TEXT NOT NULL,
                    iou REAL NOT NULL,
                    centroid_distance_m REAL NOT NULL,
                    evidence_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    operator_id TEXT,
                    justification TEXT,
                    created_at TEXT NOT NULL,
                    adjudicated_at TEXT,
                    FOREIGN KEY (submitted_plot_id) REFERENCES plots(plot_id),
                    FOREIGN KEY (conflicting_plot_id) REFERENCES plots(plot_id)
                )
            """)
            conn.commit()

    def get_candidate_plot_ids_by_h3(self, h3_cells: List[str]) -> List[str]:
        """Returns candidate plot IDs that share any of the provided H3 cells and are ACTIVE."""
        if not h3_cells:
            return []

        placeholders = ",".join(["?"] * len(h3_cells))
        query = f"""
            SELECT DISTINCT p.plot_id 
            FROM plot_spatial_index psi
            JOIN plots p ON psi.plot_id = p.plot_id
            WHERE psi.h3_cell IN ({placeholders}) AND p.status = 'ACTIVE'
        """
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, h3_cells)
            rows = cursor.fetchall()
            return [row["plot_id"] for row in rows]

    def get_plot(self, plot_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM plots WHERE plot_id = ?", (plot_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def get_plot_by_fingerprint(self, fingerprint: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM plots WHERE canonical_fingerprint = ?", (fingerprint,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def register_and_classify_plot(self, geojson_geom: Dict[str, Any], plot_id: Optional[str] = None) -> PlotRegistrationResult:
        """
        Validates geometry, queries spatial candidates, performs similarity checks,
        classifies plot, and persists state (either ACTIVE, PENDING_REVIEW, or FLAGGED_DUPLICATE).
        """
        validation = validate_geojson_geometry(geojson_geom)
        if not validation.is_valid:
            raise ValueError(f"Geometry validation failed: {validation.error_message}")

        if not plot_id:
            plot_id = f"plot-{uuid.uuid4()}"

        new_geom = wkt.loads(validation.canonical_wkt)

        # 1. Check exact fingerprint match in database
        existing_exact = self.get_plot_by_fingerprint(validation.canonical_fingerprint)
        if existing_exact:
            evidence = SimilarityEvidence(
                candidate_plot_id=existing_exact["plot_id"],
                iou=1.0,
                area_ratio=1.0,
                centroid_distance_m=0.0,
                hausdorff_distance_m=0.0,
                boundary_length_delta_m=0.0,
                shared_h3_res8_count=len(validation.h3_indices_res8),
                classification=MatchClassification.EXACT_MATCH,
                explanation="Identical canonical geometry fingerprint in database."
            )
            return PlotRegistrationResult(
                plot_id=plot_id,
                status=PlotStatus.FLAGGED_DUPLICATE,
                classification=MatchClassification.EXACT_MATCH,
                canonical_fingerprint=validation.canonical_fingerprint,
                geodesic_area_ha=validation.geodesic_area_ha,
                similarity_evidence=[evidence],
                message=f"Plot is an exact duplicate of registered plot {existing_exact['plot_id']}."
            )

        # 2. Retrieve candidates sharing H3 res8 cells
        candidate_ids = self.get_candidate_plot_ids_by_h3(validation.h3_indices_res8)
        
        worst_classification = MatchClassification.DISTINCT
        all_evidence: List[SimilarityEvidence] = []
        conflicting_plot_id: Optional[str] = None

        for cid in candidate_ids:
            cand = self.get_plot(cid)
            if not cand:
                continue

            cand_geom = wkt.loads(cand["canonical_wkt"])
            
            # Retrieve cand's H3 cells
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT h3_cell FROM plot_spatial_index WHERE plot_id = ?", (cid,))
                cand_h3 = [r["h3_cell"] for r in cursor.fetchall()]

            evidence = compute_geometry_similarity(
                candidate_plot_id=cid,
                geom_a=new_geom,
                geom_b=cand_geom,
                canonical_fp_a=validation.canonical_fingerprint,
                canonical_fp_b=cand["canonical_fingerprint"],
                h3_a=validation.h3_indices_res8,
                h3_b=cand_h3
            )

            all_evidence.append(evidence)

            # Determine dominant match status
            if evidence.classification == MatchClassification.EXACT_MATCH:
                worst_classification = MatchClassification.EXACT_MATCH
                conflicting_plot_id = cid
                break
            elif evidence.classification == MatchClassification.LIKELY_DUPLICATE:
                if worst_classification != MatchClassification.EXACT_MATCH:
                    worst_classification = MatchClassification.LIKELY_DUPLICATE
                    conflicting_plot_id = cid
            elif evidence.classification == MatchClassification.AMBIGUOUS:
                if worst_classification not in [MatchClassification.EXACT_MATCH, MatchClassification.LIKELY_DUPLICATE]:
                    worst_classification = MatchClassification.AMBIGUOUS
                    conflicting_plot_id = cid

        # Determine persistence status
        review_id = None
        now_iso = datetime.utcnow().isoformat() + "Z"

        if worst_classification in [MatchClassification.EXACT_MATCH, MatchClassification.LIKELY_DUPLICATE]:
            final_status = PlotStatus.FLAGGED_DUPLICATE
            message = f"Plot rejected: High-confidence duplicate of existing plot {conflicting_plot_id}."
        elif worst_classification == MatchClassification.AMBIGUOUS:
            final_status = PlotStatus.PENDING_REVIEW
            review_id = f"rev-{uuid.uuid4()}"
            message = f"Plot flagged for review: Ambiguous spatial overlap with plot {conflicting_plot_id}."
        else:
            final_status = PlotStatus.ACTIVE
            message = "Plot successfully validated and registered as an independent active parcel."

        # Persist plot record
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO plots (
                    plot_id, canonical_fingerprint, canonical_wkt, raw_geojson,
                    geom_type, geodesic_area_ha, vertex_count, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                plot_id, validation.canonical_fingerprint, validation.canonical_wkt,
                json.dumps(geojson_geom), validation.geom_type, validation.geodesic_area_ha,
                validation.vertex_count, final_status.value, now_iso
            ))

            # Persist spatial index
            for cell in validation.h3_indices_res8:
                cursor.execute("""
                    INSERT OR IGNORE INTO plot_spatial_index (h3_cell, plot_id) VALUES (?, ?)
                """, (cell, plot_id))

            # If ambiguous, persist review queue record
            if review_id and conflicting_plot_id:
                # Find matching evidence
                ev = next(e for e in all_evidence if e.candidate_plot_id == conflicting_plot_id)
                cursor.execute("""
                    INSERT INTO spatial_reviews (
                        review_id, submitted_plot_id, conflicting_plot_id, iou,
                        centroid_distance_m, evidence_json, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    review_id, plot_id, conflicting_plot_id, ev.iou,
                    ev.centroid_distance_m, ev.model_dump_json(),
                    ReviewStatus.PENDING.value, now_iso
                ))

            conn.commit()

        return PlotRegistrationResult(
            plot_id=plot_id,
            status=final_status,
            classification=worst_classification,
            canonical_fingerprint=validation.canonical_fingerprint,
            geodesic_area_ha=validation.geodesic_area_ha,
            review_id=review_id,
            similarity_evidence=all_evidence,
            message=message
        )

    def adjudicate_review(self, review_id: str, action: ReviewStatus, operator_id: str, justification: str) -> Dict[str, Any]:
        """
        Adjudicates an ambiguous plot review:
        - If CONFIRMED_DUPLICATE: Marks submitted plot as FLAGGED_DUPLICATE.
        - If APPROVED_SEPARATE_PARCEL: Upgrades submitted plot to ACTIVE status.
        Audits operator ID, timestamp, and justification.
        """
        now_iso = datetime.utcnow().isoformat() + "Z"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM spatial_reviews WHERE review_id = ?", (review_id,))
            review = cursor.fetchone()
            if not review:
                raise ValueError(f"Review record '{review_id}' not found.")

            if review["status"] != ReviewStatus.PENDING.value:
                raise ValueError(f"Review '{review_id}' has already been adjudicated.")

            submitted_plot_id = review["submitted_plot_id"]

            if action == ReviewStatus.CONFIRMED_DUPLICATE:
                new_plot_status = PlotStatus.FLAGGED_DUPLICATE.value
            elif action == ReviewStatus.APPROVED_SEPARATE_PARCEL:
                new_plot_status = PlotStatus.ACTIVE.value
            else:
                raise ValueError(f"Invalid adjudication action '{action}'.")

            # Update review record
            cursor.execute("""
                UPDATE spatial_reviews
                SET status = ?, operator_id = ?, justification = ?, adjudicated_at = ?
                WHERE review_id = ?
            """, (action.value, operator_id, justification, now_iso, review_id))

            # Update plot status
            cursor.execute("""
                UPDATE plots SET status = ? WHERE plot_id = ?
            """, (new_plot_status, submitted_plot_id))

            conn.commit()

            return {
                "review_id": review_id,
                "submitted_plot_id": submitted_plot_id,
                "adjudicated_action": action.value,
                "new_plot_status": new_plot_status,
                "operator_id": operator_id,
                "justification": justification,
                "adjudicated_at": now_iso
            }
