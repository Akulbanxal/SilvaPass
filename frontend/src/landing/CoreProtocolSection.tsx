import React, { useState } from "react";
import { Compass, ShieldCheck, Scale, FileCheck } from "lucide-react";

export const CoreProtocolSection: React.FC = () => {
  const [selectedStage, setSelectedStage] = useState<number>(0);

  const stages = [
    {
      step: "01",
      title: "RESOLVE",
      icon: Compass,
      tagline: "Geospatial plot identity resolution",
      description:
        "Validate polygon geometry, calculate geodesic area, and compare boundaries against historical plots using H3 indexing and Shapely IoU. Flags candidates with coordinate jitter or vertex shifting for human review.",
      metrics: [
        { label: "IoU Threshold", value: "≥ 80.0%" },
        { label: "Centroid Drift", value: "≤ 50.0 m" },
        { label: "Indexing", value: "H3 Res-9" },
      ],
      visualType: "polygon_compare",
    },
    {
      step: "02",
      title: "ASSESS",
      icon: ShieldCheck,
      tagline: "Multi-map environmental screening",
      description:
        "Attach environmental risk screening evidence from FAO Open Foris WHISP relative to the December 31, 2020 deforestation cutoff date. Retains complete provenance tiering (EXTERNAL_VERIFIED, CACHED_SNAPSHOT, SIMULATED).",
      metrics: [
        { label: "Cutoff Baseline", value: "2020-12-31" },
        { label: "Screening Method", value: "Multi-map" },
        { label: "Provenance Tier", value: "Explicitly labeled" },
      ],
      visualType: "environmental_scan",
    },
    {
      step: "03",
      title: "RECONCILE",
      icon: Scale,
      tagline: "Shared production allowance math",
      description:
        "Extract shipment document details (MT, bags, kg) with AI assistance subject to human operator verification. Compare declared shipment quantities against the remaining approved allowance on the plot.",
      metrics: [
        { label: "Unit Normalization", value: "kg standard" },
        { label: "Allowance Balance", value: "Monotonic" },
        { label: "Verification Gate", value: "Human confirmed" },
      ],
      visualType: "allowance_balance",
    },
    {
      step: "04",
      title: "VERIFY",
      icon: FileCheck,
      tagline: "Enforceable claim invariant ledger",
      description:
        "Submit validated shipment claims to an auditable smart-contract ledger. The on-chain invariant strictly rejects any claim exceeding remaining capacity while preserving remaining balance and emitting auditable events.",
      metrics: [
        { label: "Contract Guard", value: "netClaimed ≤ approved" },
        { label: "Over-Allocation", value: "Atomic Revert" },
        { label: "Audit Evidence", value: "Root hash anchored" },
      ],
      visualType: "contract_ledger",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 relative border-t border-[#1b4332]/60 bg-[#07130F]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10251C] border border-[#1b4332] text-[#B7ED78] text-xs font-mono tracking-wider uppercase mb-4">
            End-To-End Architecture
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F2F5ED] mb-6">
            From physical land to accountable claims.
          </h2>
          <p className="text-base sm:text-lg text-[#A2B4A8] leading-relaxed">
            A cohesive 4-stage pipeline that bridges off-chain spatial intelligence with an enforceable on-chain claim invariant.
          </p>
        </div>

        {/* 4-Stage Horizontal Pipeline on Desktop / Vertical on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isSelected = selectedStage === idx;
            return (
              <div
                key={stage.step}
                onClick={() => setSelectedStage(idx)}
                className={`cursor-pointer rounded-2xl p-6 border transition-all duration-300 flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#10251C] border-[#B7ED78] shadow-forest-glow"
                    : "bg-[#07130F] border-[#1b4332] hover:border-[#80DDB0]/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-[#80DDB0] tracking-wider">
                      {stage.step}
                    </span>
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-[#B7ED78] text-[#07130F]"
                          : "bg-[#10251C] border border-[#1b4332] text-[#A2B4A8]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-[#F2F5ED] mb-1">{stage.title}</h3>
                  <div className="text-xs font-mono text-[#80DDB0] mb-3">{stage.tagline}</div>
                  <p className="text-xs text-[#A2B4A8] leading-relaxed mb-6">{stage.description}</p>
                </div>

                <div className="pt-4 border-t border-[#1b4332]/60 space-y-1.5 font-mono text-[11px]">
                  {stage.metrics.map((m) => (
                    <div key={m.label} className="flex justify-between items-center text-[#A2B4A8]">
                      <span>{m.label}:</span>
                      <span className="text-[#F2F5ED] font-semibold">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive Detailed Stage Visual Inspector */}
        <div className="bg-[#10251C] border border-[#1b4332] rounded-2xl p-8 relative overflow-hidden shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1b4332]/60">
            <div>
              <span className="text-xs font-mono text-[#80DDB0]">STAGE INSPECTOR</span>
              <h4 className="text-xl font-bold text-[#F2F5ED] flex items-center gap-2">
                Stage {stages[selectedStage].step}: {stages[selectedStage].title} &bull;{" "}
                <span className="text-[#A2B4A8] font-normal text-sm">{stages[selectedStage].tagline}</span>
              </h4>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-[#A2B4A8]">Click tabs above to inspect stages</span>
            </div>
          </div>

          {/* Dynamic Technical Visual according to stage */}
          {selectedStage === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="h-56 bg-[#07130F] rounded-xl border border-[#1b4332] p-4 flex items-center justify-center relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 200 120">
                  <rect width="200" height="120" fill="#07130F" />
                  {/* Base Plot */}
                  <polygon
                    points="40,30 110,20 160,70 120,105 50,90"
                    fill="rgba(183, 237, 120, 0.12)"
                    stroke="#B7ED78"
                    strokeWidth="2"
                  />
                  {/* Shifted Duplicate Polygon */}
                  <polygon
                    points="45,33 115,22 163,68 123,107 53,88"
                    fill="rgba(245, 158, 11, 0.15)"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />
                  <circle cx="96" cy="63" r="3" fill="#B7ED78" />
                  <circle cx="99.8" cy="63.6" r="3" fill="#F59E0B" />
                  <line x1="96" y1="63" x2="99.8" y2="63.6" stroke="#F2F5ED" strokeWidth="1" />
                  <text x="105" y="65" fill="#F2F5ED" fontSize="8" fontFamily="monospace">
                    Δ 1.27m
                  </text>
                </svg>
                <div className="absolute top-3 left-3 text-[10px] font-mono text-[#B7ED78]">
                  BASE: PLOT-BASE-DEMO
                </div>
                <div className="absolute bottom-3 right-3 text-[10px] font-mono text-[#F59E0B]">
                  INCOMING: PLOT-DUP-DEMO
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-[#07130F] border border-[#1b4332]">
                  <div className="text-[#80DDB0] font-bold mb-1">Geodesic IoU Metric</div>
                  <div className="text-[#F2F5ED] text-sm font-semibold">99.25% Spatial Overlap</div>
                  <p className="text-[#A2B4A8] text-[11px] mt-1">
                    Exceeds 80% duplicate candidate threshold. Automatic auto-registration is blocked.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#07130F] border border-[#1b4332]">
                  <div className="text-[#F59E0B] font-bold mb-1">Human Review Queue Enforced</div>
                  <div className="text-[#F2F5ED] text-sm font-semibold">Classification: LIKELY_DUPLICATE</div>
                  <p className="text-[#A2B4A8] text-[11px] mt-1">
                    Mandatory rule: Ambiguous or duplicated matches require supervisor sign-off before joining claim pool.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedStage === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="h-56 bg-[#07130F] rounded-xl border border-[#1b4332] p-4 flex flex-col justify-between font-mono">
                <div className="flex justify-between items-center text-xs pb-2 border-b border-[#1b4332]">
                  <span className="text-[#80DDB0]">FAO WHISP SCREENING PROBE</span>
                  <span className="text-[#A2B4A8]">LAT -12.500 / LON -54.500</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#A2B4A8]">TMF Disturbance:</span>
                    <span className="text-[#B7ED78] font-bold">0.00 ha (Undisturbed)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A2B4A8]">GLAD Deforestation:</span>
                    <span className="text-[#B7ED78] font-bold">0.00 ha post-2020</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A2B4A8]">Tree Cover 2020:</span>
                    <span className="text-[#F2F5ED]">78.4% Baseline</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-[#10251C] border border-[#80DDB0]/40 text-[#80DDB0] text-[11px] flex items-center justify-between">
                  <span>OVERALL RISK EVALUATION:</span>
                  <span className="font-bold">LOW_RISK</span>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-[#07130F] border border-[#1b4332]">
                  <div className="text-[#80DDB0] font-bold mb-1">Convergence of Evidence</div>
                  <p className="text-[#A2B4A8] text-[11px] mt-1">
                    Uses multiple peer-reviewed global forest monitoring datasets (JRC TMF, Hansen GFC, GLAD) rather than relying on a single fallible satellite source.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#07130F] border border-[#1b4332]">
                  <div className="text-[#B7ED78] font-bold mb-1">Strict Provenance Transparency</div>
                  <p className="text-[#A2B4A8] text-[11px] mt-1">
                    Clearly tagged as <span className="text-[#F2F5ED] font-semibold">CACHED_SNAPSHOT</span>. Never pretends live satellite observation or guarantees legal compliance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedStage === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="h-56 bg-[#07130F] rounded-xl border border-[#1b4332] p-5 flex flex-col justify-between font-mono">
                <div className="text-xs text-[#A2B4A8]">PRODUCTION RECONCILIATION FORMULA:</div>
                <div className="p-3 rounded-lg bg-[#10251C] border border-[#1b4332] text-center">
                  <div className="text-[#B7ED78] text-sm font-bold">netClaimed ≤ approvedAllowance</div>
                  <div className="text-[#A2B4A8] text-[11px] mt-1">
                    (1,800 kg claimed ≤ 3,000 kg approved) &bull; REMAINING: 1,200 kg
                  </div>
                </div>
                <div className="w-full bg-[#10251C] h-4 rounded-full overflow-hidden border border-[#1b4332]">
                  <div className="bg-[#B7ED78] h-full w-[60%]" />
                </div>
                <div className="flex justify-between text-[11px] text-[#A2B4A8]">
                  <span>0 kg</span>
                  <span className="text-[#B7ED78]">60% Capacity Claimed</span>
                  <span>3,000 kg Max</span>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-[#07130F] border border-[#1b4332]">
                  <div className="text-[#80DDB0] font-bold mb-1">AI-Assisted Document Extraction</div>
                  <p className="text-[#A2B4A8] text-[11px] mt-1">
                    Normalizes physical shipment documents (Bills of Lading, Phyto certificates) into metric kilograms, validating declared plot IDs against registered bounds.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#07130F] border border-[#1b4332]">
                  <div className="text-[#F59E0B] font-bold mb-1">Human-In-The-Loop Confirmation</div>
                  <p className="text-[#A2B4A8] text-[11px] mt-1">
                    Extracted values require exporter/operator confirmation before any state change is written to the ledger.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedStage === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="h-56 bg-[#07130F] rounded-xl border border-[#1b4332] p-4 flex flex-col justify-between font-mono text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-[#1b4332]">
                  <span className="text-[#B7ED78]">EVM SMART CONTRACT EMISSION</span>
                  <span className="text-[#A2B4A8]">SilvaPassRegistry.sol</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="text-[#80DDB0]">event ClaimRecorded(bytes32 indexed plotId, uint256 qty);</div>
                  <div className="text-[#EF4444]">error AllowanceExceeded(uint256 attempted, uint256 remaining);</div>
                  <div className="text-[#A2B4A8] text-[10px]">Contract Address: 0x5FbDB2315678afecb367f...</div>
                </div>
                <div className="p-2 rounded bg-[#163327] border border-[#B7ED78]/30 flex justify-between items-center text-[10px]">
                  <span className="text-[#F2F5ED]">Audit Root Digest:</span>
                  <span className="text-[#B7ED78] font-bold">0x9751dbbe...2173</span>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-[#07130F] border border-[#1b4332]">
                  <div className="text-[#B7ED78] font-bold mb-1">Cryptographic Non-Repudiation</div>
                  <p className="text-[#A2B4A8] text-[11px] mt-1">
                    Every accepted or rejected claim is recorded with immutable timestamps and operator public addresses, producing tamper-evident audit evidence bundles.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#07130F] border border-[#1b4332]">
                  <div className="text-[#EF4444] font-bold mb-1">State Preservation On Rejection</div>
                  <p className="text-[#A2B4A8] text-[11px] mt-1">
                    When over-allocation claims are rejected, the transaction cleanly reverts and the existing remaining balance is strictly preserved.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
