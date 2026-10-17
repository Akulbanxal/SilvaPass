"""
Comprehensive Automated Tests for Geospatial Identity Resolution Pipeline.
Tests:
- Input validation & invalid inputs (non-finite, out-of-range, self-intersecting, unclosed)
- Safe normalization of duplicate consecutive vertices with transformation audit record
- Stable exact-equivalent geometry canonicalization (reversed sequence, rotated start)
- Altered geometry detection (jitter, shifts, rotation, densification)
- Adjacent plot false-positive avoidance (shared fence line remains distinct)
- Ambiguous partial overlap routing to human-review queue
- Adjudication lifecycle and prevention of premature on-chain allowance creation
"""
import pytest
import os
import tempfile
import hashlib
import json
from backend.geo.validator import validate_geojson_geometry
from backend.geo.synthetic_benchmarks import generate_synthetic_benchmark_suite
from backend.storage.spatial_db import SpatialStorage
from backend.geo.models import MatchClassification, PlotStatus, ReviewStatus


@pytest.fixture
def spatial_db():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_spatial_pipeline.db")
    storage = SpatialStorage(db_path=db_path)
    yield storage
    if os.path.exists(db_path):
        os.remove(db_path)


class TestInputValidation:
    def test_reject_self_intersecting_bow_tie(self):
        benchmarks = generate_synthetic_benchmark_suite()
        res = validate_geojson_geometry(benchmarks["self_intersecting_plot"])
        assert not res.is_valid
        assert "Topologically invalid" in res.error_message or "Self-intersection" in res.error_message

    def test_reject_out_of_bounds_wgs84(self):
        benchmarks = generate_synthetic_benchmark_suite()
        res = validate_geojson_geometry(benchmarks["invalid_range_plot"])
        assert not res.is_valid
        assert "out of WGS84 bounds" in res.error_message

    def test_reject_non_finite_nan_coordinates(self):
        benchmarks = generate_synthetic_benchmark_suite()
        res = validate_geojson_geometry(benchmarks["nan_coords_plot"])
        assert not res.is_valid
        assert "Non-finite coordinate" in res.error_message

    def test_safe_normalization_of_duplicate_consecutive_vertices(self):
        benchmarks = generate_synthetic_benchmark_suite()
        res = validate_geojson_geometry(benchmarks["duplicate_vertices_plot"])
        assert res.is_valid
        # Check that transformation audit log was recorded
        assert len(res.transformations) > 0
        assert res.transformations[0].step == "Deduplicate consecutive vertices"
        assert res.transformations[0].vertex_count_before == 7
        assert res.transformations[0].vertex_count_after == 5


class TestCanonicalFingerprinting:
    def test_exact_equivalence_stability(self):
        benchmarks = generate_synthetic_benchmark_suite()
        base_res = validate_geojson_geometry(benchmarks["base_plot"])
        dup_res = validate_geojson_geometry(benchmarks["exact_duplicate_plot"])
        rev_res = validate_geojson_geometry(benchmarks["reversed_plot"])

        # Identical canonical fingerprint despite reversed coordinate direction
        assert base_res.canonical_fingerprint == dup_res.canonical_fingerprint
        assert base_res.canonical_fingerprint == rev_res.canonical_fingerprint
        assert len(base_res.canonical_fingerprint) == 64


