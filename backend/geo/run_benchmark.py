"""
Executable Evaluation Script for SilvaPass Geospatial Identity Resolution.

Compares:
1. Exact Geometry Hashing alone (SHA-256 of coordinate JSON).
2. SilvaPass Spatial Matching Engine (Shapely + pyproj + H3 candidate indexing + 4-tier policy).

Outputs:
- Actual Precision, Recall, False Positives (FP), False Negatives (FN), and F1-score.
- Explicit disclosure of matching thresholds and policy version.
"""
import json
import hashlib
import tempfile
import os
import random
from typing import Dict, Any, List, Tuple

from backend.geo.validator import validate_geojson_geometry
from backend.geo.synthetic_benchmarks import generate_synthetic_benchmark_suite
from backend.storage.spatial_db import SpatialStorage
from backend.geo.models import PlotStatus, MatchClassification, POLICY_VERSION
from backend.geo.matcher import IOU_EXACT_THRESHOLD, IOU_DUPLICATE_THRESHOLD, IOU_AMBIGUOUS_LOWER_THRESHOLD


def run_evaluation():
    print("=" * 80)
    print("SILVAPASS GEOSPATIAL IDENTITY RESOLUTION EVALUATION")
    print(f"Policy Version: {POLICY_VERSION}")
    print(f"Configured Thresholds: Exact IoU >= {IOU_EXACT_THRESHOLD:.3f} | Duplicate IoU >= {IOU_DUPLICATE_THRESHOLD:.2f} | Ambiguous IoU >= {IOU_AMBIGUOUS_LOWER_THRESHOLD:.2f}")
    print("=" * 80)

    benchmarks = generate_synthetic_benchmark_suite()
    base_plot = benchmarks["base_plot"]

    # Ground Truth Duplicate / Near-Duplicate Alterations (Label = POSITIVE DUPLICATE)
    duplicate_test_cases = [
        ("Exact Duplicate", benchmarks["exact_duplicate_plot"]),
        ("Reversed Coordinate Sequence", benchmarks["reversed_plot"]),
        ("Shifted Polygon (~15m offset)", benchmarks["shifted_plot"]),
        ("Small Coordinate Jitter (GPS Noise ~3-5m)", benchmarks["jittered_plot"]),
        ("Rotated Polygon (2 deg around centroid)", benchmarks["rotated_plot"]),
        ("Densified / Altered Intermediate Vertices", benchmarks["densified_plot"]),
    ]

    # Ground Truth Legitimate Independent / Adjacent Plots (Label = NEGATIVE NON-DUPLICATE)
    non_duplicate_test_cases = [
        ("Adjacent Farm (Shared Eastern Fence Line)", benchmarks["adjacent_plot"]),
        ("Distant Independent Farm (5 km away)", benchmarks["distinct_plot"]),
    ]

    # --- METHOD 1: NAIVE EXACT GEOMETRY HASH MATCHING ---
    print("\n--- METHOD 1: EXACT GEOMETRY HASH MATCHING ---")
    base_raw_bytes = json.dumps(base_plot["coordinates"]).encode("utf-8")
    base_hash = hashlib.sha256(base_raw_bytes).hexdigest()

    tp_hash = 0
    fn_hash = 0
    fp_hash = 0
    tn_hash = 0

    print(f"Base plot raw hash: {base_hash[:16]}...")
    for name, geom in duplicate_test_cases:
        h = hashlib.sha256(json.dumps(geom["coordinates"]).encode("utf-8")).hexdigest()
        is_match = (h == base_hash)
        if is_match:
            tp_hash += 1
            status = "MATCH (TP)"
        else:
            fn_hash += 1
            status = "MISSED (FN)"
        print(f"  [Duplicate Case] {name:<42} -> {status} (hash: {h[:16]}...)")

    for name, geom in non_duplicate_test_cases:
        h = hashlib.sha256(json.dumps(geom["coordinates"]).encode("utf-8")).hexdigest()
        is_match = (h == base_hash)
        if is_match:
            fp_hash += 1
            status = "FALSE ALARM (FP)"
        else:
            tn_hash += 1
            status = "CORRECT DISTINCT (TN)"
        print(f"  [Distinct Case]  {name:<42} -> {status} (hash: {h[:16]}...)")

    recall_hash = tp_hash / (tp_hash + fn_hash) if (tp_hash + fn_hash) > 0 else 0.0
    precision_hash = tp_hash / (tp_hash + fp_hash) if (tp_hash + fp_hash) > 0 else 0.0
    f1_hash = 2 * (precision_hash * recall_hash) / (precision_hash + recall_hash) if (precision_hash + recall_hash) > 0 else 0.0

    print(f"\nExact Hash Metrics:")
    print(f"  True Positives (TP):  {tp_hash} / {len(duplicate_test_cases)}")
    print(f"  False Negatives (FN): {fn_hash} / {len(duplicate_test_cases)} (Laundering undetected)")
    print(f"  False Positives (FP): {fp_hash} / {len(non_duplicate_test_cases)}")
    print(f"  True Negatives (TN):  {tn_hash} / {len(non_duplicate_test_cases)}")
    print(f"  Recall:    {recall_hash:.2%}")
    print(f"  Precision: {precision_hash:.2%}")
    print(f"  F1-Score:  {f1_hash:.4f}")

    # --- METHOD 2: SILVAPASS SPATIAL ENGINE ---
    print("\n--- METHOD 2: SILVAPASS SPATIAL SIMILARITY ENGINE ---")
    tmp_db_path = os.path.join(tempfile.gettempdir(), f"silvapass_eval_{random.randint(10000, 99999)}.db")
    storage = SpatialStorage(db_path=tmp_db_path)

    # 1. Register Base Reference Plot
    res_base = storage.register_and_classify_plot(base_plot, plot_id="PLOT-REF-BASE")
    print(f"Base plot registered. Canonical fingerprint: {res_base.canonical_fingerprint[:16]}... (Status: {res_base.status.value})")

    tp_silva = 0
    fn_silva = 0
    fp_silva = 0
    tn_silva = 0

    for name, geom in duplicate_test_cases:
        res = storage.register_and_classify_plot(geom, plot_id=f"TEST-DUP-{random.randint(1000, 9999)}")
        # Check if caught as duplicate
        if res.status == PlotStatus.FLAGGED_DUPLICATE:
            tp_silva += 1
            status = f"DETECTED DUPLICATE (TP) [{res.classification.value}]"
        else:
            fn_silva += 1
            status = f"MISSED (FN) [{res.classification.value}]"
        
        ev = res.similarity_evidence[0] if res.similarity_evidence else None
        iou_str = f"IoU={ev.iou:.2%}" if ev else "IoU=N/A"
        drift_str = f"drift={ev.centroid_distance_m}m" if ev else ""
        print(f"  [Duplicate Case] {name:<42} -> {status} ({iou_str}, {drift_str})")

    for name, geom in non_duplicate_test_cases:
        res = storage.register_and_classify_plot(geom, plot_id=f"TEST-DIST-{random.randint(1000, 9999)}")
        if res.status == PlotStatus.ACTIVE:
            tn_silva += 1
            status = f"ACCEPTED DISTINCT (TN) [{res.classification.value}]"
        else:
            fp_silva += 1
            status = f"FALSE ALARM (FP) [{res.classification.value}]"
        
        ev = res.similarity_evidence[0] if res.similarity_evidence else None
        iou_str = f"IoU={ev.iou:.2%}" if ev else "IoU=0.0%"
        print(f"  [Distinct Case]  {name:<42} -> {status} ({iou_str})")

    # Ambiguous review queue check
    res_amb = storage.register_and_classify_plot(benchmarks["partial_overlap_plot"], plot_id="TEST-AMB-OVERLAP")
    print(f"  [Ambiguous Case] Partial Overlap (~40%)                     -> QUEUED FOR REVIEW [{res_amb.classification.value}] (Review ID: {res_amb.review_id})")

    recall_silva = tp_silva / (tp_silva + fn_silva) if (tp_silva + fn_silva) > 0 else 0.0
    precision_silva = tp_silva / (tp_silva + fp_silva) if (tp_silva + fp_silva) > 0 else 0.0
    f1_silva = 2 * (precision_silva * recall_silva) / (precision_silva + recall_silva) if (precision_silva + recall_silva) > 0 else 0.0

    print(f"\nSilvaPass Spatial Engine Metrics:")
    print(f"  True Positives (TP):  {tp_silva} / {len(duplicate_test_cases)}")
    print(f"  False Negatives (FN): {fn_silva} / {len(duplicate_test_cases)}")
    print(f"  False Positives (FP): {fp_silva} / {len(non_duplicate_test_cases)}")
    print(f"  True Negatives (TN):  {tn_silva} / {len(non_duplicate_test_cases)}")
    print(f"  Recall:    {recall_silva:.2%}")
    print(f"  Precision: {precision_silva:.2%}")
    print(f"  F1-Score:  {f1_silva:.4f}")

    if os.path.exists(tmp_db_path):
        os.remove(tmp_db_path)

    print("\n" + "=" * 80)
    print("HEAD-TO-HEAD COMPARISON SUMMARY")
    print("-" * 80)
    print(f"Method                     | Recall    | Precision | False Positives | F1-Score")
    print(f"Exact Geometry Hash        | {recall_hash:>8.2%} | {precision_hash:>8.2%} | {fp_hash:>15} | {f1_hash:>8.4f}")
    print(f"SilvaPass Spatial Engine   | {recall_silva:>8.2%} | {precision_silva:>8.2%} | {fp_silva:>15} | {f1_silva:>8.4f}")
    print("=" * 80)


if __name__ == "__main__":
    run_evaluation()
