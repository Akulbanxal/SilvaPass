import React from "react";
import type { ProvenanceType, DeforestationRisk, PlotStatus } from "../types";

export const ProvenanceBadge: React.FC<{ type: ProvenanceType; className?: string }> = ({ type, className = "" }) => {
  const styles: Record<ProvenanceType, { bg: string; text: string; border: string; label: string }> = {
    MEASURED: {
      bg: "bg-[#16805D]/10",
      text: "text-[#16805D]",
      border: "border-[#16805D]/25",
      label: "MEASURED (Cadastre)",
    },
    EXTERNAL_VERIFIED: {
      bg: "bg-[#237A57]/10",
      text: "text-[#237A57]",
      border: "border-[#237A57]/25",
      label: "EXTERNAL VERIFIED",
    },
    CACHED_SNAPSHOT: {
      bg: "bg-slate-100",
      text: "text-[#65756C]",
      border: "border-[#DCE5DE]",
      label: "SNAPSHOT REFERENCE",
    },
    SIMULATED: {
      bg: "bg-[#B7791F]/10",
      text: "text-[#B7791F]",
      border: "border-[#B7791F]/30",
      label: "SIMULATED TEST DATA",
    },
    UNRESOLVED_UNCERTAINTY: {
      bg: "bg-[#B83A3A]/10",
      text: "text-[#B83A3A]",
      border: "border-[#B83A3A]/30",
      label: "UNCERTAIN / PENDING",
    },
  };

  const current = styles[type] || styles.UNRESOLVED_UNCERTAINTY;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${current.bg} ${current.text} ${current.border} ${className}`}
    >
      {current.label}
    </span>
  );
};

export const RiskBadge: React.FC<{ risk: DeforestationRisk; className?: string }> = ({ risk, className = "" }) => {
  const styles: Record<DeforestationRisk, { bg: string; text: string; border: string; label: string }> = {
    LOW_RISK: {
      bg: "bg-[#16805D]/10",
      text: "text-[#16805D]",
      border: "border-[#16805D]/30",
      label: "LOW RISK INDICATOR",
    },
    HIGH_RISK: {
      bg: "bg-[#B83A3A]/10",
      text: "text-[#B83A3A]",
      border: "border-[#B83A3A]/30",
      label: "CANOPY LOSS DETECTED",
    },
    MORE_INFO_NEEDED: {
      bg: "bg-[#B7791F]/10",
      text: "text-[#B7791F]",
      border: "border-[#B7791F]/30",
      label: "AMBIGUOUS / CLOUD COVER",
    },
    UNAVAILABLE: {
      bg: "bg-slate-100",
      text: "text-[#65756C]",
      border: "border-[#DCE5DE]",
      label: "SOURCE UNAVAILABLE",
    },
  };

  const current = styles[risk] || styles.UNAVAILABLE;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${current.bg} ${current.text} ${current.border} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {current.label}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: PlotStatus | string; className?: string }> = ({
  status,
  className = "",
}) => {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    ACTIVE: {
      bg: "bg-[#16805D]/10",
      text: "text-[#16805D]",
      border: "border-[#16805D]/25",
    },
    PENDING_REVIEW: {
      bg: "bg-[#B7791F]/10",
      text: "text-[#B7791F]",
      border: "border-[#B7791F]/30",
    },
    FLAGGED_DUPLICATE: {
      bg: "bg-[#B83A3A]/10",
      text: "text-[#B83A3A]",
      border: "border-[#B83A3A]/30",
    },
    REVOKED: {
      bg: "bg-slate-100",
      text: "text-[#65756C]",
      border: "border-[#DCE5DE]",
    },
    CONFIRMED: {
      bg: "bg-[#16805D]/10",
      text: "text-[#16805D]",
      border: "border-[#16805D]/25",
    },
    ACCEPTED: {
      bg: "bg-[#16805D]/10",
      text: "text-[#16805D]",
      border: "border-[#16805D]/25",
    },
    RELEASED: {
      bg: "bg-[#237A57]/10",
      text: "text-[#237A57]",
      border: "border-[#237A57]/25",
    },
    REJECTED_OVER_ALLOCATION: {
      bg: "bg-[#B83A3A]/10",
      text: "text-[#B83A3A]",
      border: "border-[#B83A3A]/30",
    },
  };

  const current = map[status] || {
    bg: "bg-slate-100",
    text: "text-[#172820]",
    border: "border-[#DCE5DE]",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${current.bg} ${current.text} ${current.border} ${className}`}
    >
      {status}
    </span>
  );
};
