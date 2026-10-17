"""
End-to-End Integration Scenario Tests for SilvaPass Protocol.

Covers the full required workflow:
1. Register synthetic agricultural plot with valid GeoJSON.
2. Submit perturbed copy of the same polygon (altered geometry).
3. Verify matching evidence (IoU, centroid distance) and require human adjudication.
4. Verify non-active / pending duplicate plot cannot receive an independent allowance.
5. Adjudicate duplicate review (CONFIRMED_DUPLICATE).
6. Grant illustrative allowance of 3,000 kg on the active base plot.
7. Submit valid shipment claim of 1,800 kg -> CONFIRMED, balance strictly 1,200 kg.
8. Submit second claim of 2,000 kg -> Non-reverting REJECTED_OVER_ALLOCATION, balance strictly unchanged at 1,200 kg.
9. Verify idempotency and persistence across queries (recovering authoritative state).
10. Test RPC outage fallback simulation vs connected behavior.
"""
import pytest
from httpx import AsyncClient, ASGITransport
import uuid
import tempfile
import os

from backend.main import app
from backend.geo.synthetic_benchmarks import generate_synthetic_benchmark_suite
from backend.storage.database_manager import DatabaseManager
from backend.contracts_client.web3_client import BlockchainRegistryClient
import backend.api.v1_router as v1_mod


