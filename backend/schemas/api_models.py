"""
Unified Pydantic API Schemas for SilvaPass REST Service.
"""
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.geo.models import (
    MatchClassification,
    PlotStatus,
    ReviewStatus,
    SimilarityEvidence,
    GeometryTransformationRecord
)


class ProvenanceType(str, Enum):
    MEASURED = "MEASURED"
    EXTERNAL_VERIFIED = "EXTERNAL_VERIFIED"
    CACHED_SNAPSHOT = "CACHED_SNAPSHOT"
    SIMULATED = "SIMULATED"
    UNRESOLVED_UNCERTAINTY = "UNRESOLVED_UNCERTAINTY"


class DeforestationRisk(str, Enum):
    LOW_RISK = "LOW_RISK"
    HIGH_RISK = "HIGH_RISK"
    MORE_INFO_NEEDED = "MORE_INFO_NEEDED"
    UNAVAILABLE = "UNAVAILABLE"


class ClaimOnChainStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED_OVER_ALLOCATION = "REJECTED_OVER_ALLOCATION"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"


# --- Plot Schemas ---

class PlotValidationRequest(BaseModel):
    geometry: Dict[str, Any] = Field(description="GeoJSON Polygon or MultiPolygon")


class PlotValidationResponse(BaseModel):
    is_valid: bool
    geom_type: str
    vertex_count: int
    geodesic_area_ha: float
    geodesic_perimeter_m: float
    canonical_wkt: str
    canonical_fingerprint: str
    h3_indices_res8: List[str]
    transformations: List[GeometryTransformationRecord] = Field(default_factory=list)
    error_message: Optional[str] = None


class PlotRegistrationRequest(BaseModel):
    plot_id: Optional[str] = None
    geometry: Dict[str, Any] = Field(description="GeoJSON Polygon or MultiPolygon")
    country_code: str = Field(default="BR", min_length=2, max_length=2)
    crop_code: str = Field(default="SOY", min_length=2, max_length=16)


class PlotRegistrationResponse(BaseModel):
    plot_id: str
    status: PlotStatus
    classification: MatchClassification
    canonical_fingerprint: str
    geodesic_area_ha: float
    review_id: Optional[str] = None
    similarity_evidence: List[SimilarityEvidence] = Field(default_factory=list)
    policy_version: str
    message: str


# --- Spatial Review Schemas ---

class SpatialReviewItem(BaseModel):
    review_id: str
    submitted_plot_id: str
    conflicting_plot_id: str
    iou: float
    centroid_distance_m: float
    status: ReviewStatus
    evidence: Optional[Dict[str, Any]] = None
    operator_id: Optional[str] = None
    justification: Optional[str] = None
    created_at: str
    adjudicated_at: Optional[str] = None


class AdjudicateReviewRequest(BaseModel):
    action: ReviewStatus
    operator_id: str = Field(min_length=3)
    justification: str = Field(min_length=15, description="Auditable operator rationale")


# --- Allowance Schemas ---

class GrantAllowanceRequest(BaseModel):
    plot_id: str
    season_id: int = Field(ge=2020, le=2050)
    crop_code: str = Field(min_length=2, max_length=16)
    approved_allowance_kg: int = Field(gt=0)
    evidence_document_hash: str = Field(min_length=64, max_length=66)


class AdjustAllowanceRequest(BaseModel):
    new_approved_allowance_kg: int = Field(gt=0)
    reason: str = Field(min_length=10)


class RevokeAllowanceRequest(BaseModel):
    reason: str = Field(min_length=10)


class AllowanceResponse(BaseModel):
    allowance_id: str
    plot_id: str
    canonical_plot_hash: str
    season_id: int
    crop_code: str
    approved_allowance_kg: int
    claimed_kg: int
    releasedKg: int
    remaining_allowance_kg: int
    status: str
    tx_hash: Optional[str] = None


# --- Shipment Document & AI Extraction Schemas ---

class ExtractedFieldDetail(BaseModel):
    value: Optional[Any] = None
    source_snippet: Optional[str] = Field(default=None, description="Exact substring from raw document text")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score 0.0 to 1.0")
    is_ambiguous: bool = Field(default=False, description="Flagged if multiple conflicting values or units found")
    notes: Optional[str] = None


class ExtractedDocumentFields(BaseModel):
    document_type: str = Field(default="BILL_OF_LADING", description="BILL_OF_LADING, INVOICE, PHYTOSANITARY_CERT, HARVEST_RECORD")
    commodity_code: str = Field(description="Normalized commodity identifier (e.g. SOY, COCOA, COFFEE, PALM)")
    shipment_quantity: int = Field(gt=0, description="Integer numeric quantity in declared units")
    quantity_unit: str = Field(default="KG", description="Standard unit (KG, MT, LBS, BAGS)")
    declared_weight_kg: int = Field(gt=0, description="Normalized weight in integer kilograms")
    referenced_plot_id: Optional[str] = Field(default=None, description="Cadastral plot identifier cited in document")
    production_season: int = Field(default=2026, description="Production harvest season year")
    shipment_identifier: str = Field(description="Bill of lading, invoice number or consignment tracking ID")
    consignor_name: str = Field(default="", description="Shipper / seller legal entity name")
    consignee_name: str = Field(default="", description="Consignee / buyer legal entity name")
    shipment_date: str = Field(default="", description="Document issuance / shipment date YYYY-MM-DD")
    field_evidence: Dict[str, ExtractedFieldDetail] = Field(
        default_factory=dict,
        description="Source text snippets, confidence, and ambiguity flags per field"
    )
    missing_fields: List[str] = Field(default_factory=list, description="Mandatory fields that could not be extracted")
    ambiguous_fields: List[str] = Field(default_factory=list, description="Fields with conflicting or low-confidence values")


class DocumentExtractionRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    raw_document_text: str = Field(min_length=10, max_length=500000, description="Raw document text bounded to 500KB to prevent payload DoS")
    provider_override: Optional[str] = Field(default=None, max_length=64, description="RULE_BASED, OPENAI, ANTHROPIC, GEMINI")


class DocumentExtractionResponse(BaseModel):
    document_id: str
    file_hash_sha256: str
    extraction_source: str = Field(description="RULE_BASED_EXTRACTOR, OPENAI_API, ANTHROPIC_API, GEMINI_API")
    status: str = Field(default="PENDING_CONFIRMATION", description="PENDING_CONFIRMATION, CONFIRMED, or REJECTED")
    extracted_fields: ExtractedDocumentFields
    confidence_score: float = Field(ge=0.0, le=1.0)
    requires_user_confirmation: bool = Field(
        default=True,
        description="Strict policy: AI and rule extracts MUST be confirmed by a human officer before claim submission"
    )
    warnings: List[str] = Field(default_factory=list)
    message: str


class DocumentConfirmationRequest(BaseModel):
    operator_id: str = Field(min_length=3, max_length=128)
    confirmed_fields: ExtractedDocumentFields
    notes: Optional[str] = Field(default=None, max_length=1000)


# --- Shipment Claim Schemas ---

class ClaimSubmissionRequest(BaseModel):
    claim_id: str = Field(min_length=8, max_length=128, description="Unique shipment claim identifier")
    plot_id: str = Field(min_length=1, max_length=128)
    season_id: int = Field(ge=2020, le=2050)
    claimed_kg: int = Field(gt=0, le=1000000000)
    document_id: Optional[str] = Field(default=None, max_length=128)
    shipment_evidence_hash: str = Field(min_length=64, max_length=66)


class ClaimReleaseRequest(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)



class ClaimResponse(BaseModel):
    claim_id: str
    plot_id: str
    season_id: int
    claimed_kg: int
    status: ClaimOnChainStatus
    remaining_capacity_kg: Optional[int] = None
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    message: str


# --- Environmental Screening Schemas ---

class EnvironmentalScreeningRequest(BaseModel):
    plot_id: str
    mode: Optional[str] = Field(default=None, description="LIVE, SNAPSHOT, or SIMULATION")


class ConvergenceIndicators(BaseModel):
    forest_overlap_pct: float = Field(description="Percentage overlap with baseline forest canopy (JRC 2020 / Hansen)")
    post_cutoff_disturbances: int = Field(description="Detected tree cover loss events occurring post-2020-12-31")
    commodity_detected: bool = Field(description="Whether agricultural commodity footprint is detected in land-use layers")
    cutoff_date: str = "2020-12-31"
    # Specific WHISP indicators
    ind_01_mapped_forest: Optional[bool] = Field(default=None, description="Whisp Ind_01: Mapped forest presence")
    ind_02_commodity_map: Optional[bool] = Field(default=None, description="Whisp Ind_02: Documented commodity mapping overlap")
    ind_03_disturbance_before_2020: Optional[bool] = Field(default=None, description="Whisp Ind_03: Historical disturbance prior to 2020-12-31")
    ind_04_recent_disturbance: Optional[bool] = Field(default=None, description="Whisp Ind_04: Disturbance events detected post-2020-12-31")


class EnvironmentalScreeningResponse(BaseModel):
    screening_id: str
    plot_id: str
    service_name: str
    deforestation_risk: DeforestationRisk
    cutoff_date: str
    indicators: ConvergenceIndicators
    provenance: ProvenanceType
    source_digest: str
    is_cached_snapshot: bool
    timestamp: str
    # Realistic operational fields from FAO WHISP
    source_identifier: str = Field(default="FAO_OPEN_FORIS_WHISP", description="Identifies provider and API endpoint")
    assessment_status: str = Field(default="COMPLETED", description="Assessment processing status: COMPLETED, UNCERTAIN, or FAILED")
    datasets_used: List[str] = Field(default_factory=list, description="Global EO datasets examined (e.g. JRC GFC 2020, GLAD dist alerts)")
    warnings: List[str] = Field(default_factory=list, description="Operational warnings or processing notices")
    uncertainty_reasons: List[str] = Field(default_factory=list, description="Known evidence gaps, resolution limits, or cloud cover notices")
    legal_disclaimer: str = Field(
        default="This screening is a remote-sensing risk assessment, NOT a legal determination of EUDR compliance or legality.",
        description="Statutory non-guarantee disclaimer"
    )


# --- Evidence Report Schemas ---

class EvidenceItem(BaseModel):
    title: str
    claim_type: str
    digest_sha256: str
    provenance: ProvenanceType
    details: Dict[str, Any]


class EvidenceReportResponse(BaseModel):
    report_id: str
    plot_id: str
    canonical_plot_hash: str
    season_id: int
    claim_id: Optional[str] = None
    on_chain_tx_hash: Optional[str] = None
    root_evidence_bundle_hash: str
    evidence_items: List[EvidenceItem]
    system_boundary_disclaimer: str
    generated_at: str
