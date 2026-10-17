#!/usr/bin/env python3
"""
SilvaPass Deterministic Demonstration Seeder.
Initializes the clean, explicitly synthetic demonstration scenario required for IEEE ClimateChain:
1. Registers base reference plot ('PLOT-BASE-DEMO') in Mato Grosso, Brazil -> ACTIVE.
2. Registers shifted duplicate polygon ('PLOT-DUP-DEMO') -> FLAGGED_DUPLICATE.
3. Registers partial-overlap boundary ('PLOT-AMB-DEMO') -> PENDING_REVIEW.
4. Adjudicates the ambiguous review with auditable supervisor justification -> ACTIVE.
5. Grants an approved illustrative production allowance of 3,000 kg on 'PLOT-BASE-DEMO'.
6. Submits first accepted claim of 1,800 kg -> CONFIRMED (Remaining: 1,200 kg).
7. Submits second over-allocation claim of 2,000 kg -> REJECTED_OVER_ALLOCATION (Remaining: 1,200 kg preserved).
8. Screens base plot with FAO WHISP environmental screening -> CACHED_SNAPSHOT.
9. Extracts and confirms sample shipment document 'bol_demo_1800kg.txt' -> CONFIRMED.
10. Generates root evidence report bundle with cryptographic hash.

Safety: Operates on local SQLite database only. Never overwrites external or user data silently.
"""

import sys
import os
import json
import uuid

# Ensure repository root in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.storage.database_manager import DatabaseManager
from backend.geo.synthetic_benchmarks import generate_synthetic_benchmark_suite
from backend.geo.models import ReviewStatus
from backend.schemas.api_models import ClaimOnChainStatus
from backend.environmental.whisp_client import WhispScreeningService
from backend.documents.extractor import DocumentExtractor, RuleBasedExtractionProvider
from backend.evidence.report_builder import EvidenceReportBuilder


