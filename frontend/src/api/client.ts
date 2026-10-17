import type {
  PlotValidationResponse,
  PlotRegistrationResponse,
  PlotRecord,
  SpatialReviewItem,
  AllowanceResponse,
  DocumentExtractionResponse,
  ExtractedFields,
  ClaimResponse,
  EnvironmentalScreeningResponse,
  EvidenceReportResponse,
  ReviewStatus,
} from "../types";

const BASE_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorMsg = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {
        // Fallback to text
      }
      throw new Error(errorMsg);
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Network request failed");
  }
}

// 1. Health
export function checkHealth() {
  return request<{ status: string; service: string; environment: string; whisp_mode: string }>("/health");
}

// 2. Plots
export function validatePlot(geometry: Record<string, any>) {
  return request<PlotValidationResponse>("/api/v1/plots/validate", {
    method: "POST",
    body: JSON.stringify({ geometry }),
  });
}

export function registerPlot(params: { plot_id?: string; geometry: Record<string, any>; country_code?: string; crop_code?: string }) {
  return request<PlotRegistrationResponse>("/api/v1/plots/register", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function getPlot(plotId: string) {
  return request<PlotRecord>(`/api/v1/plots/${plotId}`);
}

export function listPlots(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<PlotRecord[]>(`/api/v1/plots${query}`);
}

// 3. Reviews
export function listPendingReviews() {
  return request<SpatialReviewItem[]>("/api/v1/reviews/pending");
}

export function adjudicateReview(reviewId: string, action: ReviewStatus, operatorId: string, justification: string) {
  return request<{ review_id: string; new_plot_status: string; justification: string }>(`/api/v1/reviews/${reviewId}/adjudicate`, {
    method: "POST",
    body: JSON.stringify({ action, operator_id: operatorId, justification }),
  });
}

// 4. Allowances
export function grantAllowance(params: { plot_id: string; season_id: number; crop_code: string; approved_allowance_kg: number; evidence_document_hash: string }) {
  return request<AllowanceResponse>("/api/v1/allowances/grant", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function getAllowance(plotId: string, seasonId: number) {
  return request<AllowanceResponse>(`/api/v1/allowances/${plotId}/${seasonId}`);
}

// 5. Shipment Documents
export function extractDocument(fileName: string, rawDocumentText: string) {
  return request<DocumentExtractionResponse>("/api/v1/documents/extract", {
    method: "POST",
    body: JSON.stringify({ file_name: fileName, raw_document_text: rawDocumentText }),
  });
}

export function confirmDocument(documentId: string, operatorId: string, confirmedFields: ExtractedFields) {
  return request<{ status: string; confirmed_fields: ExtractedFields }>(`/api/v1/documents/${documentId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ operator_id: operatorId, confirmed_fields: confirmedFields }),
  });
}

// 6. Shipment Claims
export function submitClaim(params: { claim_id: string; plot_id: string; season_id: number; claimed_kg: number; shipment_evidence_hash: string; document_id?: string }) {
  return request<ClaimResponse>("/api/v1/claims/submit", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function releaseClaim(claimId: string, reason: string) {
  return request<ClaimResponse>(`/api/v1/claims/${claimId}/release`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function listClaims(plotId?: string, seasonId?: number) {
  const params = new URLSearchParams();
  if (plotId) params.append("plot_id", plotId);
  if (seasonId) params.append("season_id", seasonId.toString());
  const qs = params.toString() ? `?${params.toString()}` : "";
  return request<ClaimResponse[]>(`/api/v1/claims${qs}`);
}

export function getBlockchainStatus() {
  return request<{
    connected: boolean;
    rpc_url: string;
    chain_id?: number;
    block_number?: number;
    contract_address?: string;
    contract_deployed?: boolean;
    mode: "LIVE_EVM" | "FALLBACK_SIMULATED";
    message: string;
  }>("/api/v1/blockchain/status");
}

// 7. Environmental Screening
export function screenPlot(plotId: string, mode?: string) {
  return request<EnvironmentalScreeningResponse>("/api/v1/screening/whisp", {
    method: "POST",
    body: JSON.stringify({ plot_id: plotId, mode }),
  });
}

// 8. Evidence Report
export function getEvidenceReport(plotId: string, seasonId = 2026, claimId?: string) {
  const query = claimId ? `?season_id=${seasonId}&claim_id=${claimId}` : `?season_id=${seasonId}`;
  return request<EvidenceReportResponse>(`/api/v1/evidence/report/${plotId}${query}`);
}

