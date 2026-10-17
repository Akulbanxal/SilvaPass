"""
Comprehensive Integration Tests for SilvaPass FastAPI REST API.
Uses isolated temporary SQLite database for test runs.
"""
import pytest
from httpx import AsyncClient, ASGITransport
import uuid
import json
import tempfile
import os

from backend.main import app
from backend.geo.synthetic_benchmarks import generate_synthetic_benchmark_suite
from backend.storage.database_manager import DatabaseManager
import backend.api.v1_router as v1_mod


@pytest.fixture(autouse=True)
def isolated_test_db():
    temp_dir = tempfile.mkdtemp()
    test_db_path = os.path.join(temp_dir, f"test_api_{uuid.uuid4().hex}.db")
    test_db = DatabaseManager(db_path=test_db_path)
    
    # Patch module global db
    original_db = v1_mod.db
    v1_mod.db = test_db

    yield test_db

    v1_mod.db = original_db
    if os.path.exists(test_db_path):
        os.remove(test_db_path)


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_api_health_and_ping(client):
    res_health = await client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"

    res_ping = await client.get("/api/v1/ping")
    assert res_ping.status_code == 200
    assert res_ping.json()["message"] == "pong"


@pytest.mark.asyncio
async def test_api_plot_validation(client):
    benchmarks = generate_synthetic_benchmark_suite()
    
    # Valid plot
    res = await client.post("/api/v1/plots/validate", json={"geometry": benchmarks["base_plot"]})
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["geodesic_area_ha"] > 20.0

    # Invalid self-intersecting plot
    res_bad = await client.post("/api/v1/plots/validate", json={"geometry": benchmarks["self_intersecting_plot"]})
    assert res_bad.status_code == 200
    assert res_bad.json()["is_valid"] is False