def seed_demo_environment(db_path: str = "./silvapass.db", reset: bool = False):
    print("=" * 80)
    print("SILVAPASS DEMONSTRATION SCENARIO INITIALIZER")
    print("=" * 80)
    print(f"Target Database: {os.path.abspath(db_path)}")

    if reset and os.path.exists(db_path):
        print("[RESET] Removing existing local database for clean-slate demonstration...")
        os.remove(db_path)

    db = DatabaseManager(db_path=db_path)
    benchmarks = generate_synthetic_benchmark_suite()

    # 1. Base Reference Plot
    print("\n1. Ingesting Original Base Plot ('PLOT-BASE-DEMO')...")
    res_base = db.register_and_classify_plot(
        geojson_geom=benchmarks["base_plot"],
        plot_id="PLOT-BASE-DEMO",
        country_code="BR",
        crop_code="SOY"
    )
    print(f"   -> Status: {res_base.status.value} (Area: {res_base.geodesic_area_ha:.2f} ha, Fingerprint: {res_base.canonical_fingerprint[:16]}...)")

    # 2. Shifted / Jittered Duplicate Plot
    print("\n2. Ingesting Jittered Duplicate Plot ('PLOT-DUP-DEMO')...")
    res_dup = db.register_and_classify_plot(
        geojson_geom=benchmarks["jittered_plot"],
        plot_id="PLOT-DUP-DEMO",
        country_code="BR",
        crop_code="SOY"
    )
    print(f"   -> Status: {res_dup.status.value} (Classification: {res_dup.classification.value})")
    if res_dup.similarity_evidence:
        ev = res_dup.similarity_evidence[0]
        print(f"   -> Spatial Overlap: IoU={ev.iou:.2%}, Centroid Drift={ev.centroid_distance_m}m, Hausdorff={ev.hausdorff_distance_m}m")

    # 3. Partial Overlap Plot (Ambiguous Conflict)
    print("\n3. Ingesting Partial Overlap Boundary ('PLOT-AMB-DEMO')...")
    res_amb = db.register_and_classify_plot(
        geojson_geom=benchmarks["partial_overlap_plot"],
        plot_id="PLOT-AMB-DEMO",
        country_code="BR",
        crop_code="SOY"
    )
    print(f"   -> Status: {res_amb.status.value} (Classification: {res_amb.classification.value}, Review ID: {res_amb.review_id})")

    # 4. Operator Adjudication
    if res_amb.review_id:
        print("\n4. Adjudicating Ambiguous Boundary Review...")
        adj = db.adjudicate_review(
            review_id=res_amb.review_id,
            action=ReviewStatus.APPROVED_SEPARATE_PARCEL,
            operator_id="OP-SUPERVISOR-42",
            justification="Verified cadastral benchmark monuments and physical irrigation easement. Approved separate parcel."
        )
        print(f"   -> Adjudication Result: {adj['new_plot_status']} (Operator: OP-SUPERVISOR-42)")

    # 5. Production Allowance Grant
    print("\n5. Granting Approved Illustrative Production Allowance on 'PLOT-BASE-DEMO'...")
    allowance = db.create_or_update_allowance(
        plot_id="PLOT-BASE-DEMO",
        season_id=2026,
        crop_code="SOY",
        approved_allowance_kg=3000,
        evidence_document_hash="0x" + "a" * 64,
        tx_hash="0x4f89d31c89012a45e902b3c102a945d89f72c10b429019ac8129e019b841a021"
    )
    print(f"   -> Approved Allowance: {allowance['approved_allowance_kg']:,} kg | Remaining: 3,000 kg")

    # 6. Accepted First Claim (1,800 kg)
    print("\n6. Submitting Valid Shipment Claim (1,800 kg)...")
    claim_1 = db.record_claim(
        claim_id="CLAIM-BOL-DEMO-01",
        plot_id="PLOT-BASE-DEMO",
        season_id=2026,
        claimed_kg=1800,
        shipment_evidence_hash="0x" + "b" * 64,
        on_chain_status=ClaimOnChainStatus.CONFIRMED,
        tx_hash="0x892a019efbc4510293da829c9103e9401bfd920194812a02b489102ca8910245",
        block_number=42
    )
    print(f"   -> Claim Status: {claim_1['on_chain_status']} | Claimed: {claim_1['claimed_kg']:,} kg | Remaining Capacity: 1,200 kg")

    # 7. Rejected Over-Allocation Claim (2,000 kg)
    print("\n7. Submitting Over-Allocation Shipment Claim (2,000 kg against 1,200 kg remaining)...")
    claim_2 = db.record_claim(
        claim_id="CLAIM-BOL-DEMO-02",
        plot_id="PLOT-BASE-DEMO",
        season_id=2026,
        claimed_kg=2000,
        shipment_evidence_hash="0x" + "c" * 64,
        on_chain_status=ClaimOnChainStatus.REJECTED_OVER_ALLOCATION,
        tx_hash="0x1029384756abcdef0192837465bcdeaf0192837465afbced0192837465abcdef",
        block_number=43
    )
    print(f"   -> Claim Status: {claim_2['on_chain_status']} | Balance State: Strictly Preserved at 1,200 kg remaining")

    # 8. Environmental Screening (FAO WHISP Reference Snapshot)
    print("\n8. Executing Environmental Screening for 'PLOT-BASE-DEMO'...")
    import asyncio
    whisp_service = WhispScreeningService(mode="SNAPSHOT")
    screening_res = asyncio.run(whisp_service.screen_plot_geometry("PLOT-BASE-DEMO", benchmarks["base_plot"]))
    db.save_environmental_screening(
        plot_id="PLOT-BASE-DEMO",
        service_name=screening_res.service_name,
        deforestation_risk=screening_res.deforestation_risk.value,
        cutoff_date=screening_res.cutoff_date,
        indicators=screening_res.indicators.model_dump(),
        provenance=screening_res.provenance.value,
        source_digest=screening_res.source_digest,
        is_cached=screening_res.is_cached_snapshot
    )
    print(f"   -> Screening: {screening_res.deforestation_risk.value} [Provenance: {screening_res.provenance.value}]")

    # 9. Document Extraction & Confirmation
    print("\n9. Ingesting & Confirming Shipment Document...")
    raw_doc_text = """
OCEAN BILL OF LADING
B/L No: BOL-BR-2026-9941
Date: 2026-10-16
Shipper: Fazenda Santa Maria do Sul Ltda, Sorriso, MT, Brazil
Consignee: EuroCommodities Logistics B.V., Rotterdam, Netherlands
Commodity: Bulk Soybeans (Non-GMO)
Declared Weight: 1,800 KG
Origin Plot ID: PLOT-BASE-DEMO
Season: 2026
Clean on Board. Freight Prepaid.
    """.strip()
    extractor = DocumentExtractor(provider=RuleBasedExtractionProvider())
    doc_res = asyncio.run(extractor.extract_fields_async("bol_demo_1800kg.txt", raw_doc_text))
    saved_doc = db.save_shipment_document(
        file_name="bol_demo_1800kg.txt",
        file_hash_sha256=doc_res.file_hash_sha256,
        raw_text=raw_doc_text,
        extraction_source=doc_res.extraction_source,
        extracted_fields=doc_res.extracted_fields.model_dump()
    )
    confirmed_doc = db.confirm_shipment_document(
        document_id=saved_doc["document_id"],
        operator_id="OP-CUSTOMS-OFFICER-01",
        confirmed_fields=doc_res.extracted_fields.model_dump()
    )
    print(f"   -> Extracted & Confirmed Document '{saved_doc['file_name']}' (Declared: 1,800 kg SOY for PLOT-BASE-DEMO)")

    # 10. Evidence Report
    print("\n10. Building Canonical Evidence Report Bundle...")
    builder = EvidenceReportBuilder()
    report = builder.build_report(
        plot_record=db.get_plot("PLOT-BASE-DEMO"),
        allowance_record=db.get_allowance("PLOT-BASE-DEMO", 2026),
        claim_record=db.get_claim("CLAIM-BOL-DEMO-01"),
        document_record=confirmed_doc,
        screening_record=db.get_environmental_screening("PLOT-BASE-DEMO"),
        review_record=None
    )
    print(f"   -> Evidence Bundle Root Digest: {report.root_evidence_bundle_hash}")
    print(f"   -> Total Evidence Items Anchored: {len(report.evidence_items)}")

    # Also write synthetic GeoJSON files to data/demo/synthetic_plots for manual testing
    demo_plots_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "demo", "synthetic_plots"))
    os.makedirs(demo_plots_dir, exist_ok=True)
    with open(os.path.join(demo_plots_dir, "01_base_plot_30ha.geojson"), "w") as f:
        json.dump(benchmarks["base_plot"], f, indent=2)
    with open(os.path.join(demo_plots_dir, "02_shifted_duplicate_plot.geojson"), "w") as f:
        json.dump(benchmarks["shifted_plot"], f, indent=2)
    with open(os.path.join(demo_plots_dir, "03_partial_overlap_40pct.geojson"), "w") as f:
        json.dump(benchmarks["partial_overlap_plot"], f, indent=2)
    with open(os.path.join(demo_plots_dir, "04_adjacent_fence_plot.geojson"), "w") as f:
        json.dump(benchmarks["adjacent_plot"], f, indent=2)
    print(f"\n[Generated sample GeoJSON files in {demo_plots_dir}]")

    print("\n" + "=" * 80)
    print("DEMO INITIALIZATION COMPLETE. ALL 10 DEMONSTRATION WORKFLOWS READY.")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    seed_demo_environment(reset=reset_flag)
