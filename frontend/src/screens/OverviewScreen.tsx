import React from "react";

export const OverviewScreen: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-[#e2e8e0] shadow-sm space-y-4">
        <h2 className="text-xl font-bold text-[#081c15] tracking-tight">
          SilvaPass: Evidence-Backed Plot-Identity &amp; Shipment-Integrity Protocol
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          SilvaPass is an evidence-backed protocol developed for the <strong>IEEE ClimateChain Global Hackathon 2026</strong>.
          It solves two foundational integrity challenges in global agricultural trade:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-[#f8faf9] border border-[#e2e8e0] rounded">
            <h3 className="text-sm font-bold text-[#1b4332] flex items-center gap-1.5">
              <span>1. Geospatial Plot Identity Resolution</span>
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Traditional systems rely on exact coordinate hashing, allowing bad actors to bypass deduplication by slightly jittering or altering vertices (coordinate laundering).
              SilvaPass evaluates continuous planar and geodesic similarity (IoU, Hausdorff distance, centroid drift), routing ambiguous overlaps to human operators rather than silently merging land.
            </p>
          </div>

          <div className="p-4 bg-[#f8faf9] border border-[#e2e8e0] rounded">
            <h3 className="text-sm font-bold text-[#1b4332] flex items-center gap-1.5">
              <span>2. Shared On-Chain Claim Invariant</span>
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Maintains an immutable shared balance using EVM smart contracts. Enforces the invariant:
              <br />
              <code className="text-[11px] font-bold text-[#081c15] block my-1">
                NetClaims (Accepted - Released) &le; ApprovedAllowance
              </code>
              Attempts to over-allocate capacity are rejected on-chain without mutating balances.
            </p>
          </div>
        </div>

        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
          <h4 className="font-bold uppercase tracking-wider text-[11px]">Protocol Boundaries &amp; Explicit Non-Claims</h4>
          <p>
            &bull; SilvaPass provides verifiable cryptographic evidence within its participating ecosystem; it does <strong>not</strong> legally guarantee EUDR compliance or replace sovereign customs authorities.
          </p>
          <p>
            &bull; It does <strong>not</strong> prevent double-claims conducted through separate, unlinked third-party registries.
          </p>
          <p>
            &bull; Raw land coordinates and private commercial invoices remain strictly off-chain to protect farmer privacy.
          </p>
        </div>
      </div>
    </div>
  );
};
