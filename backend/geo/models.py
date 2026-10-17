"""
Geospatial Data Models, Enums, and Policy Settings for SilvaPass Identity Resolution.
"""
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


POLICY_VERSION = "2026.1-strict-review"


class MatchClassification(str, Enum):
    EXACT_MATCH = "EXACT_MATCH"          # IoU >= 0.99 or identical canonical geometry fingerprint
    LIKELY_DUPLICATE = "LIKELY_DUPLICATE"  # High overlap (IoU >= 0.85); flagged as candidate duplicate
    AMBIGUOUS = "AMBIGUOUS"                # 0.05 <= IoU < 0.85; uncertain/adjacent conflict requiring human review
    DISTINCT = "DISTINCT"                  # IoU < 0.05; negligible spatial overlap, distinct parcel


class PlotStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PENDING_REVIEW = "PENDING_REVIEW"
    FLAGGED_DUPLICATE = "FLAGGED_DUPLICATE"
    REVOKED = "REVOKED"


class ReviewStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED_DUPLICATE = "CONFIRMED_DUPLICATE"
    APPROVED_SEPARATE_PARCEL = "APPROVED_SEPARATE_PARCEL"


class GeometryTransformationRecord(BaseModel):
    step: str
    details: str
    vertex_count_before: int
    vertex_count_after: int


class GeometryValidationResult(BaseModel):
    is_valid: bool
    geom_type: str
    vertex_count: int
    geodesic_area_ha: float
    geodesic_perimeter_m: float
    canonical_wkt: str
    canonical_fingerprint: str  # SHA-256 of normalized WKT
    h3_indices_res8: List[str] = Field(default_factory=list)
    h3_indices_res10: List[str] = Field(default_factory=list)
    transformations: List[GeometryTransformationRecord] = Field(default_factory=list)
    error_message: Optional[str] = None


class SimilarityEvidence(BaseModel):
    candidate_plot_id: str
    iou: float
    area_ratio: float  # min(area1, area2) / max(area1, area2)
    centroid_distance_m: float
    hausdorff_distance_m: float
    boundary_length_delta_m: float
    shared_h3_res8_count: int
    classification: MatchClassification
    policy_version: str = POLICY_VERSION
    explanation: str


class PlotRegistrationResult(BaseModel):
    plot_id: str
    status: PlotStatus
    classification: MatchClassification
    canonical_fingerprint: str
    geodesic_area_ha: float
    review_id: Optional[str] = None
    similarity_evidence: List[SimilarityEvidence] = Field(default_factory=list)
    policy_version: str = POLICY_VERSION
    message: str


class AdjudicationRequest(BaseModel):
    action: ReviewStatus
    operator_id: str
    justification: str = Field(min_length=15, description="Auditable operator rationale")