@pytest.mark.asyncio
async def test_api_end_to_end_lifecycle(client):
    benchmarks = generate_synthetic_benchmark_suite()
    base_plot_id = f"PLOT-API-BASE-{uuid.uuid4().hex[:6]}"

    # 1. Register Base Plot -> 201 Created
    res_reg = await client.post("/api/v1/plots/register", json={
        "plot_id": base_plot_id,
        "geometry": benchmarks["base_plot"],
        "country_code": "BR",
        "crop_code": "SOY"
    })
    assert res_reg.status_code == 201
    assert res_reg.json()["status"] == "ACTIVE"

    # 2. Register Duplicate Plot -> FLAGGED_DUPLICATE
    res_dup = await client.post("/api/v1/plots/register", json={
        "plot_id": f"PLOT-API-DUP-{uuid.uuid4().hex[:6]}",
        "geometry": benchmarks["jittered_plot"],
        "country_code": "BR",
        "crop_code": "SOY"
    })
    assert res_dup.status_code == 201
    assert res_dup.json()["status"] == "FLAGGED_DUPLICATE"

    # 3. Register Ambiguous Overlap -> PENDING_REVIEW
    res_amb = await client.post("/api/v1/plots/register", json={
        "plot_id": f"PLOT-API-AMB-{uuid.uuid4().hex[:6]}",
        "geometry": benchmarks["partial_overlap_plot"],
        "country_code": "BR",
        "crop_code": "SOY"
    })
    assert res_amb.status_code == 201
    assert res_amb.json()["status"] == "PENDING_REVIEW"
    review_id = res_amb.json()["review_id"]
    assert review_id is not None

    # 4. Adjudicate Review -> APPROVED_SEPARATE_PARCEL
    res_adj = await client.post(f"/api/v1/reviews/{review_id}/adjudicate", json={
        "action": "APPROVED_SEPARATE_PARCEL",
        "operator_id": "OP-OFFICER-77",
        "justification": "Verified on-site cadastral benchmark. Legitimate shared drainage easement."
    })
    assert res_adj.status_code == 200
    assert res_adj.json()["new_plot_status"] == "ACTIVE"

    # 5. Grant Production Allowance on Base Plot (3,000 kg)
    res_allow = await client.post("/api/v1/allowances/grant", json={
        "plot_id": base_plot_id,
        "season_id": 2026,
        "crop_code": "SOY",
        "approved_allowance_kg": 3000,
        "evidence_document_hash": "0x" + "c" * 64
    })
    assert res_allow.status_code == 201
    assert res_allow.json()["approved_allowance_kg"] == 3000
    assert res_allow.json()["remaining_allowance_kg"] == 3000

    # 6. Extract Shipment Document
    raw_doc = """
    BILL OF LADING: BOL-BR-2026-9941
    Consignor: Fazenda Santa Maria do Sul Ltda
    Consignee: Global Grain Traders Rotterdam B.V.
    Commodity: Soybeans
    Net Weight: 1,800 KG
    Shipment Date: 2026-10-16
    Plot ID: """ + base_plot_id

    res_doc = await client.post("/api/v1/documents/extract", json={
        "file_name": "bill_of_lading_9941.txt",
        "raw_document_text": raw_doc
    })
    assert res_doc.status_code == 200
    doc_id = res_doc.json()["document_id"]
    assert res_doc.json()["extracted_fields"]["declared_weight_kg"] == 1800

    # 7. Confirm Shipment Document Fields (Human-in-the-Loop)
    res_confirm = await client.post(f"/api/v1/documents/{doc_id}/confirm", json={
        "operator_id": "OP-CUSTOMS-01",
        "confirmed_fields": res_doc.json()["extracted_fields"]
    })
    assert res_confirm.status_code == 200
    assert res_confirm.json()["status"] == "CONFIRMED"

    # 8. Submit Shipment Claim for 1,800 kg -> CONFIRMED (Remaining: 1,200 kg)
    claim1_id = f"CLAIM-API-001-{uuid.uuid4().hex[:6]}"
    res_claim1 = await client.post("/api/v1/claims/submit", json={
        "claim_id": claim1_id,
        "plot_id": base_plot_id,
        "season_id": 2026,
        "claimed_kg": 1800,
        "document_id": doc_id,
        "shipment_evidence_hash": "0x" + "d" * 64
    })
    assert res_claim1.status_code == 200
    assert res_claim1.json()["status"] == "CONFIRMED"
    assert res_claim1.json()["remaining_capacity_kg"] == 1200

    # 9. Idempotent Resubmission of Claim 1 -> Same Status, Zero Extra Deduction
    res_resubmit = await client.post("/api/v1/claims/submit", json={
        "claim_id": claim1_id,
        "plot_id": base_plot_id,
        "season_id": 2026,
        "claimed_kg": 1800,
        "shipment_evidence_hash": "0x" + "d" * 64
    })
    assert res_resubmit.status_code == 200
    assert res_resubmit.json()["status"] == "CONFIRMED"

    # 10. Attempt Over-Allocation Claim for 2,000 kg -> REJECTED_OVER_ALLOCATION (Leaves 1,200 kg untouched)
    claim2_id = f"CLAIM-API-002-{uuid.uuid4().hex[:6]}"
    res_claim2 = await client.post("/api/v1/claims/submit", json={
        "claim_id": claim2_id,
        "plot_id": base_plot_id,
        "season_id": 2026,
        "claimed_kg": 2000,
        "shipment_evidence_hash": "0x" + "e" * 64
    })
    assert res_claim2.status_code == 200
    assert res_claim2.json()["status"] == "REJECTED_OVER_ALLOCATION"
    assert res_claim2.json()["remaining_capacity_kg"] == 1200

    # 11. Release Claim 1 (1,800 kg) -> Capacity Restored to 3,000 kg
    res_release = await client.post(f"/api/v1/claims/{claim1_id}/release", json={
        "reason": "Shipment cancelled due to maritime carrier delay"
    })
    assert res_release.status_code == 200
    assert res_release.json()["remaining_capacity_kg"] == 3000

    # 12. Environmental Screening (FAO WHISP)
    res_env = await client.post("/api/v1/screening/whisp", json={
        "plot_id": base_plot_id,
        "mode": "SNAPSHOT"
    })
    assert res_env.status_code == 200
    assert res_env.json()["deforestation_risk"] == "LOW_RISK"
    assert res_env.json()["provenance"] == "CACHED_SNAPSHOT"

    # 13. Generate Canonical Evidence Report
    res_rep = await client.get(f"/api/v1/evidence/report/{base_plot_id}?season_id=2026&claim_id={claim1_id}")
    assert res_rep.status_code == 200
    rep_data = res_rep.json()
    assert rep_data["plot_id"] == base_plot_id
    assert len(rep_data["evidence_items"]) >= 3
    assert rep_data["root_evidence_bundle_hash"].startswith("0x")
    assert "disclaimer" in rep_data["system_boundary_disclaimer"].lower() or "prototype" in rep_data["system_boundary_disclaimer"].lower()
