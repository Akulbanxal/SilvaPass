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
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Compass,
  ArrowRight,
} from "lucide-react";

interface PlotRegistrationScreenProps {
  onPlotRegistered?: (plotId: string) => void;
  onNavigateToReviews?: () => void;
}

export const PlotRegistrationScreen: React.FC<PlotRegistrationScreenProps> = ({
  onPlotRegistered,
  onNavigateToReviews,
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
  const [editorOpen, setEditorOpen] = useState<boolean>(true);

  const parsedGeojson = (() => {
    try {
      return JSON.parse(geojsonInput);
    } catch {
      return null;
    }
  })();

  const handleValidate = async () => {
    if (!parsedGeojson) {
      setError("Please input a valid GeoJSON object.");
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
      setError("Please input a valid GeoJSON object.");
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE5DE]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#172820]">
              Plot Registry
            </h2>
            <span className="font-mono text-[11px] bg-slate-100 text-[#65756C] px-2 py-0.5 rounded border border-[#DCE5DE]">
              EPSG:4326 (WGS84)
            </span>
          </div>
          <p className="text-sm text-[#65756C] mt-1">
            Register agricultural boundaries, validate geometry, and identify potential duplicate registrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#65756C] bg-white px-2.5 py-1 rounded-md border border-[#DCE5DE]">
            Geodesic Metric Engine &bull; UTM Zone 21S
          </span>
        </div>
      </div>

      {/* Synthetic Test Fixture Strip */}
      <div className="p-3.5 bg-white rounded-lg border border-[#DCE5DE] shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#172820]">
              Synthetic Test Fixtures
            </span>
            <span className="text-[10px] font-mono font-semibold bg-[#B7791F]/10 text-[#B7791F] px-2 py-0.5 rounded border border-[#B7791F]/30">
              SIMULATED TEST DATA
            </span>
          </div>
          <span className="text-[11px] text-[#65756C]">
            Select benchmark coordinates to test spatial deduplication
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => loadFixture(DEMO_BASE_PLOT, "PLOT-BASE-DEMO")}
            className="text-left p-2 rounded-md bg-[#F5F7F4] hover:bg-[#DCE5DE]/50 border border-[#DCE5DE] transition cursor-pointer"
          >
            <div className="text-xs font-semibold text-[#172820]">1. Base Plot</div>
            <div className="text-[11px] text-[#65756C] font-mono">~30.06 ha &bull; Ground cadastre</div>
          </button>
          <button
            onClick={() => loadFixture(DEMO_JITTERED_PLOT, "PLOT-JITTERED-DEMO")}
            className="text-left p-2 rounded-md bg-[#F5F7F4] hover:bg-[#DCE5DE]/50 border border-[#DCE5DE] transition cursor-pointer"
          >
            <div className="text-xs font-semibold text-[#172820]">2. Jittered Vertices</div>
            <div className="text-[11px] text-[#65756C] font-mono">+1.27m noise &bull; High IoU</div>
          </button>
          <button
            onClick={() => loadFixture(DEMO_AMBIGUOUS_OVERLAP_PLOT, "PLOT-AMBIGUOUS-DEMO")}
            className="text-left p-2 rounded-md bg-[#F5F7F4] hover:bg-[#DCE5DE]/50 border border-[#DCE5DE] transition cursor-pointer"
          >
            <div className="text-xs font-semibold text-[#172820]">3. Ambiguous Overlap</div>
            <div className="text-[11px] text-[#65756C] font-mono">~42% IoU &bull; Review queue</div>
          </button>
          <button
            onClick={() => loadFixture(DEMO_ADJACENT_PLOT, "PLOT-ADJACENT-DEMO")}
            className="text-left p-2 rounded-md bg-[#F5F7F4] hover:bg-[#DCE5DE]/50 border border-[#DCE5DE] transition cursor-pointer"
          >
            <div className="text-xs font-semibold text-[#172820]">4. Adjacent Neighbor</div>
            <div className="text-[11px] text-[#65756C] font-mono">Fence line &bull; Disjoint 0% IoU</div>
          </button>
        </div>
      </div>

      {/* Two-Column Operational Layout: 44% Left / 56% Right on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form & GeoJSON Editor (approx 44%) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-lg border border-[#DCE5DE] shadow-xs space-y-4">
            {/* Group: IDENTITY */}
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#65756C] mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#237A57]" />
                <span>Identity Parameters</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-1">
                  <label className="block text-[11px] font-semibold text-[#172820]">Plot ID</label>
                  <input
                    type="text"
                    value={plotIdInput}
                    onChange={(e) => setPlotIdInput(e.target.value)}
                    className="mt-1 w-full text-xs font-mono px-2.5 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] focus:ring-1 focus:ring-[#237A57] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#172820]">Country</label>
                  <input
                    type="text"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="mt-1 w-full text-xs font-mono px-2.5 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] focus:ring-1 focus:ring-[#237A57] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#172820]">Crop</label>
                  <input
                    type="text"
                    value={cropCode}
                    onChange={(e) => setCropCode(e.target.value)}
                    className="mt-1 w-full text-xs font-mono px-2.5 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] focus:ring-1 focus:ring-[#237A57] outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Group: GEOMETRY */}
            <div className="pt-2 border-t border-[#DCE5DE]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#65756C] flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-[#237A57]" />
                  <span>Geometry Payload (GeoJSON)</span>
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      parsedGeojson
                        ? "bg-[#16805D]/10 text-[#16805D]"
                        : "bg-[#B83A3A]/10 text-[#B83A3A]"
                    }`}
                  >
                    {parsedGeojson ? "Valid JSON" : "Invalid JSON"}
                  </span>
                  <button
                    onClick={() => setEditorOpen(!editorOpen)}
                    className="text-[11px] text-[#237A57] hover:underline cursor-pointer"
                  >
                    {editorOpen ? "Collapse" : "Expand"}
                  </button>
                </div>
              </div>

              {editorOpen && (
                <textarea
                  rows={9}
                  value={geojsonInput}
                  onChange={(e) => setGeojsonInput(e.target.value)}
                  className="w-full text-xs font-mono p-3 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] focus:ring-1 focus:ring-[#237A57] outline-hidden leading-relaxed"
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleValidate}
                disabled={loading || !parsedGeojson}
                className="flex-1 py-2 px-3 text-xs font-semibold text-[#172820] bg-white hover:bg-[#F5F7F4] border border-[#DCE5DE] rounded-md transition cursor-pointer disabled:opacity-50"
              >
                Validate Geometry
              </button>
              <button
                onClick={handleRegister}
                disabled={loading || !parsedGeojson}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-[#237A57] hover:bg-[#103126] rounded-md transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>{loading ? "Processing..." : "Register & Check Duplicates"}</span>
              </button>
            </div>

            {error && (
              <div className="p-3 bg-[#B83A3A]/10 border border-[#B83A3A]/25 rounded-md text-xs text-[#B83A3A] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Validation Outcome Details */}
          {validation && (
            <div className="bg-white p-4 rounded-lg border border-[#DCE5DE] shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#172820]">Topology Validation Result</span>
                <span
                  className={`text-xs font-semibold flex items-center gap-1 ${
                    validation.is_valid ? "text-[#16805D]" : "text-[#B83A3A]"
                  }`}
                >
                  {validation.is_valid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      PASSED (WGS84 Closed Ring)
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      INVALID GEOMETRY
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#DCE5DE]/60">
                <div className="p-2 bg-[#F5F7F4] rounded">
                  <span className="text-[11px] text-[#65756C]">Geodesic Area:</span>
                  <p className="font-mono font-bold text-[#172820] tabular-nums">
                    {validation.geodesic_area_ha} ha
                  </p>
                </div>
                <div className="p-2 bg-[#F5F7F4] rounded">
                  <span className="text-[11px] text-[#65756C]">Geodesic Perimeter:</span>
                  <p className="font-mono font-bold text-[#172820] tabular-nums">
                    {validation.geodesic_perimeter_m} m
                  </p>
                </div>
                <div className="p-2 bg-[#F5F7F4] rounded">
                  <span className="text-[11px] text-[#65756C]">Vertices:</span>
                  <p className="font-mono font-bold text-[#172820] tabular-nums">
                    {validation.vertex_count}
                  </p>
                </div>
                <div className="p-2 bg-[#F5F7F4] rounded">
                  <span className="text-[11px] text-[#65756C]">H3 Index Cells (Res 8):</span>
                  <p className="font-mono font-bold text-[#172820] tabular-nums">
                    {validation.h3_indices_res8.length} cells
                  </p>
                </div>
              </div>

              <div className="text-[10px] font-mono text-[#65756C] truncate bg-[#F5F7F4] p-1.5 rounded">
                SHA-256 Fingerprint: {validation.canonical_fingerprint}
              </div>
            </div>
          )}

          {/* Registration Outcome Details */}
          {registration && (
            <div className="bg-white p-4 rounded-lg border border-[#237A57]/60 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#65756C]">Registration Result</span>
                  <h4 className="text-sm font-bold text-[#172820] font-mono">
                    {registration.plot_id}
                  </h4>
                </div>
                <StatusBadge status={registration.status} />
              </div>

              <p className="text-xs text-[#172820] font-medium leading-relaxed">
                {registration.message}
              </p>

              <div className="text-xs text-[#65756C] bg-[#F5F7F4] p-2 rounded flex items-center justify-between">
                <span>
                  Classification: <strong className="font-mono text-[#172820]">{registration.classification}</strong>
                </span>
                <span className="font-mono text-[10px]">Policy: {registration.policy_version}</span>
              </div>

              {registration.similarity_evidence && registration.similarity_evidence.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-[#172820]">
                    Candidate Overlap Evidence ({registration.similarity_evidence.length}):
                  </span>
                  {registration.similarity_evidence.map((ev, i) => (
                    <div
                      key={i}
                      className="p-2.5 bg-[#B7791F]/5 border border-[#B7791F]/20 rounded text-xs text-[#172820] space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span>Candidate: <strong>{ev.candidate_plot_id}</strong></span>
                        <span className="font-bold text-[#B7791F]">IoU: {(ev.iou * 100).toFixed(1)}%</span>
                      </div>
                      <p className="text-[11px] text-[#65756C]">{ev.explanation}</p>
                    </div>
                  ))}
                  {registration.status === "PENDING_REVIEW" && onNavigateToReviews && (
                    <button
                      onClick={onNavigateToReviews}
                      className="w-full mt-2 py-1.5 px-3 rounded text-xs font-semibold text-[#B7791F] bg-[#B7791F]/10 hover:bg-[#B7791F]/20 border border-[#B7791F]/30 flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <span>Open in Duplicate Review Queue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Prominent Leaflet Map Workspace (approx 56%) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-lg border border-[#DCE5DE] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#172820] flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#237A57]" />
                Geospatial Boundary Map Workspace
              </h3>
              <p className="text-xs text-[#65756C]">
                Real-time interactive Leaflet canvas plotting WGS84 coordinates.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#65756C] bg-[#F5F7F4] px-2 py-0.5 rounded border border-[#DCE5DE]">
                Zoom 14 &bull; Center [-12.5, -54.5]
              </span>
            </div>
          </div>

          <MapPreview geojson={parsedGeojson || undefined} height="520px" />

          {/* Map Footer & Controls Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#65756C] pt-1 border-t border-[#DCE5DE]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#237A57] border border-[#16805D] opacity-80" />
                <span>Submitted Geometry Fill</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#16805D]" />
                <span>Geodesic Boundary Ring</span>
              </span>
            </div>
            <div className="text-[11px] font-mono text-[#65756C]">
              Tile Provider: OpenStreetMap WGS84
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
