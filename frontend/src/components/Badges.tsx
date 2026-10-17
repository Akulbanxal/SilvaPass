import React from "react";
import type { ProvenanceType, DeforestationRisk, PlotStatus } from "../types";

export const ProvenanceBadge: React.FC<{ type: ProvenanceType }> = ({ type }) => {
  const styles: Record<ProvenanceType, { bg: string; text: string; label: string }> = {
    MEASURED: { bg: "bg-[#e8f5e9]", text: "text-[#1b5e20]", label: "[MEASURED] On-Ground Cadastre" },
    EXTERNAL_VERIFIED: { bg: "bg-[#e0f2fe]", text: "text-[#0369a1]", label: "[EXTERNAL_VERIFIED] Official API" },
    CACHED_SNAPSHOT: { bg: "bg-[#f1f5f9]", text: "text-[#475569]", label: "[CACHED_SNAPSHOT] Pinned Benchmark" },
    SIMULATED: { bg: "bg-[#fef3c7]", text: "text-[#92400e]", label: "[SIMULATED] Test Fixture" },
    UNRESOLVED_UNCERTAINTY: { bg: "bg-[#fee2e2]", text: "text-[#b91c1c]", label: "[UNCERTAINTY] Missing / Cloud Cover" },
  };

  const current = styles[type] || styles.UNRESOLVED_UNCERTAINTY;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${current.bg} ${current.text}`}>
      {current.label}
    </span>
  );
};

export const RiskBadge: React.FC<{ risk: DeforestationRisk }> = ({ risk }) => {
  const styles: Record<DeforestationRisk, { bg: string; text: string }> = {
    LOW_RISK: { bg: "bg-[#dcfce7]", text: "text-[#166534]" },
    HIGH_RISK: { bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
    MORE_INFO_NEEDED: { bg: "bg-[#fef9c3]", text: "text-[#854d0e]" },
    UNAVAILABLE: { bg: "bg-[#f1f5f9]", text: "text-[#64748b]" },
  };

  const current = styles[risk] || styles.UNAVAILABLE;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${current.bg} ${current.text}`}>
      {risk.replace(/_/g, " ")}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: PlotStatus | string }> = ({ status }) => {
  const map: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: "bg-[#dcfce7]", text: "text-[#166534]" },
    PENDING_REVIEW: { bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
    FLAGGED_DUPLICATE: { bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
    REVOKED: { bg: "bg-[#f1f5f9]", text: "text-[#475569]" },
    CONFIRMED: { bg: "bg-[#dcfce7]", text: "text-[#166534]" },
    REJECTED_OVER_ALLOCATION: { bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
  };

  const current = map[status] || { bg: "bg-gray-100", text: "text-gray-700" };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${current.bg} ${current.text}`}>
      {status}
    </span>
  );
};
