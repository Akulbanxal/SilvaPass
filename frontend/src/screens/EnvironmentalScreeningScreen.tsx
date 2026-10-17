import React, { useState } from "react";
import { screenPlot } from "../api/client";
import { RiskBadge, ProvenanceBadge } from "../components/Badges";
import type { EnvironmentalScreeningResponse } from "../types";

export const EnvironmentalScreeningScreen: React.FC<{ activePlotId?: string }> = ({
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
      <div className="bg-white p-6 rounded-lg border border-[#e2e8e0] shadow-sm">
        <h2 className="text-xl font-bold text-[#081c15] tracking-tight">
          Environmental &amp; Deforestation Screening
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Integrates with the FAO WHISP ("What is in that plot?") Open Foris engine using a multi-map convergence of evidence approach relative to the Dec 31, 2020 cutoff date.
        </p>

        {/* Screening controls */}
        <div className="mt-6 flex flex-wrap items-center gap-4 p-4 bg-[#f8faf9] rounded border border-[#e2e8e0]">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Plot Identifier</label>
            <input
              type="text"
              value={plotId}
              onChange={(e) => setPlotId(e.target.value)}
              className="mt-1 text-xs font-mono px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#1b4332]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Screening Source Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="mt-1 text-xs font-mono px-3 py-1.5 border border-slate-300 rounded bg-white"
            >
              <option value="SNAPSHOT">SNAPSHOT (Pinned Historical Reference)</option>
              <option value="SIMULATION">SIMULATION (Deterministic Fallback)</option>
              <option value="LIVE">LIVE (Direct FAO WHISP API)</option>
            </select>
          </div>

          <div className="pt-4">
            <button
              onClick={handleScreenPlot}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition disabled:opacity-50"
            >
              {loading ? "Screening..." : "Execute Environmental Screening"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="mt-6 p-5 border border-slate-200 rounded-lg bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  Service Provider: {result.service_name}
                </span>
                <h3 className="text-base font-bold text-slate-800 font-mono mt-0.5">{result.plot_id}</h3>
              </div>
              <div className="flex items-center gap-2">
                <RiskBadge risk={result.deforestation_risk} />
                <ProvenanceBadge type={result.provenance} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded">
                <span className="text-slate-500">Cutoff Date Threshold</span>
                <p className="font-mono font-semibold text-slate-800 mt-1">{result.cutoff_date}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded">
                <span className="text-slate-500">Forest Canopy Overlap</span>
                <p className="font-semibold text-slate-800 mt-1">
                  {(result.indicators.forest_overlap_pct * 100).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded">
                <span className="text-slate-500">Post-2020 Disturbances</span>
                <p className="font-semibold text-slate-800 mt-1">
                  {result.indicators.post_cutoff_disturbances} detected
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded">
                <span className="text-slate-500">Pre-Cutoff Commodity</span>
                <p className="font-semibold text-slate-800 mt-1">
                  {result.indicators.commodity_detected ? "Verified (Present)" : "Not Mapped"}
                </p>
              </div>
            </div>

            {/* WHISP Convergence Indicators Breakdown */}
            {(result.indicators.ind_01_mapped_forest !== undefined ||
              result.indicators.ind_02_commodity_map !== undefined) && (
              <div className="p-3.5 bg-slate-50 rounded border border-slate-200 text-xs">
                <div className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
                  Open Foris WHISP Convergence Indicators
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Ind_01 Mapped Forest:</span>
                    <span className="ml-1 font-mono font-medium text-slate-800">
                      {result.indicators.ind_01_mapped_forest ? "True (Inside)" : "False (Outside)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Ind_02 Commodity Map:</span>
                    <span className="ml-1 font-mono font-medium text-slate-800">
                      {result.indicators.ind_02_commodity_map ? "True (Mapped)" : "False (Unmapped)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Ind_03 Pre-2020 Loss:</span>
                    <span className="ml-1 font-mono font-medium text-slate-800">
                      {result.indicators.ind_03_disturbance_before_2020 ? "Detected" : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Ind_04 Post-2020 Dist:</span>
                    <span className="ml-1 font-mono font-medium text-slate-800">
                      {result.indicators.ind_04_recent_disturbance ? "Detected" : "None"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Datasets Used */}
            {result.datasets_used && result.datasets_used.length > 0 && (
              <div className="text-xs">
                <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  Datasets Consulted:
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {result.datasets_used.map((ds) => (
                    <span key={ds} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[10px]">
                      {ds}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Operational Warnings / Uncertainty */}
            {((result.warnings && result.warnings.length > 0) ||
              (result.uncertainty_reasons && result.uncertainty_reasons.length > 0)) && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                <strong className="block text-[11px] uppercase tracking-wide">
                  Evidence Gaps &amp; Operational Notes:
                </strong>
                {result.warnings?.map((w, idx) => (
                  <div key={idx}>&bull; {w}</div>
                ))}
                {result.uncertainty_reasons?.map((u, idx) => (
                  <div key={idx}>&bull; {u}</div>
                ))}
              </div>
            )}

            {/* Non-Guarantee Legal Disclaimer */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500 italic">
              <strong>Statutory Boundary Notice:</strong> {result.legal_disclaimer || "Screening provides remote-sensing evidence indicators. It does NOT constitute legal certification of EUDR compliance or land title validity."}
            </div>

            <div className="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-100 flex flex-wrap justify-between gap-2">
              <span>Source Digest: {result.source_digest}</span>
              <span>Observed At: {result.timestamp}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
