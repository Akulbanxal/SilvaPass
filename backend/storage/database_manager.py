"""
Comprehensive SQLite Database Manager for SilvaPass Backend.
Normalizes and manages:
- plots and spatial indexes
- spatial_reviews
- allowances
- shipment_documents
- claims and releases
- environmental_screenings
- audit_records
"""
import sqlite3
import json
import uuid
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

from backend.geo.models import PlotStatus, ReviewStatus, MatchClassification, SimilarityEvidence, PlotRegistrationResult
from backend.geo.validator import validate_geojson_geometry
from backend.geo.matcher import compute_geometry_similarity
from backend.schemas.api_models import ClaimOnChainStatus, DeforestationRisk, ProvenanceType
import shapely
from shapely import wkt


from contextlib import contextmanager


class DatabaseManager:
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

            # 1. Plots Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS plots (
                    plot_id TEXT PRIMARY KEY,
                    canonical_fingerprint TEXT NOT NULL,
                    canonical_wkt TEXT NOT NULL,
                    raw_geojson TEXT NOT NULL,
                    geom_type TEXT NOT NULL,
                    geodesic_area_ha REAL NOT NULL,
                    geodesic_perimeter_m REAL NOT NULL,
                    vertex_count INTEGER NOT NULL,
                    country_code TEXT NOT NULL,
                    crop_code TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)

            # 2. Spatial Index Table (H3 cells to plot_id)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS plot_spatial_index (
                    h3_cell TEXT NOT NULL,
                    plot_id TEXT NOT NULL,
                    PRIMARY KEY (h3_cell, plot_id),
                    FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_spatial_h3 ON plot_spatial_index (h3_cell)")

            # 3. Spatial Reviews Table (Ambiguous matches)
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

            # 4. Allowances Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS allowances (
                    allowance_id TEXT PRIMARY KEY,
                    plot_id TEXT NOT NULL,
                    season_id INTEGER NOT NULL,
                    crop_code TEXT NOT NULL,
                    approved_allowance_kg INTEGER NOT NULL,
                    claimed_kg INTEGER NOT NULL DEFAULT 0,
                    released_kg INTEGER NOT NULL DEFAULT 0,
                    evidence_document_hash TEXT NOT NULL,
                    status TEXT NOT NULL,
                    tx_hash TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (plot_id) REFERENCES plots(plot_id),
                    UNIQUE (plot_id, season_id)
                )
            """)

            # 5. Shipment Documents Table (AI extraction & confirmation)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shipment_documents (
                    document_id TEXT PRIMARY KEY,
                    file_name TEXT NOT NULL,
                    file_hash_sha256 TEXT NOT NULL,
                    raw_text TEXT NOT NULL,
                    extraction_source TEXT NOT NULL,
                    extracted_fields_json TEXT NOT NULL,
                    confirmed_fields_json TEXT,
                    status TEXT NOT NULL,
                    operator_id TEXT,
                    created_at TEXT NOT NULL,
                    confirmed_at TEXT
                )
            """)

            # 6. Claims Table (Shipment claims & reconciliation)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS claims (
                    claim_id TEXT PRIMARY KEY,
                    plot_id TEXT NOT NULL,
                    season_id INTEGER NOT NULL,
                    claimed_kg INTEGER NOT NULL,
                    document_id TEXT,
                    shipment_evidence_hash TEXT NOT NULL,
                    on_chain_status TEXT NOT NULL,
                    tx_hash TEXT,
                    block_number INTEGER,
                    is_released INTEGER NOT NULL DEFAULT 0,
                    release_reason TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (plot_id) REFERENCES plots(plot_id),
                    FOREIGN KEY (document_id) REFERENCES shipment_documents(document_id)
                )
            """)

            # 7. Environmental Screenings Table (FAO WHISP cache)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS environmental_screenings (
                    screening_id TEXT PRIMARY KEY,
                    plot_id TEXT NOT NULL,
                    service_name TEXT NOT NULL,
                    deforestation_risk TEXT NOT NULL,
                    cutoff_date TEXT NOT NULL,
                    indicators_json TEXT NOT NULL,
                    provenance TEXT NOT NULL,
                    source_digest TEXT NOT NULL,
                    is_cached INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (plot_id) REFERENCES plots(plot_id)
                )
            """)

            # 8. Audit Log Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    log_id TEXT PRIMARY KEY,
                    action TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    target_entity TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    details_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)

            conn.commit()

    # --- Plot Methods ---

    def get_plot(self, plot_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM plots WHERE plot_id = ?", (plot_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_plots(self, status: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute("SELECT * FROM plots WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", (status, limit, offset))
            else:
                cursor.execute("SELECT * FROM plots ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset))
            return [dict(r) for r in cursor.fetchall()]

    def get_plot_by_fingerprint(self, fingerprint: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM plots WHERE canonical_fingerprint = ?", (fingerprint,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_candidate_plot_ids_by_h3(self, h3_cells: List[str]) -> List[str]:
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
            return [row["plot_id"] for row in cursor.fetchall()]

    def register_and_classify_plot(
        self,
        geojson_geom: Dict[str, Any],
        plot_id: Optional[str] = None,
        country_code: str = "BR",
        crop_code: str = "SOY"
    ) -> PlotRegistrationResult:
        validation = validate_geojson_geometry(geojson_geom)
        if not validation.is_valid:
            raise ValueError(f"Geometry validation failed: {validation.error_message}")

        if not plot_id:
            plot_id = f"plot-{uuid.uuid4()}"

        new_geom = wkt.loads(validation.canonical_wkt)

        # 1. Exact fingerprint match check
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

        # 2. Query candidates sharing H3 cells
        candidate_ids = self.get_candidate_plot_ids_by_h3(validation.h3_indices_res8)
        worst_classification = MatchClassification.DISTINCT
        all_evidence: List[SimilarityEvidence] = []
        conflicting_plot_id: Optional[str] = None

        for cid in candidate_ids:
            cand = self.get_plot(cid)
            if not cand:
                continue

            cand_geom = wkt.loads(cand["canonical_wkt"])
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

        # Insert plot with atomic transaction
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO plots (
                    plot_id, canonical_fingerprint, canonical_wkt, raw_geojson,
                    geom_type, geodesic_area_ha, geodesic_perimeter_m, vertex_count,
                    country_code, crop_code, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                plot_id, validation.canonical_fingerprint, validation.canonical_wkt,
                json.dumps(geojson_geom), validation.geom_type, validation.geodesic_area_ha,
                validation.geodesic_perimeter_m, validation.vertex_count,
                country_code, crop_code, final_status.value, now_iso
            ))

            for cell in validation.h3_indices_res8:
                cursor.execute("INSERT OR IGNORE INTO plot_spatial_index (h3_cell, plot_id) VALUES (?, ?)", (cell, plot_id))

            if review_id and conflicting_plot_id:
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

            # Audit record
            cursor.execute("""
                INSERT INTO audit_logs (log_id, action, actor, target_entity, target_id, details_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()), "REGISTER_PLOT", "SYSTEM", "PLOT", plot_id,
                json.dumps({"status": final_status.value, "classification": worst_classification.value}),
                now_iso
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

    # --- Review Queue Methods ---

    def list_pending_reviews(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM spatial_reviews WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset))
            return [dict(r) for r in cursor.fetchall()]

    def get_review(self, review_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM spatial_reviews WHERE review_id = ?", (review_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def adjudicate_review(self, review_id: str, action: ReviewStatus, operator_id: str, justification: str) -> Dict[str, Any]:
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

            cursor.execute("""
                UPDATE spatial_reviews
                SET status = ?, operator_id = ?, justification = ?, adjudicated_at = ?
                WHERE review_id = ?
            """, (action.value, operator_id, justification, now_iso, review_id))

            cursor.execute("UPDATE plots SET status = ? WHERE plot_id = ?", (new_plot_status, submitted_plot_id))

            cursor.execute("""
                INSERT INTO audit_logs (log_id, action, actor, target_entity, target_id, details_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()), "ADJUDICATE_REVIEW", operator_id, "REVIEW", review_id,
                json.dumps({"action": action.value, "new_plot_status": new_plot_status, "justification": justification}),
                now_iso
            ))

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

    # --- Allowance & Claim Methods ---

    def create_or_update_allowance(
        self,
        plot_id: str,
        season_id: int,
        crop_code: str,
        approved_allowance_kg: int,
        evidence_document_hash: str,
        tx_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        now_iso = datetime.utcnow().isoformat() + "Z"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM allowances WHERE plot_id = ? AND season_id = ?", (plot_id, season_id))
            existing = cursor.fetchone()

            if existing:
                allowance_id = existing["allowance_id"]
                cursor.execute("""
                    UPDATE allowances
                    SET approved_allowance_kg = ?, evidence_document_hash = ?, tx_hash = ?, updated_at = ?
                    WHERE allowance_id = ?
                """, (approved_allowance_kg, evidence_document_hash, tx_hash, now_iso, allowance_id))
            else:
                allowance_id = f"allow-{uuid.uuid4()}"
                cursor.execute("""
                    INSERT INTO allowances (
                        allowance_id, plot_id, season_id, crop_code, approved_allowance_kg,
                        claimed_kg, released_kg, evidence_document_hash, status, tx_hash,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    allowance_id, plot_id, season_id, crop_code, approved_allowance_kg,
                    0, 0, evidence_document_hash, "ACTIVE", tx_hash, now_iso, now_iso
                ))

            cursor.execute("""
                INSERT INTO audit_logs (log_id, action, actor, target_entity, target_id, details_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()), "GRANT_ALLOWANCE", "REGISTRAR", "ALLOWANCE", allowance_id,
                json.dumps({"plot_id": plot_id, "season_id": season_id, "approved_kg": approved_allowance_kg, "tx_hash": tx_hash}),
                now_iso
            ))

            conn.commit()
            return self.get_allowance(plot_id, season_id)

    def get_allowance(self, plot_id: str, season_id: int) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM allowances WHERE plot_id = ? AND season_id = ?", (plot_id, season_id))
            row = cursor.fetchone()
            return dict(row) if row else None

    def record_claim(
        self,
        claim_id: str,
        plot_id: str,
        season_id: int,
        claimed_kg: int,
        shipment_evidence_hash: str,
        on_chain_status: ClaimOnChainStatus,
        document_id: Optional[str] = None,
        tx_hash: Optional[str] = None,
        block_number: Optional[int] = None
    ) -> Dict[str, Any]:
        now_iso = datetime.utcnow().isoformat() + "Z"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM claims WHERE claim_id = ?", (claim_id,))
            existing = cursor.fetchone()

            if existing:
                # Update existing claim record (idempotent / status progression)
                cursor.execute("""
                    UPDATE claims
                    SET on_chain_status = ?, tx_hash = ?, block_number = ?, updated_at = ?
                    WHERE claim_id = ?
                """, (on_chain_status.value, tx_hash, block_number, now_iso, claim_id))
            else:
                cursor.execute("""
                    INSERT INTO claims (
                        claim_id, plot_id, season_id, claimed_kg, document_id,
                        shipment_evidence_hash, on_chain_status, tx_hash, block_number,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    claim_id, plot_id, season_id, claimed_kg, document_id,
                    shipment_evidence_hash, on_chain_status.value, tx_hash, block_number,
                    now_iso, now_iso
                ))

                # Update allowance balance if confirmed
                if on_chain_status == ClaimOnChainStatus.CONFIRMED:
                    cursor.execute("""
                        UPDATE allowances
                        SET claimed_kg = claimed_kg + ?, updated_at = ?
                        WHERE plot_id = ? AND season_id = ?
                    """, (claimed_kg, now_iso, plot_id, season_id))

            cursor.execute("""
                INSERT INTO audit_logs (log_id, action, actor, target_entity, target_id, details_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()), "RECORD_CLAIM", "EXPORTER", "CLAIM", claim_id,
                json.dumps({"plot_id": plot_id, "claimed_kg": claimed_kg, "status": on_chain_status.value, "tx_hash": tx_hash}),
                now_iso
            ))

            conn.commit()
            return self.get_claim(claim_id)

    def get_claim(self, claim_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM claims WHERE claim_id = ?", (claim_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_claims(self, plot_id: Optional[str] = None, season_id: Optional[int] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM claims WHERE 1=1"
            params = []
            if plot_id:
                query += " AND plot_id = ?"
                params.append(plot_id)
            if season_id:
                query += " AND season_id = ?"
                params.append(season_id)
            query += " ORDER BY created_at DESC"
            cursor.execute(query, tuple(params))
            return [dict(r) for r in cursor.fetchall()]

    def release_claim_record(self, claim_id: str, reason: str, tx_hash: Optional[str] = None) -> Dict[str, Any]:
        now_iso = datetime.utcnow().isoformat() + "Z"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM claims WHERE claim_id = ?", (claim_id,))
            claim = cursor.fetchone()
            if not claim:
                raise ValueError(f"Claim '{claim_id}' not found.")
            if claim["is_released"]:
                raise ValueError(f"Claim '{claim_id}' has already been released.")

            claimed_kg = claim["claimed_kg"]
            plot_id = claim["plot_id"]
            season_id = claim["season_id"]

            cursor.execute("""
                UPDATE claims
                SET is_released = 1, release_reason = ?, tx_hash = COALESCE(?, tx_hash), updated_at = ?
                WHERE claim_id = ?
            """, (reason, tx_hash, now_iso, claim_id))

            cursor.execute("""
                UPDATE allowances
                SET released_kg = released_kg + ?, updated_at = ?
                WHERE plot_id = ? AND season_id = ?
            """, (claimed_kg, now_iso, plot_id, season_id))

            cursor.execute("""
                INSERT INTO audit_logs (log_id, action, actor, target_entity, target_id, details_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()), "RELEASE_CLAIM", "OPERATOR", "CLAIM", claim_id,
                json.dumps({"reason": reason, "released_kg": claimed_kg, "tx_hash": tx_hash}),
                now_iso
            ))

            conn.commit()
            return self.get_claim(claim_id)

    # --- Shipment Document Methods ---

    def save_shipment_document(
        self,
        file_name: str,
        file_hash_sha256: str,
        raw_text: str,
        extraction_source: str,
        extracted_fields: Dict[str, Any]
    ) -> Dict[str, Any]:
        doc_id = f"doc-{uuid.uuid4()}"
        now_iso = datetime.utcnow().isoformat() + "Z"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO shipment_documents (
                    document_id, file_name, file_hash_sha256, raw_text, extraction_source,
                    extracted_fields_json, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                doc_id, file_name, file_hash_sha256, raw_text, extraction_source,
                json.dumps(extracted_fields), "PENDING_CONFIRMATION", now_iso
            ))
            conn.commit()
            return self.get_shipment_document(doc_id)

    def get_shipment_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM shipment_documents WHERE document_id = ?", (document_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def confirm_shipment_document(
        self,
        document_id: str,
        operator_id: str,
        confirmed_fields: Dict[str, Any]
    ) -> Dict[str, Any]:
        now_iso = datetime.utcnow().isoformat() + "Z"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM shipment_documents WHERE document_id = ?", (document_id,))
            doc = cursor.fetchone()
            if not doc:
                raise ValueError(f"Document '{document_id}' not found.")

            cursor.execute("""
                UPDATE shipment_documents
                SET confirmed_fields_json = ?, status = 'CONFIRMED', operator_id = ?, confirmed_at = ?
                WHERE document_id = ?
            """, (json.dumps(confirmed_fields), operator_id, now_iso, document_id))

            cursor.execute("""
                INSERT INTO audit_logs (log_id, action, actor, target_entity, target_id, details_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()), "CONFIRM_DOCUMENT", operator_id, "DOCUMENT", document_id,
                json.dumps({"confirmed_fields": confirmed_fields}),
                now_iso
            ))

            conn.commit()
            return self.get_shipment_document(document_id)

    # --- Environmental Screening Methods ---

    def save_environmental_screening(
        self,
        plot_id: str,
        service_name: str,
        deforestation_risk: str,
        cutoff_date: str,
        indicators: Dict[str, Any],
        provenance: str,
        source_digest: str,
        is_cached: bool = False
    ) -> Dict[str, Any]:
        screening_id = f"env-{uuid.uuid4()}"
        now_iso = datetime.utcnow().isoformat() + "Z"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO environmental_screenings (
                    screening_id, plot_id, service_name, deforestation_risk, cutoff_date,
                    indicators_json, provenance, source_digest, is_cached, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                screening_id, plot_id, service_name, deforestation_risk, cutoff_date,
                json.dumps(indicators), provenance, source_digest, 1 if is_cached else 0, now_iso
            ))
            conn.commit()
            return self.get_environmental_screening(plot_id)

    def get_environmental_screening(self, plot_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM environmental_screenings WHERE plot_id = ? ORDER BY created_at DESC LIMIT 1", (plot_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
