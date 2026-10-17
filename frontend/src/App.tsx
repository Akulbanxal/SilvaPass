import { useEffect, useState } from "react";
import { checkHealth } from "./api/client";
import { OverviewScreen } from "./screens/OverviewScreen";
import { PlotRegistrationScreen } from "./screens/PlotRegistrationScreen";
import { DuplicateReviewScreen } from "./screens/DuplicateReviewScreen";
import { ClaimLedgerScreen } from "./screens/ClaimLedgerScreen";
import { ShipmentDocumentScreen } from "./screens/ShipmentDocumentScreen";
import { EnvironmentalScreeningScreen } from "./screens/EnvironmentalScreeningScreen";
import { EvidenceReportScreen } from "./screens/EvidenceReportScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";

type TabId =
  | "overview"
  | "plots"
  | "reviews"
  | "ledger"
  | "documents"
  | "environmental"
  | "evidence";

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [health, setHealth] = useState<{ status: string; environment: string; whisp_mode: string } | null>(null);
  const [activePlotId, setActivePlotId] = useState<string>("PLOT-BASE-DEMO");

  useEffect(() => {
    checkHealth()
      .then((data) => setHealth(data))
      .catch((err) => console.warn("Backend connectivity check warning:", err.message));
  }, []);

  const navItems: { id: TabId; label: string }[] = [
    { id: "overview", label: "1. Overview & Boundaries" },
    { id: "plots", label: "2. Plot Ingestion & Map" },
    { id: "reviews", label: "3. Duplicate Review Queue" },
    { id: "ledger", label: "4. Claim Ledger Invariant" },
    { id: "documents", label: "5. Document Extraction" },
    { id: "environmental", label: "6. FAO WHISP Screening" },
    { id: "evidence", label: "7. Evidence Report" },
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f8faf9] flex flex-col text-slate-800">
        {/* Top Protocol Header */}
        <header className="bg-[#081c15] text-white border-b border-[#1b4332] px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#2d6a4f] flex items-center justify-center font-bold text-white text-sm shadow">
                SP
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white">SilvaPass Protocol</h1>
                <p className="text-[11px] text-[#95d5b2]">
                  Evidence-Backed Plot Identity &amp; Shared Claim Invariant &bull; IEEE ClimateChain 2026
                </p>
              </div>
            </div>

            {/* Health Connectivity Indicator */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1b4332] text-slate-200">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health?.status === "healthy" ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span>
                  Backend: {health ? `${health.status} (${health.environment})` : "Connecting..."}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Screening: {health?.whisp_mode || "SNAPSHOT"}
              </span>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="bg-white border-b border-[#e2e8e0] px-6">
          <div className="max-w-7xl mx-auto flex space-x-1 overflow-x-auto py-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded transition whitespace-nowrap ${
                  activeTab === item.id
                    ? "bg-[#1b4332] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
          {activeTab === "overview" && <OverviewScreen />}
          {activeTab === "plots" && (
            <PlotRegistrationScreen
              onPlotRegistered={(id) => {
                setActivePlotId(id);
              }}
            />
          )}
          {activeTab === "reviews" && <DuplicateReviewScreen />}
          {activeTab === "ledger" && <ClaimLedgerScreen activePlotId={activePlotId} />}
          {activeTab === "documents" && <ShipmentDocumentScreen />}
          {activeTab === "environmental" && <EnvironmentalScreeningScreen activePlotId={activePlotId} />}
          {activeTab === "evidence" && <EvidenceReportScreen activePlotId={activePlotId} />}
        </main>

        {/* Footer with Non-Claim Disclaimer */}
        <footer className="bg-white border-t border-[#e2e8e0] px-6 py-4 text-center text-xs text-slate-500">
          <p>
            SilvaPass &bull; IEEE ClimateChain Global Hackathon 2026 Prototype. All demonstrator coordinates and transactions are anchored to local Hardhat test nodes.
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
