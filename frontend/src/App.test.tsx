import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

describe("SilvaPass Protocol Application Tests", () => {
  it("renders SilvaPass navigation items and health indicator correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "healthy",
          service: "silvapass-backend",
          environment: "development",
          whisp_mode: "SNAPSHOT",
        }),
      })
    );

    render(<App />);

    expect(screen.getByText("SilvaPass Protocol")).toBeDefined();
    expect(screen.getByText("1. Overview & Boundaries")).toBeDefined();
    expect(screen.getByText("2. Plot Ingestion & Map")).toBeDefined();
    expect(screen.getByText("3. Duplicate Review Queue")).toBeDefined();
    expect(screen.getByText("4. Claim Ledger Invariant")).toBeDefined();
    expect(screen.getByText("5. Document Extraction")).toBeDefined();
    expect(screen.getByText("6. FAO WHISP Screening")).toBeDefined();
    expect(screen.getByText("7. Evidence Report")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/healthy/i)).toBeDefined();
    });

    vi.unstubAllGlobals();
  });
});
