import React, { useState } from "react";
import { validatePlot, registerPlot } from "../api/client";
import { MapPreview } from "../components/MapPreview";
import { StatusBadge } from "../components/Badges";
import {
  DEMO_BASE_PLOT,
  DEMO_JITTERED_PLOT,
  DEMO_AMBIGUOUS_OVERLAP_PLOT,
  DEMO_ADJACENT_PLOT,
} from "../types/demoFixtures";
import type { PlotValidationResponse, PlotRegistrationResponse } from "../types";

export const PlotRegistrationScreen: React.FC<{ onPlotRegistered?: (plotId: string) => void }> = ({
  onPlotRegistered,
}) => {
  const [plotIdInput, setPlotIdInput] = useState<string>("PLOT-BASE-DEMO");
  const [countryCode, setCountryCode] = useState<string>("BR");
  const [cropCode, setCropCode] = useState<string>("SOY");
  const [geojsonInput, setGeojsonInput] = useState<string>(
    JSON.stringify(DEMO_BASE_PLOT, null, 2)
  );

  const [validation, setValidation] = useState<PlotValidationResponse | null>(null);
  const [registration, setRegistration] = useState<PlotRegistrationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const parsedGeojson = (() => {
    try {
      return JSON.parse(geojsonInput);
    } catch {
      return null;
    }
  })();

  const handleValidate = async () => {
    if (!parsedGeojson) {
      setError("Please input a valid JSON dictionary.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await validatePlot(parsedGeojson);
      setValidation(res);
      setRegistration(null);
    } catch (err: any) {
      setError(err.message || "Validation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!parsedGeojson) {
      setError("Please input a valid JSON dictionary.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await registerPlot({
        plot_id: plotIdInput.trim() || undefined,
        geometry: parsedGeojson,
        country_code: countryCode,
        crop_code: cropCode,
      });
      setRegistration(res);
      if (onPlotRegistered) {
        onPlotRegistered(res.plot_id);
      }
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const loadFixture = (fixture: Record<string, any>, suggestedId: string) => {
    setPlotIdInput(suggestedId);
    setGeojsonInput(JSON.stringify(fixture, null, 2));
    setValidation(null);
    setRegistration(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-[#e2e8e0] shadow-sm">
        <h2 className="text-xl font-bold text-[#081c15] tracking-tight">
          Plot Ingestion &amp; Geometry Validation
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Upload WGS84 GeoJSON boundaries. The spatial engine validates topology, calculates geodesic area/perimeter, and detects coordinate alterations.
        </p>

        {/* Synthetic test fixtures selector */}
        <div className="mt-4 p-3 bg-[#f8faf9] rounded border border-[#e2e8e0]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1b4332] uppercase tracking-wider">
              Quick Test Fixtures (Synthetic Labeled Datasets)
            </span>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">
              [SIMULATED FIXTURES]
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => loadFixture(DEMO_BASE_PLOT, "PLOT-BASE-DEMO")}
              className="text-xs px-2.5 py-1.5 bg-white border border-[#cbd5e1] hover:border-[#1b4332] rounded text-slate-700 font-medium transition"
            >
              1. Base Plot (~30 ha)
            </button>
            <button
              onClick={() => loadFixture(DEMO_JITTERED_PLOT, "PLOT-JITTERED-DEMO")}
              className="text-xs px-2.5 py-1.5 bg-white border border-[#cbd5e1] hover:border-[#1b4332] rounded text-slate-700 font-medium transition"
            >
              2. Jittered Vertices (3–5m noise)
            </button>
            <button
              onClick={() => loadFixture(DEMO_AMBIGUOUS_OVERLAP_PLOT, "PLOT-AMBIGUOUS-DEMO")}
              className="text-xs px-2.5 py-1.5 bg-white border border-[#cbd5e1] hover:border-[#1b4332] rounded text-slate-700 font-medium transition"
            >
              3. Ambiguous Overlap (~40%)
            </button>
            <button
              onClick={() => loadFixture(DEMO_ADJACENT_PLOT, "PLOT-ADJACENT-DEMO")}
              className="text-xs px-2.5 py-1.5 bg-white border border-[#cbd5e1] hover:border-[#1b4332] rounded text-slate-700 font-medium transition"
            >
              4. Adjacent Neighbor (Fence line)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Form & JSON editor */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700">Plot Identifier</label>
                <input
                  type="text"
                  value={plotIdInput}
                  onChange={(e) => setPlotIdInput(e.target.value)}
                  className="mt-1 w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#1b4332] focus:border-[#1b4332]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Country Code</label>
                <input
                  type="text"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="mt-1 w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#1b4332] focus:border-[#1b4332]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Crop Code</label>
                <input
                  type="text"
                  value={cropCode}
                  onChange={(e) => setCropCode(e.target.value)}
                  className="mt-1 w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#1b4332] focus:border-[#1b4332]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 flex justify-between">
                <span>GeoJSON Coordinates Payload (WGS84)</span>
                {parsedGeojson ? (
                  <span className="text-emerald-700 text-xs font-mono">Valid JSON</span>
                ) : (
                  <span className="text-red-600 text-xs font-mono">Invalid JSON syntax</span>
                )}
              </label>
              <textarea
                rows={11}
                value={geojsonInput}
                onChange={(e) => setGeojsonInput(e.target.value)}
                className="mt-1 w-full text-xs font-mono p-3 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1b4332]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleValidate}
                disabled={loading || !parsedGeojson}
                className="px-4 py-2 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition disabled:opacity-50"
              >
                Validate Geometry Only
              </button>
              <button
                onClick={handleRegister}
                disabled={loading || !parsedGeojson}
                className="px-4 py-2 text-xs font-semibold rounded bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition disabled:opacity-50"
              >
                {loading ? "Processing..." : "Register & Deduplicate Plot"}
              </button>
            </div>

            {error && (
              <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>

          {/* Map & Results */}
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-700">
              Interactive Boundary Map Preview
            </label>
            <MapPreview geojson={parsedGeojson || undefined} height="280px" />

            {/* Validation Outcome Details */}
            {validation && (
              <div className="p-4 bg-[#f8faf9] border border-[#e2e8e0] rounded text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-slate-800">Validation Outcome:</span>
                  <span className={validation.is_valid ? "text-emerald-700" : "text-red-700"}>
                    {validation.is_valid ? "PASSED (Topologically Valid)" : "FAILED"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                  <div>Area: <strong>{validation.geodesic_area_ha} ha</strong></div>
                  <div>Perimeter: <strong>{validation.geodesic_perimeter_m} m</strong></div>
                  <div>Vertices: <strong>{validation.vertex_count}</strong></div>
                  <div>H3 Res 8 Cells: <strong>{validation.h3_indices_res8.length}</strong></div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 truncate">
                  Fingerprint: {validation.canonical_fingerprint}
                </div>
              </div>
            )}

            {/* Registration Outcome Details */}
            {registration && (
              <div className="p-4 bg-white border border-[#1b4332] rounded text-xs space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#081c15] text-sm">{registration.plot_id}</span>
                  <StatusBadge status={registration.status} />
                </div>
                <p className="text-slate-700 font-medium">{registration.message}</p>
                <div className="text-slate-600">
                  Classification: <strong className="font-mono">{registration.classification}</strong> (Policy: {registration.policy_version})
                </div>

                {registration.similarity_evidence && registration.similarity_evidence.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <span className="font-semibold text-slate-800">Similarity Metrics Against Candidates:</span>
                    {registration.similarity_evidence.map((ev, i) => (
                      <div key={i} className="mt-1 p-2 bg-slate-50 rounded text-[11px] text-slate-700">
                        Candidate: <strong>{ev.candidate_plot_id}</strong> | IoU: <strong>{(ev.iou * 100).toFixed(1)}%</strong> | Centroid Drift: <strong>{ev.centroid_distance_m}m</strong>
                        <p className="text-slate-500 mt-0.5">{ev.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
