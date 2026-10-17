"""
Deterministic, clearly labeled synthetic geometry fixtures for geospatial identity resolution testing.
Fixtures include:
- Base reference plot (standard ~30 ha agricultural parcel)
- Exact duplicate
- Reversed coordinate sequence
- Shifted polygon (~15m coordinate offset)
- Small coordinate jitter (Gaussian GPS noise ~3-5m)
- Rotated polygon (~2 deg rotation around centroid)
- Simplified polygon (decimated vertices)
- Partial overlap (~40% area overlap)
- Distinct adjacent plots (shares fence boundary, zero interior overlap)
- Self-intersecting geometry (figure 8 bow-tie)
- Invalid coordinate order (out of range latitude/longitude)
- Non-finite coordinates (NaN)
- Duplicate consecutive vertices (safely normalizable)
"""
import math
import random
from typing import Dict, Any, List, Tuple


def _make_polygon(coords: List[Tuple[float, float]]) -> Dict[str, Any]:
    return {
        "type": "Polygon",
        "coordinates": [[list(c) for c in coords]]
    }


def generate_synthetic_benchmark_suite() -> Dict[str, Any]:
    """
    Returns synthetic fixtures with deterministic, reproducible coordinates.
    Base location: Realistic agricultural area in Mato Grosso, Brazil (-54.500000 lon, -12.500000 lat).
    """
    # Base Reference Plot: ~30 ha polygon (approx 550m x 550m)
    base_coords: List[Tuple[float, float]] = [
        (-54.500000, -12.500000),
        (-54.495000, -12.500000),
        (-54.495000, -12.495000),
        (-54.500000, -12.495000),
        (-54.500000, -12.500000)
    ]

    # 1. Exact Duplicate
    exact_duplicate_coords = list(base_coords)

    # 2. Reversed Coordinate Sequence (Counter-clockwise winding)
    reversed_coords = list(reversed(base_coords))

    # 3. Shifted Polygon (Shifted East by ~15 meters, ~0.00014 deg)
    shifted_coords = [
        (round(lon + 0.00014, 6), round(lat, 6))
        for lon, lat in base_coords
    ]

    # 4. Small Coordinate Jitter (Gaussian noise with seed 42, ~3-5 meters)
    rng = random.Random(42)
    jittered_coords = []
    for lon, lat in base_coords[:-1]:
        d_lon = (rng.random() - 0.5) * 0.00004
        d_lat = (rng.random() - 0.5) * 0.00004
        jittered_coords.append((round(lon + d_lon, 6), round(lat + d_lat, 6)))
    jittered_coords.append(jittered_coords[0])

    # 5. Rotated Polygon (~2 degrees rotation around centroid)
    cx, cy = -54.497500, -12.497500
    angle_rad = math.radians(2.0)
    rotated_coords = []
    for lon, lat in base_coords[:-1]:
        dx = lon - cx
        dy = lat - cy
        rx = cx + dx * math.cos(angle_rad) - dy * math.sin(angle_rad)
        ry = cy + dx * math.sin(angle_rad) + dy * math.cos(angle_rad)
        rotated_coords.append((round(rx, 6), round(ry, 6)))
    rotated_coords.append(rotated_coords[0])

    # 6. Simplified / Decimated Polygon (Midpoint vertices removed or added)
    densified_coords = [
        (-54.500000, -12.500000),
        (-54.497500, -12.500000),  # intermediate vertex
        (-54.495000, -12.500000),
        (-54.495000, -12.497500),  # intermediate vertex
        (-54.495000, -12.495000),
        (-54.500000, -12.495000),
        (-54.500000, -12.500000)
    ]

    # 7. Partial Overlap (~40% area overlap with base plot)
    partial_overlap_coords = [
        (-54.498000, -12.500000),
        (-54.493000, -12.500000),
        (-54.493000, -12.495000),
        (-54.498000, -12.495000),
        (-54.498000, -12.500000)
    ]

    # 8. Distinct Adjacent Plot (Shares east fence line, 0 interior overlap)
    adjacent_coords = [
        (-54.495000, -12.500000),
        (-54.490000, -12.500000),
        (-54.490000, -12.495000),
        (-54.495000, -12.495000),
        (-54.495000, -12.500000)
    ]

    # 9. Distinct Distant Plot (5 km to the west)
    distinct_coords = [
        (-54.550000, -12.500000),
        (-54.545000, -12.500000),
        (-54.545000, -12.495000),
        (-54.550000, -12.495000),
        (-54.550000, -12.500000)
    ]

    # 10. Self-Intersecting Polygon (Bow-tie / figure 8)
    self_intersecting_coords = [
        (-54.500000, -12.500000),
        (-54.495000, -12.495000),
        (-54.495000, -12.500000),
        (-54.500000, -12.495000),
        (-54.500000, -12.500000)
    ]

    # 11. Invalid Coordinate Range (Lat > 90 or Lon > 180)
    invalid_range_coords = [
        (-195.000000, -12.500000),
        (-54.495000, 95.000000),
        (-54.495000, -12.495000),
        (-54.500000, -12.495000),
        (-195.000000, -12.500000)
    ]

    # 12. Non-Finite Coordinate (NaN)
    nan_coords = [
        (-54.500000, -12.500000),
        (float("nan"), -12.500000),
        (-54.495000, -12.495000),
        (-54.500000, -12.495000),
        (-54.500000, -12.500000)
    ]

    # 13. Duplicate Consecutive Vertices (Normalizable)
    duplicate_vertices_coords = [
        (-54.500000, -12.500000),
        (-54.500000, -12.500000),  # duplicate point
        (-54.495000, -12.500000),
        (-54.495000, -12.495000),
        (-54.500000, -12.495000),
        (-54.500000, -12.495000),  # duplicate point
        (-54.500000, -12.500000)
    ]

    # 14. Vertex Simplification (Decimated vertices vs densified or complex base)
    simplified_coords = [
        (-54.500000, -12.500000),
        (-54.495000, -12.500000),
        (-54.495000, -12.495000),
        (-54.500000, -12.495000),
        (-54.500000, -12.500000)
    ]

    # 15. Different-size plots with nearby centroids (e.g. 1.2 ha subplot nested at centroid of ~30 ha base parcel)
    # Centroid of base plot is (-54.497500, -12.497500).
    # A small 1 ha plot centered at (-54.497500, -12.497500) has nearby centroid (drift ~ 0m) but area ratio ~ 1/30 = 0.033, IoU ~ 0.033
    nearby_small_subplot_coords = [
        (-54.498000, -12.498000),
        (-54.497000, -12.498000),
        (-54.497000, -12.497000),
        (-54.498000, -12.497000),
        (-54.498000, -12.498000)
    ]

    return {
        "base_plot": _make_polygon(base_coords),
        "exact_duplicate_plot": _make_polygon(exact_duplicate_coords),
        "reversed_plot": _make_polygon(reversed_coords),
        "shifted_plot": _make_polygon(shifted_coords),
        "jittered_plot": _make_polygon(jittered_coords),
        "rotated_plot": _make_polygon(rotated_coords),
        "densified_plot": _make_polygon(densified_coords),
        "simplified_plot": _make_polygon(simplified_coords),
        "partial_overlap_plot": _make_polygon(partial_overlap_coords),
        "adjacent_plot": _make_polygon(adjacent_coords),
        "distinct_plot": _make_polygon(distinct_coords),
        "different_size_nearby_plot": _make_polygon(nearby_small_subplot_coords),
        "self_intersecting_plot": _make_polygon(self_intersecting_coords),
        "invalid_range_plot": _make_polygon(invalid_range_coords),
        "nan_coords_plot": _make_polygon(nan_coords),
        "duplicate_vertices_plot": _make_polygon(duplicate_vertices_coords)
    }

