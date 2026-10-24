import React, { useState } from "react";
import { getEvidenceReport } from "../api/client";
import { ProvenanceBadge } from "../components/Badges";
import type { EvidenceReportResponse } from "../types";
import {
  FileCheck2,
  Download,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  MapPin,
  Layers,
  Trees,
  FileText,
  Scale,
} from "lucide-react";

interface EvidenceReportScreenProps {
  activePlotId?: string;
}

export const EvidenceReportScreen: React.FC<EvidenceReportScreenProps> = ({
  activePlotId = "PLOT-BASE-DEMO",
}) => {
  const [plotId, setPlotId] = useState<string>(activePlotId);
  const [seasonId, setSeasonId] = useState<number>(2026);
  const [report, setReport] = useState<EvidenceReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

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

  const copyRootHash = () => {
    if (!report?.root_evidence_bundle_hash) return;
    navigator.clipboard.writeText(report.root_evidence_bundle_hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const exportJsonReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `silvapass_evidence_${report.plot_id}_${report.season_id || seasonId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getItemIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes("geometry") || lower.includes("cadastre")) return MapPin;
    if (lower.includes("duplicate") || lower.includes("review")) return Layers;
    if (lower.includes("whisp") || lower.includes("environmental") || lower.includes("canopy")) return Trees;
    if (lower.includes("document") || lower.includes("lading")) return FileText;
    if (lower.includes("allowance") || lower.includes("claim") || lower.includes("ledger")) return Scale;
    return ShieldCheck;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE5DE]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#172820]">
              Evidence &amp; Audit Trail
            </h2>
            <span className="font-mono text-xs bg-[#103126] text-[#B6E986] px-2.5 py-0.5 rounded-full border border-[#237A57]">
              Tamper-Evident SHA-256 Bundle
            </span>
          </div>
          <p className="text-sm text-[#65756C] mt-1">
            Review the records, source information, decisions, and claim transactions associated with an agricultural plot.
          </p>
        </div>
      </div>

      {/* Generator Controls */}
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
            <label className="block text-[11px] font-semibold text-[#65756C]">Season Year</label>
            <input
              type="number"
              value={seasonId}
              onChange={(e) => setSeasonId(Number(e.target.value))}
              className="mt-0.5 text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden w-24"
            />
          </div>
          <div className="pt-4">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[#237A57] hover:bg-[#103126] text-white transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Compiling Bundle..." : "Generate Canonical Evidence Report"}</span>
            </button>
          </div>
        </div>

        {report && (
          <div className="pt-2 sm:pt-0">
            <button
              onClick={exportJsonReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172820] bg-[#F5F7F4] hover:bg-[#DCE5DE] border border-[#DCE5DE] rounded-md transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Canonical JSON</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-[#B83A3A]/10 border border-[#B83A3A]/25 rounded-md text-xs text-[#B83A3A] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Report Bundle Results */}
      {report ? (
        <div className="bg-white p-6 rounded-lg border border-[#DCE5DE] shadow-xs space-y-6">
          {/* Header Card */}
          <div className="p-4 bg-[#F5F7F4] rounded-lg border border-[#DCE5DE] flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-[#65756C] uppercase">
                Verified Report ID: #{report.report_id}
              </span>
              <h3 className="text-xl font-bold text-[#172820] font-mono mt-0.5">
                {report.plot_id} &bull; Season {seasonId}
              </h3>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-[#65756C] block">
                Root Cryptographic Bundle Hash (SHA-256):
              </span>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs font-mono font-bold text-[#237A57] bg-white px-2 py-1 rounded border border-[#DCE5DE] truncate max-w-xs sm:max-w-md">
                  {report.root_evidence_bundle_hash}
                </code>
                <button
                  onClick={copyRootHash}
                  className="p-1 rounded hover:bg-white text-[#65756C] hover:text-[#172820] border border-[#DCE5DE] transition cursor-pointer"
                  title="Copy SHA-256 hash"
                >
                  {copiedHash ? <Check className="w-3.5 h-3.5 text-[#16805D]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Chronological Audit Timeline */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#172820] uppercase font-mono tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#237A57]" />
                <span>Multi-Lifecycle Evidence Items ({report.evidence_items.length})</span>
              </h4>
              <span className="text-[11px] text-[#65756C]">
                Tamper-Evident Verification Sequence
              </span>
            </div>

            <div className="space-y-3">
              {report.evidence_items.map((item, idx) => {
                const Icon = getItemIcon(item.title);
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-[#DCE5DE] bg-white hover:border-[#237A57]/40 transition space-y-2.5 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#237A57]/10 text-[#237A57] flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-[#172820]">
                            {item.title}
                          </span>
                          <span className="block font-mono text-[10px] text-[#65756C] truncate max-w-sm">
                            Digest: {item.digest_sha256}
                          </span>
                        </div>
                      </div>
                      <ProvenanceBadge type={item.provenance} />
                    </div>

                    <div className="p-2.5 bg-[#F5F7F4] rounded border border-[#DCE5DE]/60 overflow-x-auto text-[11px] font-mono text-[#172820]">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(item.details, null, 2)}</pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Boundary Disclaimer */}
          <div className="p-3.5 bg-[#F5F7F4] border border-[#DCE5DE] rounded-md text-xs text-[#65756C] leading-relaxed">
            <strong className="text-[#172820]">Protocol Boundary Disclaimer:</strong>{" "}
            {report.system_boundary_disclaimer}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white p-12 rounded-lg border border-[#DCE5DE] shadow-xs text-center space-y-3 max-w-xl mx-auto my-6">
          <FileCheck2 className="w-10 h-10 text-[#237A57]/40 mx-auto" />
          <h4 className="text-base font-bold text-[#172820]">No Evidence Report Compiled</h4>
          <p className="text-xs text-[#65756C] leading-relaxed">
            Select a plot identifier and season, then click "Generate Canonical Evidence Report" to aggregate geometry validation, duplicate adjudication, WHISP screening, and blockchain receipts into an immutable SHA-256 bundle.
          </p>
        </div>
      )}
    </div>
  );
};
