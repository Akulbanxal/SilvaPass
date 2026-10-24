import React from "react";
import { Terminal } from "lucide-react";

interface LandingFooterProps {
  onOpenConsole?: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onOpenConsole }) => {
  return (
    <footer className="bg-[#040B08] border-t border-[#1b4332] text-[#A2B4A8] py-16 px-6 font-mono text-xs">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-[#1b4332]/60">
          {/* Col 1: Identity & Mission */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              {/* Custom SilvaPass Logo SVG */}
              <div className="w-8 h-8 rounded-lg bg-[#163327] border border-[#80DDB0]/40 flex items-center justify-center text-[#B7ED78] shadow-forest-glow">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
                  <path d="M12,7 L12,17 M7,12 L17,12" stroke="#80DDB0" strokeWidth="1.5" />
                </svg>
              </div>
              <div>
                <span className="text-base font-bold text-[#F2F5ED] tracking-tight">SilvaPass</span>
                <span className="text-[10px] text-[#80DDB0] block font-mono">
                  Evidence-Backed Plot Identity Protocol
                </span>
              </div>
            </div>

            <p className="text-xs text-[#A2B4A8] max-w-md leading-relaxed">
              An evidence-backed plot-identity and shipment-integrity protocol developed for the IEEE ClimateChain Global Hackathon 2026. Combining robust off-chain spatial resolution with an enforceable on-chain claim invariant.
            </p>

            <div className="flex items-center gap-2 pt-2 text-[11px] text-[#80DDB0]">
              <span className="w-2 h-2 rounded-full bg-[#B7ED78] animate-pulse" />
              <span>Local Testnet: Hardhat Node (Chain ID: 31337) &bull; FastAPI Backend: Healthy</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-[#F2F5ED] uppercase tracking-wider block mb-3">
              Protocol Navigation
            </span>
            <div>
              <a href="#platform" className="hover:text-[#B7ED78] transition">
                Platform &bull; The Problem
              </a>
            </div>
            <div>
              <a href="#how-it-works" className="hover:text-[#B7ED78] transition">
                How It Works &bull; 4 Stages
              </a>
            </div>
            <div>
              <a href="#integrity-protocol" className="hover:text-[#B7ED78] transition">
                Integrity Protocol &bull; Sandbox
              </a>
            </div>
            <div>
              <a href="#technology" className="hover:text-[#B7ED78] transition">
                Technology &bull; Architecture
              </a>
            </div>
            {onOpenConsole && (
              <div className="pt-2">
                <button
                  onClick={onOpenConsole}
                  className="text-[#80DDB0] hover:text-[#B7ED78] font-bold flex items-center gap-1 transition"
                >
                  <Terminal className="w-3.5 h-3.5" /> Launch Protocol Console
                </button>
              </div>
            )}
          </div>

          {/* Col 3: Standards & Repository */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-[#F2F5ED] uppercase tracking-wider block mb-3">
              Standards &amp; Hackathon
            </span>
            <div className="text-[11px] leading-relaxed">
              IEEE ClimateChain Global Hackathon 2026
            </div>
            <div className="text-[11px] text-[#A2B4A8]">
              FAO Open Foris WHISP Integration
            </div>
            <div className="text-[11px] text-[#A2B4A8]">
              Solidity 0.8.28 &bull; Hardhat &bull; Web3.py
            </div>
            <div className="text-[11px] text-[#A2B4A8]">
              H3 Hexagonal Grid &bull; Shapely Geodesics
            </div>
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[11px] text-[#A2B4A8]/80 leading-relaxed">
          <p className="max-w-3xl">
            <strong>Prototype Disclaimer:</strong> SilvaPass is an experimental climate-tech prototype built for the IEEE ClimateChain Global Hackathon 2026. All demonstrator coordinates, screening outputs, and transactions are anchored to local test environments. SilvaPass does not guarantee regulatory compliance, prove satellite fraud, or prevent claims outside participating nodes.
          </p>
          <div className="shrink-0 text-right">
            <span>&copy; 2026 SilvaPass Protocol</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
