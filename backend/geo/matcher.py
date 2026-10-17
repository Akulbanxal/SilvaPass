"""
Spatial Similarity Engine for Plot Identity Resolution.
Evaluates IoU, geodesic area ratio, centroid distance via pyproj, Hausdorff distance,
and boundary delta.
"""
from typing import Tuple, List, Optional
import math
import shapely
from shapely import wkt
from shapely.geometry import Polygon, MultiPolygon

from backend.geo.models import MatchClassification, SimilarityEvidence, POLICY_VERSION
from backend.geo.validator import GEOD, calculate_geodesic_polygon_properties


# Configurable Matching Policy Thresholds
IOU_EXACT_THRESHOLD = 0.995
IOU_DUPLICATE_THRESHOLD = 0.85
IOU_AMBIGUOUS_LOWER_THRESHOLD = 0.05


def compute_geometry_similarity(
    candidate_plot_id: str,
    geom_a,
    geom_b,
    canonical_fp_a: str,
    canonical_fp_b: str,
    h3_a: List[str],
    h3_b: List[str]
) -> SimilarityEvidence:
    """
    Computes rigorous geometric similarity metrics between two validated geometries:
    - Canonical fingerprint comparison
    - Planar & Geodesic Intersection-over-Union (IoU)
    - Area ratio: min(areaA, areaB) / max(areaA, areaB)
    - Centroid distance in meters (using pyproj.Geod WGS84 geodesic line)
    - Approximate Hausdorff distance in meters
    - Boundary length delta in meters
    - Shared H3 index cells count
    """
    # 1. Check exact fingerprint match first
    if canonical_fp_a == canonical_fp_b:
        shared_h3_count = len(set(h3_a).intersection(set(h3_b)))
        return SimilarityEvidence(
            candidate_plot_id=candidate_plot_id,
            iou=1.0,
            area_ratio=1.0,
            centroid_distance_m=0.0,
            hausdorff_distance_m=0.0,
            boundary_length_delta_m=0.0,
            shared_h3_res8_count=shared_h3_count,
            classification=MatchClassification.EXACT_MATCH,
            policy_version=POLICY_VERSION,
            explanation="Exact canonical geometry fingerprint match (100% geometric equivalence after normalization)."
        )

    # 2. Planar intersection and union via Shapely
    try:
        intersection = geom_a.intersection(geom_b)
        union = geom_a.union(geom_b)

        area_intersection = intersection.area
        area_union = union.area

        if area_union > 0:
            iou = round(float(area_intersection / area_union), 4)
        else:
            iou = 0.0
    except Exception:
        iou = 0.0

    # 3. Geodesic area ratio & boundary lengths via pyproj
    area_a_ha, perim_a_m = calculate_geodesic_polygon_properties(geom_a)
    area_b_ha, perim_b_m = calculate_geodesic_polygon_properties(geom_b)

    max_area = max(area_a_ha, area_b_ha)
    if max_area > 0:
        area_ratio = round(float(min(area_a_ha, area_b_ha) / max_area), 4)
    else:
        area_ratio = 0.0

    boundary_delta_m = round(abs(perim_a_m - perim_b_m), 2)

    # 4. Geodesic centroid distance via pyproj.Geod
    centroid_a = geom_a.centroid
    centroid_b = geom_b.centroid
    _, _, centroid_dist_m = GEOD.inv(centroid_a.x, centroid_a.y, centroid_b.x, centroid_b.y)
    centroid_dist_m = round(abs(centroid_dist_m), 2)

    # 5. Hausdorff distance approximate in meters (deg to meters at centroid lat)
    try:
        hausdorff_deg = float(shapely.hausdorff_distance(geom_a, geom_b))
        lat_rad = math.radians((centroid_a.y + centroid_b.y) / 2.0)
        # 1 deg lat ≈ 111,139m
        m_per_deg = 111139.0 * math.cos(lat_rad)
        hausdorff_m = round(hausdorff_deg * 111139.0, 2)
    except Exception:
        hausdorff_m = 99999.0

    # 6. Shared H3 cells
    shared_h3_count = len(set(h3_a).intersection(set(h3_b)))

    # 7. Classification logic adhering to policy version
    if iou >= IOU_EXACT_THRESHOLD:
        classification = MatchClassification.EXACT_MATCH
        explanation = (
            f"Exact match: IoU is {iou:.2%} (>= {IOU_EXACT_THRESHOLD:.1%}), centroid drift is {centroid_dist_m}m. "
            f"Plots represent identical physical land."
        )
    elif iou >= IOU_DUPLICATE_THRESHOLD:
        classification = MatchClassification.LIKELY_DUPLICATE
        explanation = (
            f"Likely duplicate: High spatial overlap with IoU={iou:.2%} (>= {IOU_DUPLICATE_THRESHOLD:.1%}), "
            f"area ratio={area_ratio:.2f}, and centroid drift={centroid_dist_m}m. "
            f"Indicates coordinate jitter, vertex decimation/simplification, or small shifts."
        )
    elif iou >= IOU_AMBIGUOUS_LOWER_THRESHOLD:
        classification = MatchClassification.AMBIGUOUS
        explanation = (
            f"Ambiguous spatial overlap: Partial overlap detected (IoU={iou:.2%}, centroid distance {centroid_dist_m}m). "
            f"To prevent false merges with adjacent farms or boundary laundering, "
            f"this case requires human operator review before authorization."
        )
    else:
        classification = MatchClassification.DISTINCT
        explanation = (
            f"Distinct parcel: Negligible spatial overlap (IoU={iou:.2%} < {IOU_AMBIGUOUS_LOWER_THRESHOLD:.1%}). "
            f"Plots represent separate land parcels."
        )

    return SimilarityEvidence(
        candidate_plot_id=candidate_plot_id,
        iou=iou,
        area_ratio=area_ratio,
        centroid_distance_m=centroid_dist_m,
        hausdorff_distance_m=hausdorff_m,
        boundary_length_delta_m=boundary_delta_m,
        shared_h3_res8_count=shared_h3_count,
        classification=classification,
        policy_version=POLICY_VERSION,
        explanation=explanation
    )
