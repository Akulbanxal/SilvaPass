import { useEffect, useState, useCallback } from "react";
import { checkHealth } from "./api/client";
import { OverviewScreen } from "./screens/OverviewScreen";
import { PlotRegistrationScreen } from "./screens/PlotRegistrationScreen";
import { DuplicateReviewScreen } from "./screens/DuplicateReviewScreen";
import { ClaimLedgerScreen } from "./screens/ClaimLedgerScreen";
import { ShipmentDocumentScreen } from "./screens/ShipmentDocumentScreen";
import { EnvironmentalScreeningScreen } from "./screens/EnvironmentalScreeningScreen";
import { EvidenceReportScreen } from "./screens/EvidenceReportScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ConsoleShell, type TabId } from "./components/ConsoleShell";
import { LandingPage } from "./landing/LandingPage";

type ViewMode = "landing" | "console";

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && (window.location.hash.includes("console") || window.location.search.includes("console"))) {
      return "console";
    }
    return "landing";
  });
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (["overview", "plots", "reviews", "ledger", "documents", "environmental", "evidence"].includes(hash)) {
        return hash as TabId;
      }
    }
    return "overview";
  });
  const [health, setHealth] = useState<{
    status: string;
    environment: string;
    whisp_mode: string;
    service?: string;
  } | null>(null);
  const [activePlotId, setActivePlotId] = useState<string>("PLOT-BASE-DEMO");
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.includes("console")) {
        setViewMode("console");
      }
      const tabMatch = window.location.hash.replace("#", "");
      if (["overview", "plots", "reviews", "ledger", "documents", "environmental", "evidence"].includes(tabMatch)) {
        setActiveTab(tabMatch as TabId);
        setViewMode("console");
      }
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (err: any) {
      console.warn("Backend connectivity check warning:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleSelectTab = (tabId: TabId) => {
    setActiveTab(tabId);
    setViewMode("console");
    if (typeof window !== "undefined") {
      window.location.hash = tabId;
    }
  };

  const handleReturnToLanding = () => {
    setViewMode("landing");
    if (typeof window !== "undefined") {
      window.location.hash = "";
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchHealth();
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

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
      {viewMode === "landing" ? (
        <LandingPage
          onOpenConsole={() => handleSelectTab("overview")}
          onSelectTab={(tabId) => handleSelectTab(tabId)}
          backendHealthy={health?.status === "healthy"}
          navItems={navItems}
          health={health}
        />
      ) : (
        <ConsoleShell
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onReturnToLanding={handleReturnToLanding}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          health={health}
        >
          <div key={refreshKey}>
            {activeTab === "overview" && (
              <OverviewScreen onNavigateTab={handleSelectTab} />
            )}
            {activeTab === "plots" && (
              <PlotRegistrationScreen
                onPlotRegistered={(id) => {
                  setActivePlotId(id);
                }}
                onNavigateToReviews={() => handleSelectTab("reviews")}
              />
            )}
            {activeTab === "reviews" && (
              <DuplicateReviewScreen
                onReviewResolved={() => {}}
                onNavigateToPlots={() => handleSelectTab("plots")}
              />
            )}
            {activeTab === "ledger" && (
              <ClaimLedgerScreen activePlotId={activePlotId} />
            )}
            {activeTab === "documents" && (
              <ShipmentDocumentScreen
                onConfirmed={() => {}}
                onNavigateToLedger={() => handleSelectTab("ledger")}
              />
            )}
            {activeTab === "environmental" && (
              <EnvironmentalScreeningScreen activePlotId={activePlotId} />
            )}
            {activeTab === "evidence" && (
              <EvidenceReportScreen activePlotId={activePlotId} />
            )}
          </div>
        </ConsoleShell>
      )}
    </ErrorBoundary>
  );
}

export default App;
