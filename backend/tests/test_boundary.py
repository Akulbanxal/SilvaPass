"""
Integration Boundary Tests:
Verifies that unresolved or duplicate plots can NEVER receive an on-chain allowance.
"""
import pytest
import os
import tempfile
from backend.storage.spatial_db import SpatialStorage
from backend.contracts_client.boundary import AllowanceServiceBoundary, OnChainAllowanceRequest
from backend.geo.synthetic_benchmarks import generate_synthetic_benchmark_suite
from backend.geo.models import ReviewStatus


@pytest.fixture
def storage():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "boundary_test.db")
    s = SpatialStorage(db_path=db_path)
    yield s
    if os.path.exists(db_path):
        os.remove(db_path)


def test_active_plot_eligible_for_allowance(storage):
    benchmarks = generate_synthetic_benchmark_suite()
    res = storage.register_and_classify_plot(benchmarks["base_plot"], plot_id="PLOT-ACTIVE-001")
    assert res.status.value == "ACTIVE"

    boundary = AllowanceServiceBoundary(storage)
    payload = boundary.prepare_on_chain_registration_payload(
        OnChainAllowanceRequest(
            plot_id="PLOT-ACTIVE-001",
            season_id=2026,
            crop_code_str="SOY",
            approved_allowance_kg=3000,
            allowance_evidence_hash="0x" + "a" * 64
        )
    )

    assert payload["plot_id"] == "PLOT-ACTIVE-001"
    assert payload["approvedAllowanceKg"] == 3000
    assert payload["plotIdBytes32"].startswith("0x")


def test_pending_review_plot_blocked_from_allowance(storage):
    benchmarks = generate_synthetic_benchmark_suite()
    storage.register_and_classify_plot(benchmarks["base_plot"], plot_id="PLOT-BASE-001")
    
    # Ambiguous plot is held in PENDING_REVIEW
    res_amb = storage.register_and_classify_plot(benchmarks["partial_overlap_plot"], plot_id="PLOT-AMB-002")
    assert res_amb.status.value == "PENDING_REVIEW"

    boundary = AllowanceServiceBoundary(storage)
    with pytest.raises(PermissionError, match="has an unresolved ambiguous spatial match and is currently PENDING_REVIEW"):
        boundary.prepare_on_chain_registration_payload(
            OnChainAllowanceRequest(
                plot_id="PLOT-AMB-002",
                season_id=2026,
                crop_code_str="SOY",
                approved_allowance_kg=3000,
                allowance_evidence_hash="0x" + "a" * 64
            )
        )


def test_flagged_duplicate_plot_blocked_from_allowance(storage):
    benchmarks = generate_synthetic_benchmark_suite()
    storage.register_and_classify_plot(benchmarks["base_plot"], plot_id="PLOT-BASE-001")

    # Jittered plot is flagged as duplicate
    res_dup = storage.register_and_classify_plot(benchmarks["jittered_plot"], plot_id="PLOT-DUP-003")
    assert res_dup.status.value == "FLAGGED_DUPLICATE"

    boundary = AllowanceServiceBoundary(storage)
    with pytest.raises(PermissionError, match="Duplicate parcels are strictly prohibited"):
        boundary.prepare_on_chain_registration_payload(
            OnChainAllowanceRequest(
                plot_id="PLOT-DUP-003",
                season_id=2026,
                crop_code_str="SOY",
                approved_allowance_kg=3000,
                allowance_evidence_hash="0x" + "a" * 64
            )
        )


def test_adjudicated_separate_plot_can_then_receive_allowance(storage):
    benchmarks = generate_synthetic_benchmark_suite()
    storage.register_and_classify_plot(benchmarks["base_plot"], plot_id="PLOT-BASE-001")
    res_amb = storage.register_and_classify_plot(benchmarks["partial_overlap_plot"], plot_id="PLOT-AMB-004")

    # Adjudicate as legitimate separate parcel
    storage.adjudicate_review(
        review_id=res_amb.review_id,
        action=ReviewStatus.APPROVED_SEPARATE_PARCEL,
        operator_id="OP-SUPERVISOR",
        justification="Verified physical survey markers and historical land title."
    )

    boundary = AllowanceServiceBoundary(storage)
    payload = boundary.prepare_on_chain_registration_payload(
        OnChainAllowanceRequest(
            plot_id="PLOT-AMB-004",
            season_id=2026,
            crop_code_str="SOY",
            approved_allowance_kg=5000,
            allowance_evidence_hash="0x" + "b" * 64
        )
    )

    assert payload["plot_id"] == "PLOT-AMB-004"
    assert payload["approvedAllowanceKg"] == 5000
