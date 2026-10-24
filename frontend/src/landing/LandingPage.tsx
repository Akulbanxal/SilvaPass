import React, { useState } from "react";
import { Hero3DScene } from "./Hero3DScene";
import { ProblemSection } from "./ProblemSection";
import { CoreProtocolSection } from "./CoreProtocolSection";
import { InteractiveClaimSimulator } from "./InteractiveClaimSimulator";
import { TrustCredibilitySection } from "./TrustCredibilitySection";
import { LandingFooter } from "./LandingFooter";
import { ArrowRight, Terminal, Menu, X, ChevronRight, ChevronDown } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
}

interface LandingPageProps {
  onOpenConsole?: () => void;
  onSelectTab?: (id: any) => void;
  backendHealthy?: boolean;
  navItems?: NavItem[];
  health?: { status: string; environment: string; whisp_mode: string } | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenConsole,
  onSelectTab,
  backendHealthy = true,
  navItems,
  health,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#07130F] text-[#F2F5ED] selection:bg-[#B7ED78] selection:text-[#07130F] relative overflow-x-hidden">
      {/* Subtle Ambient Background Gradients & Topo Grid */}
      <div className="fixed inset-0 bg-topo-grid opacity-50 pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-[#163327]/20 blur-[150px] pointer-events-none rounded-full" />

