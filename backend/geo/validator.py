"""
Geospatial Input Validation, Canonicalization, and Geodesic Calculations.
Uses Shapely 2.0 for planar topology, pyproj Geod for geodesic area and perimeter measurements,
and H3 for spatial candidate indexing.
"""
import math
import hashlib
from typing import Dict, Any, List, Tuple, Optional
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.validation import explain_validity
import shapely
import pyproj
import h3

from backend.geo.models import GeometryValidationResult, GeometryTransformationRecord

# Initialize WGS84 Geodesic Calculator from pyproj
GEOD = pyproj.Geod(ellps="WGS84")

# Complexity boundaries
MAX_VERTICES_ALLOWED = 10000
MAX_PERMITTED_AREA_HA = 50000.0  # 50,000 hectares (~500 sq km, prevents continent-sized inputs)
MIN_PERMITTED_AREA_HA = 0.0001   # 1 sq meter


def calculate_geodesic_polygon_properties(geom) -> Tuple[float, float]:
    """
    Computes exact WGS84 geodesic area (in hectares) and geodesic perimeter (in meters)
    using pyproj.Geod. Supports Polygon and MultiPolygon.
    """
    if geom.is_empty:
        return 0.0, 0.0

    total_area_m2 = 0.0
    total_perimeter_m = 0.0

    polygons = [geom] if isinstance(geom, Polygon) else (geom.geoms if isinstance(geom, MultiPolygon) else [])

    for poly in polygons:
        if poly.exterior and len(poly.exterior.coords) >= 4:
            lons, lats = zip(*poly.exterior.coords)
            area_m2, perim_m = GEOD.polygon_area_perimeter(lons, lats)
            total_area_m2 += abs(area_m2)
            total_perimeter_m += abs(perim_m)

            # Deduct interiors (holes)
            for interior in poly.interiors:
                i_lons, i_lats = zip(*interior.coords)
                i_area, i_perim = GEOD.polygon_area_perimeter(i_lons, i_lats)
                total_area_m2 -= abs(i_area)
                total_perimeter_m += abs(i_perim)

    area_ha = max(0.0, total_area_m2 / 10000.0)
    return round(area_ha, 4), round(total_perimeter_m, 2)


def remove_consecutive_duplicate_vertices(ring: List[Tuple[float, float]]) -> Tuple[List[Tuple[float, float]], int]:
    """
    Safely deduplicates consecutive identical vertices on a ring without mutating the boundary.
    Returns the cleaned ring and the count of duplicates removed.
    """
    if not ring:
        return [], 0

    cleaned = [ring[0]]
    removed_count = 0

    for pt in ring[1:]:
        if pt[0] == cleaned[-1][0] and pt[1] == cleaned[-1][1]:
            removed_count += 1
        else:
            cleaned.append(pt)

    # Ensure closure
    if len(cleaned) > 1 and cleaned[0] != cleaned[-1]:
        cleaned.append(cleaned[0])

    return cleaned, removed_count


def canonicalize_geometry(geom) -> Tuple[str, str]:
    """
    Normalizes a geometry into canonical WKT and generates a stable SHA-256 fingerprint:
    - Normalizes polygon winding order (exterior CCW, interior CW)
    - Sorts sub-geometries deterministically
    - Rounds coordinates to 6 decimal places (~0.1m precision)
    """
    normalized = shapely.normalize(geom)
    wkt_str = shapely.to_wkt(normalized, rounding_precision=6)
    fingerprint = hashlib.sha256(wkt_str.encode("utf-8")).hexdigest()
    return wkt_str, fingerprint


def compute_h3_indices(geom, resolution: int = 8) -> List[str]:
    """
    Computes H3 discrete global grid cells covering the polygon boundary and centroid.
    Supports both H3 v4 and H3 v3.
    """
    try:
        bounds = geom.bounds  # (min_lon, min_lat, max_lon, max_lat)
        min_lon, min_lat, max_lon, max_lat = bounds

        sample_points = [
            (geom.centroid.y, geom.centroid.x),
            (min_lat, min_lon),
            (min_lat, max_lon),
            (max_lat, min_lon),
            (max_lat, max_lon),
        ]

        if hasattr(geom, "exterior") and geom.exterior:
            for coord in list(geom.exterior.coords)[:30]:
                sample_points.append((coord[1], coord[0]))
        elif hasattr(geom, "geoms"):
            for subgeom in geom.geoms:
                if hasattr(subgeom, "exterior") and subgeom.exterior:
                    for coord in list(subgeom.exterior.coords)[:15]:
                        sample_points.append((coord[1], coord[0]))

        cells = set()
        to_cell_fn = getattr(h3, "latlng_to_cell", getattr(h3, "geo_to_h3", None))
        if not to_cell_fn:
            return []

        for lat, lon in sample_points:
            if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
                cell = to_cell_fn(lat, lon, resolution)
                cells.add(str(cell))

        return sorted(list(cells))
    except Exception:
        return []


