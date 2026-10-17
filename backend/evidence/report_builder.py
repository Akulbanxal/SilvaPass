"""
Canonical Evidence Report Generator.
Aggregates:
- Plot geometry & canonical fingerprint
- Spatial deduplication verification
- Operator review adjudication (if applicable)
- Environmental screening indicators with provenance tags
- Confirmed shipment document fields
- On-chain transaction receipt & claim status
Computes a canonical SHA-256 evidence bundle root digest.
"""
import hashlib
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

from backend.schemas.api_models import EvidenceReportResponse, EvidenceItem, ProvenanceType


class EvidenceReportBuilder:
    def build_report(
        self,
        plot_record: Dict[str, Any],
        allowance_record: Optional[Dict[str, Any]],
        claim_record: Optional[Dict[str, Any]],
        document_record: Optional[Dict[str, Any]],
        screening_record: Optional[Dict[str, Any]],
        review_record: Optional[Dict[str, Any]]
    ) -> EvidenceReportResponse:
        plot_id = plot_record["plot_id"]
        canonical_plot_hash = plot_record["canonical_fingerprint"]
        season_id = allowance_record["season_id"] if allowance_record else 2026

        evidence_items: List[EvidenceItem] = []

        # 1. Geometry Invariant Evidence
        geom_digest = hashlib.sha256(plot_record["canonical_wkt"].encode("utf-8")).hexdigest()
        evidence_items.append(EvidenceItem(
            title="Plot Boundary Integrity & Topological Sanitization",
            claim_type="GEOSPATIAL_GEOMETRY",
            digest_sha256=geom_digest,
            provenance=ProvenanceType.MEASURED,
            details={
                "area_ha": plot_record["geodesic_area_ha"],
                "perimeter_m": plot_record["geodesic_perimeter_m"],
                "vertex_count": plot_record["vertex_count"],
                "country_code": plot_record["country_code"],
                "status": plot_record["status"]
            }
        ))

        # 2. Operator Review Adjudication (if ambiguous match occurred)
        if review_record and review_record.get("adjudicated_at"):
            review_digest = hashlib.sha256(json.dumps(review_record, sort_keys=True).encode("utf-8")).hexdigest()
            evidence_items.append(EvidenceItem(
                title="Spatial Overlap Operator Adjudication",
                claim_type="OPERATOR_REVIEW",
                digest_sha256=review_digest,
                provenance=ProvenanceType.MEASURED,
                details={
                    "review_id": review_record["review_id"],
                    "operator_id": review_record["operator_id"],
                    "action": review_record["status"],
                    "justification": review_record["justification"],
                    "adjudicated_at": review_record["adjudicated_at"]
                }
            ))

        # 3. Environmental Screening Evidence
        if screening_record:
            screening_digest = hashlib.sha256(screening_record["indicators_json"].encode("utf-8")).hexdigest()
            provenance_enum = ProvenanceType(screening_record["provenance"]) if screening_record["provenance"] in ProvenanceType.__members__ else ProvenanceType.CACHED_SNAPSHOT
            evidence_items.append(EvidenceItem(
                title=f"Environmental Screening ({screening_record['service_name']})",
                claim_type="ENVIRONMENTAL_ASSESSMENT",
                digest_sha256=screening_digest,
                provenance=provenance_enum,
                details={
                    "deforestation_risk": screening_record["deforestation_risk"],
                    "cutoff_date": screening_record["cutoff_date"],
                    "indicators": json.loads(screening_record["indicators_json"])
                }
            ))

        # 4. Shipment Document Confirmation
        if document_record and document_record.get("confirmed_fields_json"):
            doc_digest = document_record["file_hash_sha256"]
            evidence_items.append(EvidenceItem(
                title="Confirmed Shipment Document Fields",
                claim_type="DOCUMENT_CONFIRMATION",
                digest_sha256=doc_digest,
                provenance=ProvenanceType.MEASURED,
                details=json.loads(document_record["confirmed_fields_json"])
            ))

        # 5. On-Chain Claim State
        claim_id = claim_record["claim_id"] if claim_record else None
        tx_hash = claim_record.get("tx_hash") if claim_record else None

        if claim_record:
            claim_digest = hashlib.sha256(json.dumps(claim_record, sort_keys=True).encode("utf-8")).hexdigest()
            evidence_items.append(EvidenceItem(
                title="On-Chain Production Claim Invariant Anchor",
                claim_type="SMART_CONTRACT_STATE",
                digest_sha256=claim_digest,
                provenance=ProvenanceType.MEASURED,
                details={
                    "claim_id": claim_record["claim_id"],
                    "claimed_kg": claim_record["claimed_kg"],
                    "on_chain_status": claim_record["on_chain_status"],
                    "tx_hash": claim_record.get("tx_hash"),
                    "block_number": claim_record.get("block_number"),
                    "is_released": bool(claim_record.get("is_released"))
                }
            ))

        # Compute Root Evidence Bundle Hash (Merkle root equivalent)
        combined_digests = "".join([item.digest_sha256 for item in evidence_items])
        root_hash = hashlib.sha256(combined_digests.encode("utf-8")).hexdigest()

        now_iso = datetime.utcnow().isoformat() + "Z"
        disclaimer = (
            "NOTICE: SilvaPass is an evidence-backed protocol demonstrating plot identity resolution "
            "and shared double-claim prevention on-chain. This prototype does NOT claim legal accreditation "
            "under EUDR or TRACES, nor does it guarantee prevention of fraudulent claims outside the participating registry."
        )

        return EvidenceReportResponse(
            report_id=f"rep-{root_hash[:16]}",
            plot_id=plot_id,
            canonical_plot_hash=canonical_plot_hash,
            season_id=season_id,
            claim_id=claim_id,
            on_chain_tx_hash=tx_hash,
            root_evidence_bundle_hash=f"0x{root_hash}",
            evidence_items=evidence_items,
            system_boundary_disclaimer=disclaimer,
            generated_at=now_iso
        )
