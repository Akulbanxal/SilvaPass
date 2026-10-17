import React, { useState } from "react";
import { getEvidenceReport } from "../api/client";
import { ProvenanceBadge } from "../components/Badges";
import type { EvidenceReportResponse } from "../types";

export const EvidenceReportScreen: React.FC<{ activePlotId?: string }> = ({
  activePlotId = "PLOT-BASE-DEMO",
}) => {
  const [plotId, setPlotId] = useState<string>(activePlotId);
  const [seasonId, setSeasonId] = useState<number>(2026);
  const [report, setReport] = useState<EvidenceReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEvidenceReport(plotId, seasonId);
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate evidence report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-[#e2e8e0] shadow-sm">
        <h2 className="text-xl font-bold text-[#081c15] tracking-tight">
          Tamper-Evident Evidence Report &amp; Audit Trail
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Cryptographically hashes all multi-lifecycle evidence (geometry validation, duplicate review, environmental screening, human sign-offs, and on-chain receipts).
        </p>

        {/* Generator Controls */}
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
            <label className="block text-xs font-semibold text-slate-700">Season Year</label>
            <input
              type="number"
              value={seasonId}
              onChange={(e) => setSeasonId(Number(e.target.value))}
              className="mt-1 text-xs font-mono px-3 py-1.5 border border-slate-300 rounded w-28 focus:ring-1 focus:ring-[#1b4332]"
            />
          </div>
          <div className="pt-4">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition disabled:opacity-50"
            >
              {loading ? "Compiling..." : "Generate Canonical Evidence Report"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs">
            <strong>Error:</strong> {error}
          </div>
        )}

        {report && (
          <div className="mt-6 p-6 border border-[#1b4332] rounded-lg bg-white space-y-6 shadow-sm">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs uppercase font-semibold text-[#1b4332] tracking-wider">
                  Verified Audit Report: #{report.report_id}
                </span>
                <h3 className="text-lg font-bold text-slate-900 font-mono mt-0.5">{report.plot_id}</h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Root Evidence Bundle Hash (SHA-256):</span>
                <div className="text-xs font-mono font-bold text-[#1b4332] truncate max-w-sm">
                  {report.root_evidence_bundle_hash}
                </div>
              </div>
            </div>

            {/* Evidence items breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Cryptographic Evidence Items ({report.evidence_items.length})
              </h4>
              <div className="space-y-2">
                {report.evidence_items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{item.title}</span>
                      <ProvenanceBadge type={item.provenance} />
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Digest: {item.digest_sha256}
                    </div>
                    <pre className="p-2 bg-white rounded border border-slate-100 text-[10px] font-mono text-slate-700 overflow-x-auto">
                      {JSON.stringify(item.details, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            {/* Boundary Disclaimer */}
            <div className="p-3 bg-slate-100 border border-slate-200 rounded text-xs text-slate-600">
              <strong>Protocol Boundary Disclaimer:</strong> {report.system_boundary_disclaimer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