def validate_geojson_geometry(geojson_geom: Dict[str, Any]) -> GeometryValidationResult:
    """
    Validates a GeoJSON Polygon or MultiPolygon with strict integrity rules:
    1. Supported types: Polygon, MultiPolygon only.
    2. Coordinate order: [longitude, latitude] in WGS84 range: lon in [-180, 180], lat in [-90, 90].
    3. Rejects non-finite (NaN, Inf) and empty coordinates.
    4. Enforces ring closure and minimum 4 points.
    5. Normalizes consecutive duplicate vertices with an auditable transformation record.
    6. Checks complexity limits (max vertices, max area).
    7. Evaluates topological validity via Shapely (rejects self-intersections, bow-ties).
    8. Calculates geodesic area and perimeter via pyproj.
    9. Generates canonical WKT, SHA-256 fingerprint, and H3 spatial index cells.
    """
    transformations: List[GeometryTransformationRecord] = []

    if not isinstance(geojson_geom, dict):
        return GeometryValidationResult(
            is_valid=False,
            geom_type="UNKNOWN",
            vertex_count=0,
            geodesic_area_ha=0.0,
            geodesic_perimeter_m=0.0,
            canonical_wkt="",
            canonical_fingerprint="",
            error_message="Geometry payload must be a JSON dictionary."
        )

    geom_type = geojson_geom.get("type", "")
    if geom_type not in ["Polygon", "MultiPolygon"]:
        return GeometryValidationResult(
            is_valid=False,
            geom_type=geom_type,
            vertex_count=0,
            geodesic_area_ha=0.0,
            geodesic_perimeter_m=0.0,
            canonical_wkt="",
            canonical_fingerprint="",
            error_message=f"Unsupported geometry type '{geom_type}'. Only 'Polygon' and 'MultiPolygon' are supported."
        )

    raw_coords = geojson_geom.get("coordinates")
    if not raw_coords or not isinstance(raw_coords, list):
        return GeometryValidationResult(
            is_valid=False,
            geom_type=geom_type,
            vertex_count=0,
            geodesic_area_ha=0.0,
            geodesic_perimeter_m=0.0,
            canonical_wkt="",
            canonical_fingerprint="",
            error_message="Coordinates array is missing, null, or empty."
        )

    # Coordinate validation & vertex cleanup helper
    def validate_and_clean_ring(ring_coords) -> Tuple[Optional[List[Tuple[float, float]]], Optional[str], int]:
        if not isinstance(ring_coords, list) or len(ring_coords) < 4:
            return None, "Ring must contain at least 4 coordinates (including closure).", 0

        # Check closure before cleaning
        if ring_coords[0] != ring_coords[-1]:
            return None, "Polygon ring is unclosed: first coordinate must match last coordinate.", 0

        parsed_pts = []
        for pt in ring_coords:
            if not isinstance(pt, (list, tuple)) or len(pt) < 2:
                return None, "Each coordinate element must contain [longitude, latitude].", 0
            lon, lat = pt[0], pt[1]
            if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
                return None, f"Non-numeric coordinate detected: ({lon}, {lat}).", 0
            if math.isnan(lon) or math.isnan(lat) or math.isinf(lon) or math.isinf(lat):
                return None, f"Non-finite coordinate (NaN or Inf) detected: ({lon}, {lat}).", 0
            if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
                return None, f"Coordinate out of WGS84 bounds: lon={lon} (expected [-180, 180]), lat={lat} (expected [-90, 90]).", 0
            parsed_pts.append((float(lon), float(lat)))

        cleaned_pts, removed_dups = remove_consecutive_duplicate_vertices(parsed_pts)
        if len(cleaned_pts) < 4:
            return None, "Ring has fewer than 4 unique vertices after deduplication.", removed_dups

        return cleaned_pts, None, removed_dups

    cleaned_geojson_coords = []
    total_vertices = 0

    if geom_type == "Polygon":
        cleaned_rings = []
        for r_idx, ring in enumerate(raw_coords):
            c_ring, err, removed_dups = validate_and_clean_ring(ring)
            if err:
                return GeometryValidationResult(
                    is_valid=False,
                    geom_type=geom_type,
                    vertex_count=0,
                    geodesic_area_ha=0.0,
                    geodesic_perimeter_m=0.0,
                    canonical_wkt="",
                    canonical_fingerprint="",
                    error_message=f"Polygon ring {r_idx} invalid: {err}"
                )
            if removed_dups > 0:
                transformations.append(GeometryTransformationRecord(
                    step="Deduplicate consecutive vertices",
                    details=f"Removed {removed_dups} consecutive duplicate vertices in ring {r_idx}.",
                    vertex_count_before=len(ring),
                    vertex_count_after=len(c_ring)
                ))
            cleaned_rings.append(c_ring)
            total_vertices += len(c_ring)
        cleaned_geojson_coords = cleaned_rings

    elif geom_type == "MultiPolygon":
        cleaned_polys = []
        for p_idx, poly_coords in enumerate(raw_coords):
            if not isinstance(poly_coords, list):
                return GeometryValidationResult(
                    is_valid=False,
                    geom_type=geom_type,
                    vertex_count=0,
                    geodesic_area_ha=0.0,
                    geodesic_perimeter_m=0.0,
                    canonical_wkt="",
                    canonical_fingerprint="",
                    error_message=f"MultiPolygon component {p_idx} has invalid structure."
                )
            cleaned_rings = []
            for r_idx, ring in enumerate(poly_coords):
                c_ring, err, removed_dups = validate_and_clean_ring(ring)
                if err:
                    return GeometryValidationResult(
                        is_valid=False,
                        geom_type=geom_type,
                        vertex_count=0,
                        geodesic_area_ha=0.0,
                        geodesic_perimeter_m=0.0,
                        canonical_wkt="",
                        canonical_fingerprint="",
                        error_message=f"MultiPolygon {p_idx} ring {r_idx} invalid: {err}"
                    )
                if removed_dups > 0:
                    transformations.append(GeometryTransformationRecord(
                        step="Deduplicate consecutive vertices",
                        details=f"Removed {removed_dups} consecutive duplicate vertices in part {p_idx} ring {r_idx}.",
                        vertex_count_before=len(ring),
                        vertex_count_after=len(c_ring)
                    ))
                cleaned_rings.append(c_ring)
                total_vertices += len(c_ring)
            cleaned_polys.append(cleaned_rings)
        cleaned_geojson_coords = cleaned_polys

    if total_vertices > MAX_VERTICES_ALLOWED:
        return GeometryValidationResult(
            is_valid=False,
            geom_type=geom_type,
            vertex_count=total_vertices,
            geodesic_area_ha=0.0,
            geodesic_perimeter_m=0.0,
            canonical_wkt="",
            canonical_fingerprint="",
            error_message=f"Geometry complexity exceeded: vertex count {total_vertices} exceeds limit of {MAX_VERTICES_ALLOWED}."
        )

    # Ingest into Shapely
    try:
        cleaned_geojson = {"type": geom_type, "coordinates": cleaned_geojson_coords}
        geom = shape(cleaned_geojson)
    except Exception as e:
        return GeometryValidationResult(
            is_valid=False,
            geom_type=geom_type,
            vertex_count=total_vertices,
            geodesic_area_ha=0.0,
            geodesic_perimeter_m=0.0,
            canonical_wkt="",
            canonical_fingerprint="",
            error_message=f"Shapely geometry construction error: {str(e)}"
        )

    # Topological validity check (rejects self-intersections, bow-ties)
    if not geom.is_valid:
        invalid_reason = explain_validity(geom)
        return GeometryValidationResult(
            is_valid=False,
            geom_type=geom_type,
            vertex_count=total_vertices,
            geodesic_area_ha=0.0,
            geodesic_perimeter_m=0.0,
            canonical_wkt="",
            canonical_fingerprint="",
            error_message=f"Topologically invalid polygon: {invalid_reason}"
        )

    if geom.is_empty:
        return GeometryValidationResult(
            is_valid=False,
            geom_type=geom_type,
            vertex_count=total_vertices,
            geodesic_area_ha=0.0,
            geodesic_perimeter_m=0.0,
            canonical_wkt="",
            canonical_fingerprint="",
            error_message="Geometry is empty."
        )

    # Calculate exact geodesic area and perimeter via pyproj
    area_ha, perim_m = calculate_geodesic_polygon_properties(geom)

    if area_ha < MIN_PERMITTED_AREA_HA:
        return GeometryValidationResult(
            is_valid=False,
            geom_type=geom_type,
            vertex_count=total_vertices,
            geodesic_area_ha=area_ha,
            geodesic_perimeter_m=perim_m,
            canonical_wkt="",
            canonical_fingerprint="",
            error_message=f"Degenerate polygon: geodesic area {area_ha} ha is effectively zero (< 1 m^2)."
        )

    if area_ha > MAX_PERMITTED_AREA_HA:
        return GeometryValidationResult(
            is_valid=False,
            geom_type=geom_type,
            vertex_count=total_vertices,
            geodesic_area_ha=area_ha,
            geodesic_perimeter_m=perim_m,
            canonical_wkt="",
            canonical_fingerprint="",
            error_message=f"Excessive parcel area: {area_ha} ha exceeds maximum threshold of {MAX_PERMITTED_AREA_HA} ha."
        )

    # Canonicalize geometry
    canonical_wkt, canonical_fp = canonicalize_geometry(geom)

    # H3 candidate indexing
    h3_res8 = compute_h3_indices(geom, resolution=8)
    h3_res10 = compute_h3_indices(geom, resolution=10)

    return GeometryValidationResult(
        is_valid=True,
        geom_type=geom_type,
        vertex_count=total_vertices,
        geodesic_area_ha=area_ha,
        geodesic_perimeter_m=perim_m,
        canonical_wkt=canonical_wkt,
        canonical_fingerprint=canonical_fp,
        h3_indices_res8=h3_res8,
        h3_indices_res10=h3_res10,
        transformations=transformations,
        error_message=None
    )
