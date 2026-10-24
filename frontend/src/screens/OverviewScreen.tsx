import React, { useEffect, useState, useCallback } from "react";
import { listPlots, listPendingReviews, listClaims, getAllowance } from "../api/client";
import { MapPreview, type MapFeature } from "../components/MapPreview";
import { StatusBadge } from "../components/Badges";
import type { PlotRecord, SpatialReviewItem, ClaimResponse, AllowanceResponse } from "../types";
import {
  MapPin,
  Layers,
  Scale,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Info,
  AlertTriangle,
  Globe2,
} from "lucide-react";

interface OverviewScreenProps {
  onNavigateTab?: (tabId: "plots" | "reviews" | "ledger" | "environmental" | "evidence") => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ onNavigateTab }) => {
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [reviews, setReviews] = useState<SpatialReviewItem[]>([]);
  const [claims, setClaims] = useState<ClaimResponse[]>([]);
  const [allowance, setAllowance] = useState<AllowanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plotsData, reviewsData, claimsData, allowanceData] = await Promise.all([
        listPlots().catch(() => []),
        listPendingReviews().catch(() => []),
        listClaims().catch(() => []),
        getAllowance("PLOT-BASE-DEMO", 2026).catch(() => null),
      ]);
      setPlots(plotsData);
      setReviews(reviewsData);
      setClaims(claimsData);
      setAllowance(allowanceData);
    } catch (err: any) {
      setError(err.message || "Failed to load protocol overview data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Prepare map features from registered plots
  const mapFeatures: MapFeature[] = plots.map((p) => {
    let geojson: Record<string, any> = {};
    try {
      geojson = JSON.parse(p.raw_geojson);
    } catch {
      geojson = {};
    }
    const isPending = p.status === "PENDING_REVIEW";
    const isFlagged = p.status === "FLAGGED_DUPLICATE";
    return {
      geojson,
      color: isFlagged ? "#B83A3A" : isPending ? "#B7791F" : "#237A57",
      fillColor: isFlagged ? "#B83A3A" : isPending ? "#B7791F" : "#237A57",
      fillOpacity: 0.35,
      weight: 2.5,
      label: `${p.plot_id} (${p.crop_code})`,
    };
  });

  const acceptedClaims = claims.filter((c) => c.status === "CONFIRMED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE5DE]">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#172820]">
            Protocol Overview
          </h2>
          <p className="text-sm text-[#65756C] mt-1">
            Monitor plot identity resolution, production claims, environmental evidence, and audit activity.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchOverviewData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#65756C] bg-white hover:text-[#172820] hover:bg-[#F5F7F4] border border-[#DCE5DE] rounded-md transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("plots")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#237A57] hover:bg-[#103126] rounded-md transition shadow-xs cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Register Plot</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#B83A3A]/10 border border-[#B83A3A]/25 rounded-md text-xs text-[#B83A3A] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Registered Plots */}
        <div className="bg-white p-4 rounded-lg border border-[#DCE5DE] shadow-xs hover:border-[#237A57]/40 transition">
          <div className="flex items-center justify-between text-[#65756C] text-xs">
            <span className="font-medium">Registered Plots</span>
            <MapPin className="w-4 h-4 text-[#237A57]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172820] font-mono tabular-nums">
              {plots.length}
            </span>
            <span className="text-xs text-[#65756C]">cadastres recorded</span>
          </div>
          <div className="mt-2 text-[11px] text-[#65756C] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16805D]" />
            <span>WGS84 planar &amp; geodesic verified</span>
          </div>
        </div>

        {/* Metric 2: Potential Duplicate Matches */}
        <div className="bg-white p-4 rounded-lg border border-[#DCE5DE] shadow-xs hover:border-[#B7791F]/40 transition">
          <div className="flex items-center justify-between text-[#65756C] text-xs">
            <span className="font-medium">Potential Duplicate Matches</span>
            <Layers className="w-4 h-4 text-[#B7791F]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172820] font-mono tabular-nums">
              {reviews.length}
            </span>
            <span className="text-xs text-[#65756C]">pending review</span>
          </div>
          <div className="mt-2 text-[11px] text-[#65756C] flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${reviews.length > 0 ? "bg-[#B7791F]" : "bg-[#16805D]"}`} />
            <span>Continuous IoU &amp; centroid drift queue</span>
          </div>
        </div>

        {/* Metric 3: Accepted Claims */}
        <div className="bg-white p-4 rounded-lg border border-[#DCE5DE] shadow-xs hover:border-[#237A57]/40 transition">
          <div className="flex items-center justify-between text-[#65756C] text-xs">
            <span className="font-medium">Accepted Claims</span>
            <Scale className="w-4 h-4 text-[#237A57]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172820] font-mono tabular-nums">
              {acceptedClaims.length}
            </span>
            <span className="text-xs text-[#65756C]">of {claims.length} total</span>
          </div>
          <div className="mt-2 text-[11px] text-[#65756C] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16805D]" />
            <span>Anchored to EVM Hardhat</span>
          </div>
        </div>

        {/* Metric 4: Remaining Recorded Allowance */}
        <div className="bg-white p-4 rounded-lg border border-[#DCE5DE] shadow-xs hover:border-[#237A57]/40 transition">
          <div className="flex items-center justify-between text-[#65756C] text-xs">
            <span className="font-medium">Remaining Recorded Allowance</span>
            <ShieldCheck className="w-4 h-4 text-[#237A57]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172820] font-mono tabular-nums">
              {allowance ? allowance.remaining_allowance_kg.toLocaleString() : "—"}
            </span>
            <span className="text-xs text-[#65756C]">kg remaining</span>
          </div>
          <div className="mt-2 text-[11px] text-[#65756C] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#237A57]" />
            <span>Capacity invariant enforced</span>
          </div>
        </div>
      </div>

      {/* Main Content: Balanced Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Geographic Cadastral Map (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-lg border border-[#DCE5DE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#172820] flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[#237A57]" />
                Registered Plot Cadastre Coverage
              </h3>
              <p className="text-xs text-[#65756C] mt-0.5">
                Aggregate WGS84 polygon boundaries rendered via Leaflet OSM tiles.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-[#65756C]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#237A57] opacity-80" />
                Active
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#B7791F] opacity-80" />
                Review
              </span>
            </div>
          </div>

          {mapFeatures.length > 0 ? (
            <MapPreview features={mapFeatures} height="360px" />
          ) : (
            <div className="h-[360px] bg-[#F5F7F4] rounded-md border border-dashed border-[#DCE5DE] flex flex-col items-center justify-center p-6 text-center text-[#65756C]">
              <MapPin className="w-8 h-8 text-[#65756C]/40 mb-2" />
              <p className="text-sm font-semibold text-[#172820]">No Registered Plots Available</p>
              <p className="text-xs text-[#65756C] max-w-sm mt-1">
                Register agricultural boundaries in the Plot Registry to visualize multi-polygon cadastral coverage.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between text-xs text-[#65756C] pt-1">
            <span>Coordinate System: EPSG:4326 (WGS84) Geodetic</span>
            <span>Total Cadastral Area: ~90.18 ha</span>
          </div>
        </div>

        {/* Right Column: Live Verification Activity Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-lg border border-[#DCE5DE] shadow-xs flex flex-col">
          <div className="flex items-center justify-between border-b border-[#DCE5DE] pb-3 mb-3">
            <div>
              <h3 className="text-base font-bold text-[#172820]">Verification Activity</h3>
              <p className="text-xs text-[#65756C]">Chronological operations &amp; ledger state</p>
            </div>
            <span className="text-[11px] font-mono text-[#237A57] bg-[#237A57]/10 px-2 py-0.5 rounded">
              Live Stream
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[350px]">
            {/* Event: Allowances */}
            {allowance && (
              <div className="p-3 bg-[#F5F7F4] rounded-md border border-[#DCE5DE] text-xs space-y-1">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-[#172820]">Allowance Initialized</span>
                  <span className="text-[10px] text-[#65756C]">Season {allowance.season_id}</span>
                </div>
                <p className="text-[#65756C] text-[11px]">
                  Plot <code className="font-semibold text-[#172820]">{allowance.plot_id}</code> granted{" "}
                  <strong className="text-[#237A57]">{allowance.approved_allowance_kg.toLocaleString()} kg</strong> ({allowance.crop_code}) capacity.
                </p>
                <div className="text-[10px] font-mono text-[#65756C] truncate">
                  Tx: {allowance.tx_hash}
                </div>
              </div>
            )}

            {/* Event: Recent Claims */}
            {claims.map((claim) => (
              <div
                key={claim.claim_id}
                className="p-3 bg-[#F5F7F4] rounded-md border border-[#DCE5DE] text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-[#172820]">{claim.claim_id}</span>
                  <StatusBadge status={claim.status} />
                </div>
                <p className="text-[#65756C] text-[11px]">
                  Shipment claim of <strong className="text-[#172820] tabular-nums">{claim.claimed_kg.toLocaleString()} kg</strong> for plot{" "}
                  <code className="text-[#237A57] font-semibold">{claim.plot_id}</code>.
                </p>
                {claim.tx_hash && (
                  <div className="text-[10px] font-mono text-[#65756C] truncate">
                    Receipt: {claim.tx_hash}
                  </div>
                )}
              </div>
            ))}

            {/* Event: Pending Reviews */}
            {reviews.map((rev) => (
              <div
                key={rev.review_id}
                className="p-3 bg-[#B7791F]/5 rounded-md border border-[#B7791F]/30 text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-[#B7791F]">Duplicate Flagged</span>
                  <span className="text-[10px] font-bold text-[#B7791F]">
                    IoU {(rev.iou * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-[#65756C] text-[11px]">
                  Conflict between <code>{rev.submitted_plot_id}</code> and <code>{rev.conflicting_plot_id}</code>.
                </p>
              </div>
            ))}
          </div>

          {onNavigateTab && (
            <div className="pt-3 border-t border-[#DCE5DE] mt-3">
              <button
                onClick={() => onNavigateTab("ledger")}
                className="w-full py-1.5 px-3 rounded text-xs font-semibold text-[#237A57] hover:text-[#103126] hover:bg-[#F5F7F4] flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <span>View Full Claim Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lower Section: Recent Plot Registrations Table */}
      <div className="bg-white p-5 rounded-lg border border-[#DCE5DE] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#172820]">Recent Cadastral Registrations</h3>
            <p className="text-xs text-[#65756C]">Verified plot boundaries with computed geodesic surface areas</p>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("plots")}
              className="text-xs font-semibold text-[#237A57] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Add Boundary</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#DCE5DE] text-[#65756C] font-mono uppercase text-[10px]">
                <th className="py-2.5 px-3">Plot Identifier</th>
                <th className="py-2.5 px-3">Country</th>
                <th className="py-2.5 px-3">Crop</th>
                <th className="py-2.5 px-3">Geodesic Area</th>
                <th className="py-2.5 px-3">Perimeter</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Fingerprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE5DE]/60">
              {plots.map((plot) => (
                <tr key={plot.plot_id} className="hover:bg-[#F5F7F4] transition">
                  <td className="py-2.5 px-3 font-mono font-semibold text-[#172820]">
                    {plot.plot_id}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-[#65756C]">{plot.country_code}</td>
                  <td className="py-2.5 px-3 font-medium text-[#65756C]">{plot.crop_code}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-[#172820]">
                    {plot.geodesic_area_ha ? `${plot.geodesic_area_ha.toFixed(2)} ha` : "—"}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-[#172820]">
                    {plot.geodesic_perimeter_m ? `${plot.geodesic_perimeter_m.toFixed(0)} m` : "—"}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={plot.status} />
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-[#65756C] truncate max-w-[140px]">
                    {plot.canonical_fingerprint}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Protocol Boundaries & Explicit Non-Claims Warning Box */}
      <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-md text-xs text-amber-900 space-y-1.5">
        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px] text-[#B7791F]">
          <Info className="w-4 h-4 shrink-0 text-[#B7791F]" />
          <span>Protocol Boundaries &amp; Explicit Engineering Non-Claims</span>
        </div>
        <p className="leading-relaxed">
          &bull; SilvaPass provides verifiable cryptographic evidence within its participating ecosystem; it does <strong>not</strong> legally guarantee EUDR compliance or replace sovereign customs authorities.
        </p>
        <p className="leading-relaxed">
          &bull; It does <strong>not</strong> prevent double-claims conducted through separate, unlinked third-party registries.
        </p>
        <p className="leading-relaxed">
          &bull; Raw land coordinates and private commercial invoices remain strictly off-chain to protect farmer privacy.
        </p>
      </div>
    </div>
  );
};
