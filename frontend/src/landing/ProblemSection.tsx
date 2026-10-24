import React, { useState } from "react";
import { Layers, Check, X, Shield, Clock } from "lucide-react";

export const ProblemSection: React.FC = () => {
  const [activeJitter, setActiveJitter] = useState<"exact_hash" | "silvapass">("silvapass");

  return (
    <section id="platform" className="py-24 px-4 sm:px-6 relative border-t border-[#1b4332]/60 bg-[#07130F]">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#163327]/25 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10251C] border border-[#1b4332] text-[#80DDB0] text-xs font-mono tracking-wider uppercase mb-4">
            <Layers className="w-3.5 h-3.5" />
            The Fragmented Landscape
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F2F5ED] mb-6 leading-tight">
            Supply chains cannot trust what they cannot reconcile.
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-[#A2B4A8] leading-relaxed">
            Plot records, environmental evidence, and shipment claims often live in separate systems. SilvaPass brings these signals into one traceable verification workflow.
          </p>
        </div>

        {/* 3 Visually Distinct Problem Architectures (Not Generic Cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Architecture 1: Spatial Deduplication & Cadastral Jitter Inspector */}
          <div className="bg-[#10251C] border border-[#1b4332] rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-[#80DDB0]/50 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded bg-[#07130F] text-[#B7ED78] border border-[#1b4332]">
                  GEODESIC MATCHING
                </span>
                <span className="text-[10px] font-mono text-[#A2B4A8]">SYSTEM SIGNAL 01</span>
              </div>
              <h3 className="text-xl font-bold text-[#F2F5ED] mb-2">
                Potentially duplicated land registrations
              </h3>
              <p className="text-xs sm:text-sm text-[#A2B4A8] leading-relaxed mb-6">
                Different polygon representations may refer to the same physical land. Exact coordinate hashes alone cannot reliably resolve every altered boundary or coordinate transformation.
              </p>
            </div>

            {/* Interactive Cadastral Comparison Module */}
            <div className="bg-[#07130F] border border-[#1b4332] rounded-xl p-4 font-mono text-xs">
              <div className="flex justify-between items-center mb-3 text-[11px]">
                <span className="text-[#A2B4A8]">Evaluation Mode:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveJitter("exact_hash")}
                    className={`px-2.5 py-1 rounded text-[10px] transition cursor-pointer ${
                      activeJitter === "exact_hash"
                        ? "bg-[#190d0e] text-[#EF4444] border border-[#EF4444]/60 font-bold"
                        : "bg-[#10251C] text-[#A2B4A8] hover:text-[#F2F5ED] border border-[#1b4332]"
                    }`}
                  >
                    Exact SHA-256 Hash
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveJitter("silvapass")}
                    className={`px-2.5 py-1 rounded text-[10px] transition cursor-pointer ${
                      activeJitter === "silvapass"
                        ? "bg-[#163327] text-[#B7ED78] border border-[#B7ED78]/60 font-bold"
                        : "bg-[#10251C] text-[#A2B4A8] hover:text-[#F2F5ED] border border-[#1b4332]"
                    }`}
                  >
                    SilvaPass IoU
                  </button>
                </div>
              </div>

              {/* Cadastral Polygon SVG */}
              <div className="relative h-32 bg-[#0c2117] rounded-lg border border-[#1b4332]/80 flex items-center justify-center overflow-hidden mb-3">
                <svg className="w-full h-full p-2.5" viewBox="0 0 160 90">
                  {/* Subtle Grid Lines */}
                  <line x1="0" y1="45" x2="160" y2="45" stroke="#1b4332" strokeWidth="0.5" strokeDasharray="3 3" />
                  <line x1="80" y1="0" x2="80" y2="90" stroke="#1b4332" strokeWidth="0.5" strokeDasharray="3 3" />

                  {/* Polygon A (Base Registered) */}
                  <polygon
                    points="30,25 90,20 130,55 95,80 40,70"
                    fill="rgba(183, 237, 120, 0.16)"
                    stroke="#B7ED78"
                    strokeWidth="1.8"
                  />

                  {/* Polygon B (Shifted 1.27m) */}
                  <polygon
                    points="34,27 94,22 133,53 98,82 43,68"
                    fill="rgba(128, 221, 176, 0.14)"
                    stroke={activeJitter === "exact_hash" ? "#A2B4A8" : "#F59E0B"}
                    strokeWidth="1.8"
                    strokeDasharray="2.5 2.5"
                  />

                  {/* Connector lines showing drift */}
                  {activeJitter === "silvapass" && (
                    <>
                      <line x1="30" y1="25" x2="34" y2="27" stroke="#F59E0B" strokeWidth="1" />
                      <line x1="90" y1="20" x2="94" y2="22" stroke="#F59E0B" strokeWidth="1" />
                      <line x1="130" y1="55" x2="133" y2="53" stroke="#F59E0B" strokeWidth="1" />
                    </>
                  )}
                </svg>

                <div className="absolute top-2 left-2 text-[9px] text-[#B7ED78]">Plot A (Registered)</div>
                <div className="absolute bottom-2 right-2 text-[9px] text-[#F59E0B]">Plot B (0.5m Jitter)</div>
              </div>

              {/* Result Readout */}
              {activeJitter === "exact_hash" ? (
                <div className="bg-[#190d0e] border border-[#EF4444]/40 rounded-lg p-2.5 text-[#EF4444]">
                  <div className="flex items-center gap-1.5 font-bold text-[11px] mb-1">
                    <X className="w-3.5 h-3.5" /> Hash Mismatch (False Negative)
                  </div>
                  <div className="text-[10px] text-[#A2B4A8]">
                    SHA-256 strings differ completely. Coordinate laundering bypasses naive hash deduplication.
                  </div>
                </div>
              ) : (
                <div className="bg-[#163327] border border-[#B7ED78]/40 rounded-lg p-2.5 text-[#B7ED78]">
                  <div className="flex items-center gap-1.5 font-bold text-[11px] mb-1">
                    <Check className="w-3.5 h-3.5" /> Duplicate Correctly Flagged
                  </div>
                  <div className="text-[10px] text-[#A2B4A8]">
                    IoU: <span className="text-[#F2F5ED] font-bold">99.25%</span> &bull; Centroid Drift:{" "}
                    <span className="text-[#F2F5ED] font-bold">1.27m</span>. Held in review queue.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Architecture 2: Evidence Provenance Docket */}
          <div className="bg-[#10251C] border border-[#1b4332] rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-[#80DDB0]/50 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded bg-[#07130F] text-[#80DDB0] border border-[#1b4332]">
                  PROVENANCE DOCKET
                </span>
                <span className="text-[10px] font-mono text-[#A2B4A8]">SYSTEM SIGNAL 02</span>
              </div>
              <h3 className="text-xl font-bold text-[#F2F5ED] mb-2">
                Disconnected environmental evidence
              </h3>
              <p className="text-xs sm:text-sm text-[#A2B4A8] leading-relaxed mb-6">
                Screening results need traceable sources, timestamps, and limitations rather than unsupported claims of compliance.
              </p>
            </div>

            {/* Structured Evidence Stack Docket */}
            <div className="bg-[#07130F] border border-[#1b4332] rounded-xl p-4 font-mono text-xs space-y-2.5">
              <div className="flex items-center justify-between text-[10px] text-[#A2B4A8] uppercase tracking-wider mb-1">
                <span>EVIDENTIARY AUDIT STACK</span>
                <Clock className="w-3 h-3 text-[#80DDB0]" />
              </div>

              {/* Evidence Layer 1 */}
              <div className="p-2.5 rounded bg-[#10251C] border border-[#1b4332] flex justify-between items-center">
                <div>
                  <div className="text-[11px] text-[#F2F5ED] font-semibold">FAO Open Foris WHISP</div>
                  <div className="text-[9px] text-[#A2B4A8]">Cutoff: Dec 31, 2020 &bull; Multi-map</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#163327] text-[#B7ED78] text-[9px] font-bold border border-[#1b4332]">
                  LOW RISK
                </span>
              </div>

              {/* Evidence Layer 2 */}
              <div className="p-2.5 rounded bg-[#10251C] border border-[#1b4332] flex justify-between items-center">
                <div>
                  <div className="text-[11px] text-[#F2F5ED] font-semibold">Snapshot Digest Root</div>
                  <div className="text-[9px] text-[#A2B4A8] font-mono">0x215a35e993de099af...</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#163327] text-[#80DDB0] text-[9px] font-bold border border-[#1b4332]">
                  ANCHORED
                </span>
              </div>

              {/* Provenance Tier Badge */}
              <div className="p-2.5 rounded bg-[#163327]/70 border border-[#80DDB0]/40 text-[10px] text-[#80DDB0]">
                <div className="font-semibold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Provenance Tier: CACHED_SNAPSHOT
                </div>
                <p className="text-[9px] text-[#A2B4A8] mt-1 leading-relaxed">
                  Documented reference benchmark snapshot; transparently discloses screening indicators without fabricating live surveillance.
                </p>
              </div>
            </div>
          </div>

          {/* Architecture 3: Shared Production Allowance Balance Scale */}
          <div className="bg-[#10251C] border border-[#1b4332] rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-[#80DDB0]/50 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded bg-[#07130F] text-[#EF4444] border border-[#1b4332]">
                  INVARIANT GUARD
                </span>
                <span className="text-[10px] font-mono text-[#A2B4A8]">SYSTEM SIGNAL 03</span>
              </div>
              <h3 className="text-xl font-bold text-[#F2F5ED] mb-2">
                Inconsistent production claims
              </h3>
              <p className="text-xs sm:text-sm text-[#A2B4A8] leading-relaxed mb-6">
                Independent shipment records can become difficult to reconcile when organizations lack a shared, enforceable production-claim balance.
              </p>
            </div>

            {/* Mass-Balance Reconciliation Scale */}
            <div className="bg-[#07130F] border border-[#1b4332] rounded-xl p-4 font-mono text-xs space-y-2.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#A2B4A8]">Approved Plot Capacity:</span>
                <span className="text-[#F2F5ED] font-bold">3,000 kg</span>
              </div>

              {/* Claim Streams */}
              <div className="space-y-2">
                <div className="p-2 rounded bg-[#10251C] border border-[#1b4332]">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#F2F5ED]">Claim 1 (Trader Alpha)</span>
                    <span className="text-[#80DDB0] font-bold">1,800 kg &bull; CONFIRMED</span>
                  </div>
                  <div className="w-full bg-[#07130F] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#80DDB0] h-full w-[60%]" />
                  </div>
                </div>

                <div className="p-2 rounded bg-[#190d0e] border border-[#EF4444]/40">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#EF4444] font-semibold">Claim 2 (Trader Beta: 2,000 kg)</span>
                    <span className="text-[#EF4444] font-bold">REJECTED</span>
                  </div>
                  <div className="text-[9px] text-[#A2B4A8] leading-tight">
                    Invariant violated: 1,800 kg + 2,000 kg &gt; 3,000 kg limit. Double-claim rejected.
                  </div>
                </div>
              </div>

              <div className="text-[9px] text-[#A2B4A8] pt-1.5 border-t border-[#1b4332]/60 flex justify-between">
                <span>Remaining Balance State:</span>
                <span className="text-[#B7ED78] font-bold">1,200 kg strictly preserved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