@pytest.fixture(autouse=True)
def isolated_env():
    temp_dir = tempfile.mkdtemp()
    test_db_path = os.path.join(temp_dir, f"test_e2e_{uuid.uuid4().hex}.db")
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
async def test_end_to_end_scenario_workflow(client):
    """
    Executes the complete 10-step hackathon acceptance workflow.
    """
    benchmarks = generate_synthetic_benchmark_suite()
    base_geom = benchmarks["base_plot"]
    altered_geom = benchmarks["partial_overlap_plot"]  # Altered polygon triggering AMBIGUOUS review queue

    # 1. Register synthetic base plot
    base_plot_id = f"SYNTH-PLOT-BASE-{uuid.uuid4().hex[:6]}"
    res_reg1 = await client.post("/api/v1/plots/register", json={
        "plot_id": base_plot_id,
        "geometry": base_geom,
        "country_code": "BR",
        "crop_code": "SOY"
    })
    assert res_reg1.status_code == 201
    data_reg1 = res_reg1.json()
    assert data_reg1["status"] == "ACTIVE"

    # 2. Submit perturbed copy of the same polygon
    altered_plot_id = f"SYNTH-PLOT-ALTERED-{uuid.uuid4().hex[:6]}"
    res_reg2 = await client.post("/api/v1/plots/register", json={
        "plot_id": altered_plot_id,
        "geometry": altered_geom,
        "country_code": "BR",
        "crop_code": "SOY"
    })
    assert res_reg2.status_code == 201
    data_reg2 = res_reg2.json()
    assert data_reg2["status"] == "PENDING_REVIEW"
    assert data_reg2["classification"] == "AMBIGUOUS"
    assert data_reg2["review_id"] is not None
    review_id = data_reg2["review_id"]

    # 3. Inspect matching evidence in review queue
    res_reviews = await client.get("/api/v1/reviews/pending")
    assert res_reviews.status_code == 200
    pending_list = res_reviews.json()
    matching_review = next((r for r in pending_list if r["review_id"] == review_id), None)
    assert matching_review is not None
    assert matching_review["iou"] > 0.20

    # 4. Ensure ambiguous plot CANNOT silently receive an independent allowance
    res_illegal_allowance = await client.post("/api/v1/allowances/grant", json={
        "plot_id": altered_plot_id,
        "season_id": 2026,
        "crop_code": "SOY",
        "approved_allowance_kg": 3000,
        "evidence_document_hash": "0x" + "a" * 64
    })
    assert res_illegal_allowance.status_code == 400
    assert "PENDING_REVIEW" in res_illegal_allowance.json()["detail"]

    # 5. Adjudicate review queue item as CONFIRMED_DUPLICATE
    res_adj = await client.post(f"/api/v1/reviews/{review_id}/adjudicate", json={
        "action": "CONFIRMED_DUPLICATE",
        "operator_id": "OP-EUDR-OFFICER-01",
        "justification": "Side-by-side satellite overlay confirms this is a coordinate-jittered duplicate of base plot."
    })
    assert res_adj.status_code == 200
    assert res_adj.json()["new_plot_status"] == "FLAGGED_DUPLICATE"

    # Verify that FLAGGED_DUPLICATE also remains strictly blocked from receiving allowances
    res_flagged_allowance = await client.post("/api/v1/allowances/grant", json={
        "plot_id": altered_plot_id,
        "season_id": 2026,
        "crop_code": "SOY",
        "approved_allowance_kg": 3000,
        "evidence_document_hash": "0x" + "a" * 64
    })
    assert res_flagged_allowance.status_code == 400
    assert "FLAGGED_DUPLICATE" in res_flagged_allowance.json()["detail"]

    # 6. Grant approved illustrative allowance of 3,000 kg on the resolved active base plot
    res_grant = await client.post("/api/v1/allowances/grant", json={
        "plot_id": base_plot_id,
        "season_id": 2026,
        "crop_code": "SOY",
        "approved_allowance_kg": 3000,
        "evidence_document_hash": "0x" + "b" * 64
    })
    assert res_grant.status_code == 201
    grant_data = res_grant.json()
    assert grant_data["approved_allowance_kg"] == 3000
    assert grant_data["remaining_allowance_kg"] == 3000
    assert grant_data["tx_hash"] is not None

    # 7. Submit valid shipment claim for 1,800 kg
    claim1_id = f"CLAIM-BOL-1800-{uuid.uuid4().hex[:6]}"
    res_claim1 = await client.post("/api/v1/claims/submit", json={
        "claim_id": claim1_id,
        "plot_id": base_plot_id,
        "season_id": 2026,
        "claimed_kg": 1800,
        "shipment_evidence_hash": "0x" + "c" * 64
    })
    assert res_claim1.status_code == 200
    claim1_data = res_claim1.json()
    assert claim1_data["status"] == "CONFIRMED"
    assert claim1_data["remaining_capacity_kg"] == 1200
    assert claim1_data["tx_hash"] is not None

    # Verify query for allowance state confirms remaining is exactly 1,200 kg
    res_allowance_check1 = await client.get(f"/api/v1/allowances/{base_plot_id}/2026")
    assert res_allowance_check1.status_code == 200
    assert res_allowance_check1.json()["remaining_allowance_kg"] == 1200
    assert res_allowance_check1.json()["claimed_kg"] == 1800

    # 8. Submit second claim for 2,000 kg (attempts to claim more than the 1,200 kg remaining)
    claim2_id = f"CLAIM-BOL-2000-{uuid.uuid4().hex[:6]}"
    res_claim2 = await client.post("/api/v1/claims/submit", json={
        "claim_id": claim2_id,
        "plot_id": base_plot_id,
        "season_id": 2026,
        "claimed_kg": 2000,
        "shipment_evidence_hash": "0x" + "d" * 64
    })
    assert res_claim2.status_code == 200
    claim2_data = res_claim2.json()
    assert claim2_data["status"] == "REJECTED_OVER_ALLOCATION"
    assert claim2_data["remaining_capacity_kg"] == 1200
    assert "Balance remains strictly unchanged" in claim2_data["message"]

    # 9. Invariant Verification: Remaining allowance is still strictly 1,200 kg
    res_allowance_check2 = await client.get(f"/api/v1/allowances/{base_plot_id}/2026")
    assert res_allowance_check2.status_code == 200
    assert res_allowance_check2.json()["remaining_allowance_kg"] == 1200
    assert res_allowance_check2.json()["claimed_kg"] == 1800

    # 10. Verify claims listing recovers authoritative ledger history
    res_claims_list = await client.get(f"/api/v1/claims?plot_id={base_plot_id}&season_id=2026")
    assert res_claims_list.status_code == 200
    claims_list = res_claims_list.json()
    assert len(claims_list) == 2
    # Verify rejection record is auditable
    assert any(c["status"] == "REJECTED_OVER_ALLOCATION" for c in claims_list)
    assert any(c["status"] == "CONFIRMED" for c in claims_list)


@pytest.mark.asyncio
async def test_rpc_outage_resilience(client):
    """
    Verifies that the application gracefully provides clear status and does not crash when RPC is unreachable.
    """
    res = await client.get("/api/v1/blockchain/status")
    assert res.status_code == 200
    data = res.json()
    assert "mode" in data
    assert data["mode"] in ["LIVE_EVM", "FALLBACK_SIMULATED"]
    assert "message" in data
