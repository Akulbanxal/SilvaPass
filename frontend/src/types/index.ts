export type PlotStatus = "ACTIVE" | "PENDING_REVIEW" | "FLAGGED_DUPLICATE" | "REVOKED";
export type MatchClassification = "EXACT_MATCH" | "LIKELY_DUPLICATE" | "AMBIGUOUS" | "DISTINCT";
export type ReviewStatus = "PENDING" | "CONFIRMED_DUPLICATE" | "APPROVED_SEPARATE_PARCEL";
export type ProvenanceType = "MEASURED" | "EXTERNAL_VERIFIED" | "CACHED_SNAPSHOT" | "SIMULATED" | "UNRESOLVED_UNCERTAINTY";
export type DeforestationRisk = "LOW_RISK" | "HIGH_RISK" | "MORE_INFO_NEEDED" | "UNAVAILABLE";
export type ClaimOnChainStatus = "PENDING" | "CONFIRMED" | "REJECTED_OVER_ALLOCATION" | "FAILED" | "UNKNOWN";

export interface GeometryTransformation {
  step: string;
  details: string;
  vertex_count_before: number;
  vertex_count_after: number;
}

export interface SimilarityEvidence {
  candidate_plot_id: string;
  iou: number;
  area_ratio: number;
  centroid_distance_m: number;
  hausdorff_distance_m: number;
  boundary_length_delta_m: number;
  shared_h3_res8_count: number;
  classification: MatchClassification;
  policy_version: string;
  explanation: string;
}

export interface PlotRecord {
  plot_id: string;
  canonical_fingerprint: string;
  canonical_wkt: string;
  raw_geojson: string;
  geom_type: string;
  geodesic_area_ha: number;
  geodesic_perimeter_m: number;
  vertex_count: number;
  country_code: string;
  crop_code: string;
  status: PlotStatus;
  created_at: string;
}

export interface PlotValidationResponse {
  is_valid: boolean;
  geom_type: string;
  vertex_count: number;
  geodesic_area_ha: number;
  geodesic_perimeter_m: number;
  canonical_wkt: string;
  canonical_fingerprint: string;
  h3_indices_res8: string[];
  transformations: GeometryTransformation[];
  error_message?: string;
}

export interface PlotRegistrationResponse {
  plot_id: string;
  status: PlotStatus;
  classification: MatchClassification;
  canonical_fingerprint: string;
  geodesic_area_ha: number;
  review_id?: string;
  similarity_evidence: SimilarityEvidence[];
  policy_version: string;
  message: string;
}

export interface SpatialReviewItem {
  review_id: string;
  submitted_plot_id: string;
  conflicting_plot_id: string;
  iou: number;
  centroid_distance_m: number;
  status: ReviewStatus;
  operator_id?: string;
  justification?: string;
  created_at: string;
  adjudicated_at?: string;
}

export interface AllowanceResponse {
  allowance_id: string;
  plot_id: string;
  canonical_plot_hash: string;
  season_id: number;
  crop_code: string;
  approved_allowance_kg: number;
  claimed_kg: number;
  releasedKg: number;
  remaining_allowance_kg: number;
  status: string;
  tx_hash?: string;
}

export interface ExtractedFieldDetail {
  value?: any;
  source_snippet?: string;
  confidence: number;
  is_ambiguous: boolean;
  notes?: string;
}

export interface ExtractedFields {
  document_type?: string;
  commodity_code: string;
  shipment_quantity?: number;
  quantity_unit?: string;
  declared_weight_kg: number;
  referenced_plot_id?: string | null;
  production_season?: number;
  shipment_identifier?: string;
  consignor_name: string;
  consignee_name: string;
  shipment_date: string;
  bill_of_lading_number?: string;
  field_evidence?: Record<string, ExtractedFieldDetail>;
  missing_fields?: string[];
  ambiguous_fields?: string[];
}

export interface DocumentExtractionResponse {
  document_id: string;
  file_hash_sha256: string;
  extraction_source: string;
  status: string;
  extracted_fields: ExtractedFields;
  confidence_score: number;
  requires_user_confirmation: boolean;
  warnings?: string[];
  message: string;
}

export interface ClaimResponse {
  claim_id: string;
  plot_id: string;
  season_id: number;
  claimed_kg: number;
  status: ClaimOnChainStatus;
  remaining_capacity_kg?: number;
  tx_hash?: string;
  block_number?: number;
  message: string;
}

export interface EnvironmentalScreeningResponse {
  screening_id: string;
  plot_id: string;
  service_name: string;
  deforestation_risk: DeforestationRisk;
  cutoff_date: string;
  indicators: {
    forest_overlap_pct: number;
    post_cutoff_disturbances: number;
    commodity_detected: boolean;
    cutoff_date: string;
    ind_01_mapped_forest?: boolean;
    ind_02_commodity_map?: boolean;
    ind_03_disturbance_before_2020?: boolean;
    ind_04_recent_disturbance?: boolean;
  };
  provenance: ProvenanceType;
  source_digest: string;
  is_cached_snapshot: boolean;
  timestamp: string;
  source_identifier?: string;
  assessment_status?: string;
  datasets_used?: string[];
  warnings?: string[];
  uncertainty_reasons?: string[];
  legal_disclaimer?: string;
}

export interface EvidenceItem {
  title: string;
  claim_type: string;
  digest_sha256: string;
  provenance: ProvenanceType;
  details: Record<string, any>;
}

export interface EvidenceReportResponse {
  report_id: string;
  plot_id: string;
  canonical_plot_hash: string;
  season_id: number;
  claim_id?: string;
  on_chain_tx_hash?: string;
  root_evidence_bundle_hash: string;
  evidence_items: EvidenceItem[];
  system_boundary_disclaimer: string;
  generated_at: string;
}