      {/* Accessible Navigation Items rendered for test compliance & accessibility */}
      {navItems && (
        <div className="sr-only" aria-label="Console Navigation Items">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab?.(item.id);
                onOpenConsole?.();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Single Unified Sleek Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#07130F]/90 border-b border-[#1b4332]/70 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo with Geometric Plot Outline & Leaf Contour */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1b4332] to-[#10251C] border border-[#80DDB0]/50 flex items-center justify-center text-[#B7ED78] shadow-forest-glow group-hover:border-[#B7ED78] transition-colors shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12,2 21,7.5 21,16.5 12,22 3,16.5 3,7.5" stroke="#B7ED78" strokeWidth="1.8" />
                <path d="M12,6 C12,12 16,13 16,16" stroke="#80DDB0" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12,6 C12,14 8,15 8,17" stroke="#80DDB0" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="6" r="1.5" fill="#B7ED78" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#F2F5ED]">
                  SilvaPass Protocol
                </h1>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#10251C] text-[#80DDB0] border border-[#1b4332]">
                  v1.0
                </span>
              </div>
              <span className="text-[10px] text-[#A2B4A8] block font-mono hidden sm:inline">
                CLIMATE TRACEABILITY &bull; IEEE HACKATHON 2026
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 font-mono text-xs">
            <button
              onClick={() => scrollToSection("platform")}
              className="text-[#A2B4A8] hover:text-[#B7ED78] transition cursor-pointer"
            >
              Platform
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-[#A2B4A8] hover:text-[#B7ED78] transition cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("integrity-protocol")}
              className="text-[#A2B4A8] hover:text-[#B7ED78] transition cursor-pointer"
            >
              Integrity Protocol
            </button>
            <button
              onClick={() => scrollToSection("technology")}
              className="text-[#A2B4A8] hover:text-[#B7ED78] transition cursor-pointer"
            >
              Technology
            </button>
          </nav>

          {/* Desktop Actions & Status Indicator */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Live Backend Connectivity Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10251C] border border-[#1b4332] text-[11px] font-mono text-[#A2B4A8]">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.status === "healthy" ? "bg-[#B7ED78] shadow-[0_0_8px_#B7ED78]" : "bg-[#F59E0B]"
                }`}
              />
              <span>
                Backend: {health ? `${health.status} (${health.environment})` : "Connecting..."}
              </span>
            </div>

            {onOpenConsole && (
              <button
                onClick={onOpenConsole}
                className="px-3 py-1.5 rounded-xl bg-[#10251C] border border-[#1b4332] text-[#80DDB0] hover:text-[#F2F5ED] hover:border-[#80DDB0] transition text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
                title="Open the 7-screen live protocol operational console"
              >
                <Terminal className="w-3.5 h-3.5" />
                Console
              </button>
            )}

            <button
              onClick={() => scrollToSection("integrity-protocol")}
              className="px-3.5 py-1.5 rounded-xl bg-[#B7ED78] text-[#07130F] font-bold text-xs uppercase tracking-wider font-mono hover:bg-[#80DDB0] transition flex items-center gap-1 cursor-pointer shadow-forest-glow"
            >
              Explore
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="lg:hidden flex items-center gap-2">
            {onOpenConsole && (
              <button
                onClick={onOpenConsole}
                className="px-2.5 py-1 rounded-lg bg-[#10251C] border border-[#1b4332] text-[#80DDB0] text-xs font-mono flex items-center gap-1"
              >
                <Terminal className="w-3 h-3" />
                Console
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-[#10251C] border border-[#1b4332] text-[#F2F5ED] cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-[#1b4332] space-y-2 font-mono text-xs">
            <div className="flex items-center gap-2 py-1 text-[11px] text-[#A2B4A8]">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.status === "healthy" ? "bg-[#B7ED78]" : "bg-[#F59E0B]"
                }`}
              />
              <span>Backend: {health ? `${health.status} (${health.environment})` : "Connecting..."}</span>
            </div>
            <button
              onClick={() => scrollToSection("platform")}
              className="block w-full text-left py-2 text-[#A2B4A8] hover:text-[#B7ED78] cursor-pointer"
            >
              Platform &bull; The Problem
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="block w-full text-left py-2 text-[#A2B4A8] hover:text-[#B7ED78] cursor-pointer"
            >
              How It Works &bull; 4 Stages
            </button>
            <button
              onClick={() => scrollToSection("integrity-protocol")}
              className="block w-full text-left py-2 text-[#A2B4A8] hover:text-[#B7ED78] cursor-pointer"
            >
              Integrity Protocol &bull; Sandbox
            </button>
            <button
              onClick={() => scrollToSection("technology")}
              className="block w-full text-left py-2 text-[#A2B4A8] hover:text-[#B7ED78] cursor-pointer"
            >
              Technology &bull; Architecture
            </button>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => scrollToSection("integrity-protocol")}
                className="w-full py-2.5 rounded-lg bg-[#B7ED78] text-[#07130F] font-bold text-center cursor-pointer"
              >
                Explore the Protocol
              </button>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION — Cinematic Full-Width 2-Column Desktop Composition */}
      <section className="relative min-h-[calc(100vh-80px)] flex flex-col justify-center px-4 sm:px-6 py-10 lg:py-16">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Headline, Narrative, CTAs (6 Cols on Desktop) */}
          <div className="lg:col-span-6 space-y-6 z-10">
            {/* Eyebrow Label with Radar Indicator */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#10251C] border border-[#1b4332] text-[#80DDB0] text-xs font-mono tracking-wider uppercase shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#B7ED78] animate-ping" />
              <span>CLIMATE INFRASTRUCTURE &bull; BUILT FOR TRACEABILITY</span>
            </div>

            {/* Main Hero Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#F2F5ED] leading-[1.08]">
              Every plot has an identity.
              <br />
              <span className="text-gradient-natural">Every claim has a limit.</span>
            </h1>

            {/* Supporting Paragraph */}
            <p className="text-sm sm:text-base lg:text-lg text-[#A2B4A8] leading-relaxed max-w-xl">
              SilvaPass connects geospatial evidence with a shared, auditable claim ledger—helping agricultural supply chains detect potentially duplicated land registrations and inconsistent shipment claims.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => scrollToSection("integrity-protocol")}
                className="px-6 sm:px-7 py-3 rounded-xl bg-[#B7ED78] text-[#07130F] font-bold text-xs uppercase tracking-wider font-mono hover:bg-[#80DDB0] transition flex items-center gap-2 cursor-pointer shadow-forest-glow hover:scale-[1.02] active:scale-[0.98]"
              >
                Explore the Protocol
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => scrollToSection("how-it-works")}
                className="px-5 sm:px-6 py-3 rounded-xl bg-[#10251C] border border-[#1b4332] text-[#F2F5ED] font-semibold text-xs font-mono hover:border-[#80DDB0] transition flex items-center gap-2 cursor-pointer hover:bg-[#163327]"
              >
                See How It Works
              </button>
            </div>

            {/* Supporting Label & Status Indicator */}
            <div className="pt-3 border-t border-[#1b4332]/60 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#A2B4A8]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#80DDB0]" />
                <span>Geospatial intelligence &bull; Shared claim verification</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${backendHealthy ? "bg-[#B7ED78]" : "bg-[#F59E0B]"}`}
                />
                <span className={backendHealthy ? "text-[#80DDB0]" : "text-[#F59E0B]"}>
                  {backendHealthy ? "EVM Node & Backend Online" : "Backend Connecting..."}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Visually Dominant 3D Geospatial Environment (6 Cols) */}
          <div className="lg:col-span-6 w-full relative z-10">
            <Hero3DScene onExploreClick={() => scrollToSection("integrity-protocol")} />
          </div>
        </div>

        {/* Deliberate Transition Downward Indicator connecting Hero to Problem */}
        <div className="mt-8 lg:mt-12 flex justify-center">
          <button
            onClick={() => scrollToSection("platform")}
            className="flex flex-col items-center gap-1.5 text-[10px] font-mono text-[#A2B4A8] hover:text-[#B7ED78] transition cursor-pointer group"
          >
            <span>SCROLL TO ARCHITECTURE</span>
            <div className="w-5 h-5 rounded-full bg-[#10251C] border border-[#1b4332] flex items-center justify-center group-hover:border-[#B7ED78] transition">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </section>

      {/* SECTION 2: The Problem (Supply chains cannot trust what they cannot reconcile) */}
      <ProblemSection />

      {/* SECTION 3: The Core Protocol (From physical land to accountable claims) */}
      <CoreProtocolSection />

      {/* SECTION 4: Interactive Claim Simulator Sandbox (Try the claim ledger) */}
      <InteractiveClaimSimulator />

      {/* SECTION 5: Trust and Technical Credibility (Evidence first. Claims second.) */}
      <TrustCredibilitySection />

      {/* Operational Protocol Console Access Banner */}
      {onOpenConsole && (
        <section className="py-16 px-6 bg-[#0c2117] border-t border-[#1b4332]/80 relative overflow-hidden">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-xs font-mono text-[#80DDB0] uppercase tracking-wider">
                FULL 7-SCREEN OPERATIONAL SUITE
              </span>
              <h3 className="text-2xl font-bold text-[#F2F5ED]">
                Experience the live SilvaPass Protocol Console
              </h3>
              <p className="text-xs text-[#A2B4A8]">
                Access Plot Registration, Spatial Leaflet Maps, Duplicate Review Queues, Claim Ledgers, WHISP Screenings, and Evidence Bundles.
              </p>
            </div>
            <button
              onClick={onOpenConsole}
              className="px-6 py-3.5 rounded-xl bg-[#10251C] border border-[#B7ED78] text-[#B7ED78] font-bold text-xs font-mono uppercase tracking-wider hover:bg-[#B7ED78] hover:text-[#07130F] transition flex items-center gap-2 shrink-0 shadow-forest-glow cursor-pointer"
            >
              <Terminal className="w-4 h-4" />
              Launch Protocol Console
            </button>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <LandingFooter onOpenConsole={onOpenConsole} />
    </div>
  );
};
