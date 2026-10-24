import React from "react";
import { ShieldCheck, Compass, Satellite, Cpu, Database, AlertCircle } from "lucide-react";

export const TrustCredibilitySection: React.FC = () => {
  const pillars = [
    {
      id: "geospatial",
      title: "GEOSPATIAL MATCHING",
      icon: Compass,
      role: "Identifies candidate duplicate boundaries using geometric evidence.",
      mechanism:
        "Index coordinates into H3 discrete global grid cells (Resolution 9), compute geodesic area in hectares via EPSG:4326/WGS84, and calculate Shapely Intersection-over-Union (IoU) and Hausdorff centroid drift.",
      safeguard: "Requires human review before ambiguous or overlapping matches are finalized. No silent auto-merges.",
      badge: "ALGORITHMIC RIGOR",
    },
    {
      id: "environmental",
      title: "ENVIRONMENTAL SCREENING",
      icon: Satellite,
      role: "Provides geographic risk indicators from configured sources.",
      mechanism:
        "Queries FAO Open Foris WHISP multi-map convergence pipelines across JRC Tropical Moist Forests (TMF), GLAD, and Hansen GFC relative to the December 31, 2020 deforestation cutoff date.",
      safeguard: "Maintains explicit provenance tiers: EXTERNAL_VERIFIED, CACHED_SNAPSHOT, SIMULATED. Never fabricates live satellite feeds.",
      badge: "TRANSPARENT PROVENANCE",
    },
    {
      id: "ai-processing",
      title: "AI-ASSISTED DOCUMENT PROCESSING",
      icon: Cpu,
      role: "Extracts shipment fields for human review.",
      mechanism:
        "Parses physical shipment documents (Bills of Lading, Phytosanitary inspection forms) with structured schema validation, normalizes diverse volume units (MT, bags) to standard metric kg, and verifies plot IDs.",
      safeguard: "Always subject to human operator verification before any claim is written to the ledger.",
      badge: "HUMAN-IN-THE-LOOP",
    },
    {
      id: "claim-ledger",
      title: "SHARED CLAIM LEDGER",
      icon: Database,
      role: "Enforces the production-allowance invariant for participating users.",
      mechanism:
        "EVM smart contract (SilvaPassRegistry.sol) maintains a shared state machine with non-repudiation and role-based access control (Registrar, Exporter, ClaimOperator), rejecting over-allocation atomically.",
      safeguard: "Applies strictly across participating participants; does not claim outside-system prevention or legal compliance guarantees.",
      badge: "MATHEMATICAL INVARIANT",
    },
  ];

  return (
    <section id="technology" className="py-24 px-6 relative border-t border-[#1b4332]/60 bg-[#07130F]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10251C] border border-[#1b4332] text-[#80DDB0] text-xs font-mono tracking-wider uppercase mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Integrity &amp; Engineering Standards
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F2F5ED] mb-6 leading-tight">
            Evidence first. Claims second.
          </h2>
          <p className="text-base sm:text-lg text-[#A2B4A8] leading-relaxed">
            SilvaPass avoids speculative hype and exaggerated compliance promises. Every capability is anchored in verifiable geospatial mathematics, auditable smart contract rules, and clear boundary disclosures.
          </p>
        </div>

        {/* 4 Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                className="bg-[#10251C] border border-[#1b4332] rounded-2xl p-7 shadow-xl flex flex-col justify-between hover:border-[#80DDB0]/40 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono tracking-wider px-2.5 py-1 rounded bg-[#07130F] text-[#B7ED78] border border-[#1b4332]">
                      {pillar.badge}
                    </span>
                    <div className="w-9 h-9 rounded-lg bg-[#07130F] border border-[#1b4332] flex items-center justify-center text-[#80DDB0]">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold font-mono text-[#F2F5ED] mb-2">{pillar.title}</h3>
                  <p className="text-sm font-semibold text-[#80DDB0] mb-4">{pillar.role}</p>

                  <div className="space-y-3 font-mono text-xs text-[#A2B4A8] mb-6 leading-relaxed">
                    <div className="p-3 rounded-lg bg-[#07130F] border border-[#1b4332]">
                      <span className="text-[#F2F5ED] font-semibold block mb-1">Implementation Mechanism:</span>
                      {pillar.mechanism}
                    </div>
                  </div>
                </div>

                {/* Safeguard / Limitation Disclosure */}
                <div className="pt-4 border-t border-[#1b4332]/60 font-mono text-xs">
                  <div className="flex items-start gap-2 text-[#F59E0B]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[11px] uppercase tracking-wider block">
                        Safety Guard &amp; Limitation:
                      </span>
                      <p className="text-[11px] text-[#A2B4A8] mt-0.5 leading-relaxed">
                        {pillar.safeguard}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Prototype Scope & Boundary Transparency Card */}
        <div className="bg-[#07130F] border border-[#1b4332] rounded-2xl p-7 font-mono text-xs text-[#A2B4A8] relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#1b4332]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B7ED78]" />
              <span className="text-sm font-bold text-[#F2F5ED]">
                PROTOTYPE SCOPE &amp; BOUNDARY CONDITIONS
              </span>
            </div>
            <span className="text-[11px] text-[#80DDB0]">IEEE ClimateChain Global Hackathon 2026</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
            <div>
              <span className="text-[#F2F5ED] font-semibold block mb-1.5">No Fabricated Impact Metrics</span>
              <p className="text-[11px] leading-relaxed">
                SilvaPass does not advertise synthetic claims of avoided deforestation or fictional carbon offsets. It provides reproducible, auditable operational evidence.
              </p>
            </div>
            <div>
              <span className="text-[#F2F5ED] font-semibold block mb-1.5">Participating Network Scope</span>
              <p className="text-[11px] leading-relaxed">
                The smart contract invariant prevents double-claiming across registered participants in the system. It does not monitor external untracked transactions.
              </p>
            </div>
            <div>
              <span className="text-[#F2F5ED] font-semibold block mb-1.5">Evidence Provenance</span>
              <p className="text-[11px] leading-relaxed">
                WHISP screenings use standardized FAO Open Foris indicators relative to the Dec 31, 2020 baseline cutoff, transparently labeled by data provenance tier.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
