import React, { useState } from "react";
import { screenPlot } from "../api/client";
import { RiskBadge, ProvenanceBadge } from "../components/Badges";
import type { EnvironmentalScreeningResponse } from "../types";
import {
  AlertTriangle,
  RefreshCw,
  Layers,
  Trees,
} from "lucide-react";

interface EnvironmentalScreeningScreenProps {
  activePlotId?: string;
}

export const EnvironmentalScreeningScreen: React.FC<EnvironmentalScreeningScreenProps> = ({
  activePlotId = "PLOT-BASE-DEMO",
}) => {
  const [plotId, setPlotId] = useState<string>(activePlotId);
  const [mode, setMode] = useState<string>("SNAPSHOT");
  const [result, setResult] = useState<EnvironmentalScreeningResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleScreenPlot = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await screenPlot(plotId, mode);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Environmental screening failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE5DE]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#172820]">
              Environmental Screening
            </h2>
            <span className="font-mono text-xs bg-[#103126] text-[#B6E986] px-2.5 py-0.5 rounded-full border border-[#237A57]">
              FAO Open Foris WHISP
            </span>
          </div>
          <p className="text-sm text-[#65756C] mt-1">
            Review available deforestation-risk indicators and the provenance of geographic assessments relative to the Dec 31, 2020 cutoff date.
          </p>
        </div>
      </div>

      {/* Screening Execution Form */}
      <div className="p-4 bg-white rounded-lg border border-[#DCE5DE] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#65756C]">Plot Identifier</label>
            <input
              type="text"
              value={plotId}
              onChange={(e) => setPlotId(e.target.value)}
              className="mt-0.5 text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#65756C]">Source Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="mt-0.5 text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
            >
              <option value="SNAPSHOT">SNAPSHOT (Pinned Benchmark Reference)</option>
              <option value="SIMULATION">SIMULATION (Deterministic Fallback)</option>
              <option value="LIVE">LIVE (Direct FAO WHISP API)</option>
            </select>
          </div>

          <div className="pt-4">
            <button
              onClick={handleScreenPlot}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[#237A57] hover:bg-[#103126] text-white transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Screening Canopy..." : "Execute Environmental Screening"}</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[#65756C]">
          Cutoff Threshold: <strong className="text-[#172820]">2020-12-31</strong>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#B83A3A]/10 border border-[#B83A3A]/25 rounded-md text-xs text-[#B83A3A] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Screening Outcome Results */}
      {result ? (
        <div className="bg-white p-6 rounded-lg border border-[#DCE5DE] shadow-xs space-y-5">
          {/* Top Result Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE5DE] pb-4">
            <div>
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#65756C]">
                Engine: {result.service_name}
              </span>
              <h3 className="text-xl font-bold text-[#172820] font-mono mt-0.5">
                {result.plot_id}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <RiskBadge risk={result.deforestation_risk} />
              <ProvenanceBadge type={result.provenance} />
            </div>
          </div>

          {/* 4 Core Indicators Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 bg-[#F5F7F4] rounded-lg border border-[#DCE5DE]">
              <span className="text-[11px] text-[#65756C]">Cutoff Date Threshold</span>
              <p className="font-mono font-bold text-[#172820] text-base mt-1">{result.cutoff_date}</p>
              <span className="text-[10px] text-[#65756C]">EUDR Statutory Cutoff</span>
            </div>

            <div className="p-3.5 bg-[#F5F7F4] rounded-lg border border-[#DCE5DE]">
              <span className="text-[11px] text-[#65756C]">Forest Canopy Overlap</span>
              <p className="font-mono font-bold text-[#172820] text-base mt-1 tabular-nums">
                {(result.indicators.forest_overlap_pct * 100).toFixed(1)}%
              </p>
              <span className="text-[10px] text-[#65756C]">Dec 2020 Baseline</span>
            </div>

            <div className="p-3.5 bg-[#F5F7F4] rounded-lg border border-[#DCE5DE]">
              <span className="text-[11px] text-[#65756C]">Post-2020 Canopy Loss</span>
              <p className="font-mono font-bold text-[#172820] text-base mt-1 tabular-nums">
                {result.indicators.post_cutoff_disturbances} alerts
              </p>
              <span className="text-[10px] text-[#65756C]">GLAD / Hansen signals</span>
            </div>

            <div className="p-3.5 bg-[#F5F7F4] rounded-lg border border-[#DCE5DE]">
              <span className="text-[11px] text-[#65756C]">Pre-Cutoff Commodity</span>
              <p className="font-mono font-bold text-[#237A57] text-base mt-1">
                {result.indicators.commodity_detected ? "Active (Verified)" : "Not Mapped"}
              </p>
              <span className="text-[10px] text-[#65756C]">MapBiomas Land Cover</span>
            </div>
          </div>

          {/* Open Foris WHISP Multi-Map Convergence Table */}
          {(result.indicators.ind_01_mapped_forest !== undefined ||
            result.indicators.ind_02_commodity_map !== undefined) && (
            <div className="p-4 bg-[#F5F7F4] rounded-lg border border-[#DCE5DE] space-y-2.5 text-xs">
              <div className="flex items-center justify-between font-bold text-[#172820] text-xs">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#237A57]" />
                  <span>Open Foris WHISP Convergence Indicators</span>
                </span>
                <span className="text-[11px] font-mono text-[#65756C]">Convergence of Evidence</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] pt-1">
                <div className="p-2 bg-white rounded border border-[#DCE5DE]">
                  <span className="text-[#65756C] block">Ind_01 Mapped Forest:</span>
                  <span className="font-mono font-bold text-[#172820]">
                    {result.indicators.ind_01_mapped_forest ? "True (Inside Canopy)" : "False (Outside)"}
                  </span>
                </div>
                <div className="p-2 bg-white rounded border border-[#DCE5DE]">
                  <span className="text-[#65756C] block">Ind_02 Commodity Map:</span>
                  <span className="font-mono font-bold text-[#172820]">
                    {result.indicators.ind_02_commodity_map ? "True (Pre-2020 Cropland)" : "False (Unmapped)"}
                  </span>
                </div>
                <div className="p-2 bg-white rounded border border-[#DCE5DE]">
                  <span className="text-[#65756C] block">Ind_03 Pre-2020 Disturbance:</span>
                  <span className="font-mono font-bold text-[#172820]">
                    {result.indicators.ind_03_disturbance_before_2020 ? "Detected" : "None"}
                  </span>
                </div>
                <div className="p-2 bg-white rounded border border-[#DCE5DE]">
                  <span className="text-[#65756C] block">Ind_04 Post-2020 Disturbance:</span>
                  <span className="font-mono font-bold text-[#172820]">
                    {result.indicators.ind_04_recent_disturbance ? "Detected" : "None"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Datasets Consulted */}
          {result.datasets_used && result.datasets_used.length > 0 && (
            <div className="text-xs space-y-1.5">
              <span className="text-[#65756C] font-semibold text-[11px] uppercase tracking-wider">
                Geospatial Datasets Consulted:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {result.datasets_used.map((ds) => (
                  <span
                    key={ds}
                    className="px-2.5 py-1 bg-[#F5F7F4] text-[#172820] rounded-md font-mono text-[11px] border border-[#DCE5DE]"
                  >
                    {ds}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings & Evidence Gaps */}
          {((result.warnings && result.warnings.length > 0) ||
            (result.uncertainty_reasons && result.uncertainty_reasons.length > 0)) && (
            <div className="p-3.5 bg-[#B7791F]/10 border border-[#B7791F]/30 rounded-md text-xs text-[#B7791F] space-y-1">
              <strong className="block text-[11px] uppercase tracking-wide">
                Evidence Limitations &amp; Operational Notes:
              </strong>
              {result.warnings?.map((w, idx) => (
                <div key={idx}>&bull; {w}</div>
              ))}
              {result.uncertainty_reasons?.map((u, idx) => (
                <div key={idx}>&bull; {u}</div>
              ))}
            </div>
          )}

          {/* Non-Guarantee Statutory Notice */}
          <div className="p-3 bg-[#F5F7F4] border border-[#DCE5DE] rounded-md text-[11px] text-[#65756C] leading-relaxed">
            <strong className="text-[#172820]">Statutory Notice:</strong>{" "}
            {result.legal_disclaimer ||
              "Environmental screening provides remote-sensing evidence indicators. It does NOT constitute legal certification of sovereign EUDR compliance or replace sovereign customs inspections."}
          </div>

          {/* Provenance Footnote */}
          <div className="pt-2 border-t border-[#DCE5DE] flex flex-wrap items-center justify-between text-[11px] font-mono text-[#65756C]">
            <span>Digest: {result.source_digest}</span>
            <span>Recorded: {result.timestamp}</span>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white p-12 rounded-lg border border-[#DCE5DE] shadow-xs text-center space-y-3 max-w-xl mx-auto my-6">
          <Trees className="w-10 h-10 text-[#237A57]/40 mx-auto" />
          <h4 className="text-base font-bold text-[#172820]">No Screening Evaluated Yet</h4>
          <p className="text-xs text-[#65756C] leading-relaxed">
            Select a target plot and click "Execute Environmental Screening" to query the FAO WHISP multi-map convergence engine.
          </p>
        </div>
      )}
    </div>
  );
};