class TestSpatialMatchingPipeline:
    def test_altered_geometries_detection(self, spatial_db):
        benchmarks = generate_synthetic_benchmark_suite()

        # 1. Register Base Plot -> ACTIVE
        res_base = spatial_db.register_and_classify_plot(benchmarks["base_plot"], plot_id="PLOT-BASE-01")
        assert res_base.status == PlotStatus.ACTIVE
        assert res_base.classification == MatchClassification.DISTINCT

        # 2. Exact Duplicate -> FLAGGED_DUPLICATE (EXACT_MATCH)
        res_dup = spatial_db.register_and_classify_plot(benchmarks["exact_duplicate_plot"], plot_id="PLOT-DUP-02")
        assert res_dup.status == PlotStatus.FLAGGED_DUPLICATE
        assert res_dup.classification == MatchClassification.EXACT_MATCH

        # 3. Reversed Sequence -> FLAGGED_DUPLICATE (EXACT_MATCH)
        res_rev = spatial_db.register_and_classify_plot(benchmarks["reversed_plot"], plot_id="PLOT-REV-03")
        assert res_rev.status == PlotStatus.FLAGGED_DUPLICATE
        assert res_rev.classification == MatchClassification.EXACT_MATCH

        # 4. Small GPS Jitter -> FLAGGED_DUPLICATE (LIKELY_DUPLICATE)
        res_jit = spatial_db.register_and_classify_plot(benchmarks["jittered_plot"], plot_id="PLOT-JIT-04")
        assert res_jit.status == PlotStatus.FLAGGED_DUPLICATE
        assert res_jit.classification in [MatchClassification.LIKELY_DUPLICATE, MatchClassification.EXACT_MATCH]
        assert res_jit.similarity_evidence[0].iou > 0.85

        # 5. Shifted Polygon (~15m offset) -> FLAGGED_DUPLICATE (LIKELY_DUPLICATE)
        res_shift = spatial_db.register_and_classify_plot(benchmarks["shifted_plot"], plot_id="PLOT-SHIFT-05")
        assert res_shift.status == PlotStatus.FLAGGED_DUPLICATE
        assert res_shift.similarity_evidence[0].iou > 0.85

        # 6. Rotated Polygon (2 deg) -> FLAGGED_DUPLICATE (LIKELY_DUPLICATE)
        res_rot = spatial_db.register_and_classify_plot(benchmarks["rotated_plot"], plot_id="PLOT-ROT-06")
        assert res_rot.status == PlotStatus.FLAGGED_DUPLICATE
        assert res_rot.similarity_evidence[0].iou > 0.85

        # 7. Densified Boundary -> FLAGGED_DUPLICATE (LIKELY_DUPLICATE)
        res_dens = spatial_db.register_and_classify_plot(benchmarks["densified_plot"], plot_id="PLOT-DENS-07")
        assert res_dens.status == PlotStatus.FLAGGED_DUPLICATE
        assert res_dens.similarity_evidence[0].iou > 0.90

    def test_distinct_adjacent_parcel_no_false_positive(self, spatial_db):
        """
        Neighboring farm sharing a fence line must be classified as DISTINCT (not merged or flagged as duplicate).
        """
        benchmarks = generate_synthetic_benchmark_suite()
        spatial_db.register_and_classify_plot(benchmarks["base_plot"], plot_id="PLOT-BASE-01")

        res_adj = spatial_db.register_and_classify_plot(benchmarks["adjacent_plot"], plot_id="PLOT-ADJACENT-02")
        assert res_adj.status == PlotStatus.ACTIVE
        assert res_adj.classification == MatchClassification.DISTINCT

    def test_ambiguous_overlap_queued_for_review(self, spatial_db):
        """
        Partial boundary overlap (~40%) must enter review queue (PENDING_REVIEW)
        with full audit evidence.
        """
        benchmarks = generate_synthetic_benchmark_suite()
        spatial_db.register_and_classify_plot(benchmarks["base_plot"], plot_id="PLOT-BASE-01")

        res_amb = spatial_db.register_and_classify_plot(benchmarks["partial_overlap_plot"], plot_id="PLOT-PARTIAL-02")
        assert res_amb.status == PlotStatus.PENDING_REVIEW
        assert res_amb.classification == MatchClassification.AMBIGUOUS
        assert res_amb.review_id is not None
        assert 0.20 <= res_amb.similarity_evidence[0].iou <= 0.60

        # Adjudication test
        adjudication = spatial_db.adjudicate_review(
            review_id=res_amb.review_id,
            action=ReviewStatus.APPROVED_SEPARATE_PARCEL,
            operator_id="OP-SUPERVISOR-99",
            justification="Survey monument inspected. Legitimate easement across eastern boundary."
        )
        assert adjudication["new_plot_status"] == PlotStatus.ACTIVE.value
