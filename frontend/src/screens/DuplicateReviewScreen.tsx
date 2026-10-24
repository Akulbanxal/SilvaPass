import React, { useEffect, useState, useCallback } from "react";
import { listPendingReviews, adjudicateReview, getPlot } from "../api/client";
import { MapPreview } from "../components/MapPreview";
import { StatusBadge } from "../components/Badges";
import type { SpatialReviewItem, PlotRecord, ReviewStatus } from "../types";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Info,
} from "lucide-react";

interface DuplicateReviewScreenProps {
  onReviewResolved?: () => void;
  onNavigateToPlots?: () => void;
}

export const DuplicateReviewScreen: React.FC<DuplicateReviewScreenProps> = ({
  onReviewResolved,
  onNavigateToPlots,
}) => {
  const [reviews, setReviews] = useState<SpatialReviewItem[]>([]);
  const [selectedReview, setSelectedReview] = useState<SpatialReviewItem | null>(null);
  const [submittedPlot, setSubmittedPlot] = useState<PlotRecord | null>(null);
  const [conflictingPlot, setConflictingPlot] = useState<PlotRecord | null>(null);

  const [operatorId, setOperatorId] = useState<string>("OP-SUPERVISOR-42");
  const [justification, setJustification] = useState<string>(
    "Verified on-ground cadastral benchmark monument. Legitimate boundary easement granted under local title."
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Confirmation dialog state
  const [pendingAction, setPendingAction] = useState<ReviewStatus | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPendingReviews();
      setReviews(data);
      if (data.length > 0) {
        setSelectedReview((prev) => {
          if (prev && data.some((r) => r.review_id === prev.review_id)) {
            return prev;
          }
          return data[0];
        });
      } else {
        setSelectedReview(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (!selectedReview) {
      setSubmittedPlot(null);
      setConflictingPlot(null);
      return;
    }

    let isMounted = true;
    async function loadPlotGeometries() {
      if (!selectedReview) return;
      try {
        const [sub, conf] = await Promise.all([
          getPlot(selectedReview.submitted_plot_id).catch(() => null),
          getPlot(selectedReview.conflicting_plot_id).catch(() => null),
        ]);
        if (isMounted) {
          setSubmittedPlot(sub);
          setConflictingPlot(conf);
        }
      } catch (err: any) {
        console.error("Error loading plot details for comparison:", err);
      }
    }
    loadPlotGeometries();
    return () => {
      isMounted = false;
    };
  }, [selectedReview]);

  const confirmAdjudication = async () => {
    if (!selectedReview || !pendingAction) return;
    if (justification.trim().length < 15) {
      setError("Please provide a comprehensive justification of at least 15 characters.");
      setPendingAction(null);
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await adjudicateReview(
        selectedReview.review_id,
        pendingAction,
        operatorId,
        justification
      );
      setSuccessMsg(
        `Review adjudicated successfully! Plot '${selectedReview.submitted_plot_id}' updated to status '${res.new_plot_status}'.`
      );
      setPendingAction(null);
      await fetchReviews();
      if (onReviewResolved) {
        onReviewResolved();
      }
    } catch (err: any) {
      setError(err.message || "Adjudication failed");
    } finally {
      setActionLoading(false);
    }
  };

  const parseGeojson = (raw?: string) => {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE5DE]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#172820]">
              Duplicate Review
            </h2>
            <span
              className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-medium ${
                reviews.length > 0
                  ? "bg-[#B7791F]/15 text-[#B7791F] border border-[#B7791F]/30"
                  : "bg-[#16805D]/10 text-[#16805D] border border-[#16805D]/25"
              }`}
            >
              {reviews.length} pending review cases
            </span>
          </div>
          <p className="text-sm text-[#65756C] mt-1">
            Investigate potential plot identity conflicts and resolve ambiguous boundary matches.
          </p>
        </div>
        <button
          onClick={fetchReviews}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#65756C] bg-white hover:text-[#172820] hover:bg-[#F5F7F4] border border-[#DCE5DE] rounded-md transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-[#B83A3A]/10 border border-[#B83A3A]/25 rounded-md text-xs text-[#B83A3A] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-[#16805D]/10 border border-[#16805D]/25 rounded-md text-xs text-[#16805D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Empty State when 0 reviews */}
      {!loading && reviews.length === 0 && (
        <div className="bg-white p-12 rounded-lg border border-[#DCE5DE] shadow-xs text-center space-y-4 max-w-2xl mx-auto my-6">
          <div className="w-12 h-12 rounded-full bg-[#16805D]/10 text-[#16805D] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#172820]">No Pending Review Cases</h3>
            <p className="text-xs text-[#65756C] mt-1 leading-relaxed max-w-md mx-auto">
              All registered plot boundaries are currently confirmed distinct or previously adjudicated. The continuous IoU deduplication queue is clear.
            </p>
          </div>
          {onNavigateToPlots && (
            <div className="pt-2">
              <button
                onClick={onNavigateToPlots}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#237A57] hover:bg-[#103126] rounded-md transition shadow-xs cursor-pointer"
              >
                <span>Register Overlapping Plot in Registry</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Two-Panel Review Workbench */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Review Queue List (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-[#DCE5DE] shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-[#DCE5DE] bg-[#F5F7F4] flex items-center justify-between">
              <span className="text-xs font-bold text-[#172820] uppercase font-mono tracking-wider">
                Conflict Queue ({reviews.length})
              </span>
              <span className="text-[11px] text-[#65756C]">Sorted by IoU</span>
            </div>

            <div className="divide-y divide-[#DCE5DE] max-h-[560px] overflow-y-auto">
              {reviews.map((r) => {
                const isSelected = selectedReview?.review_id === r.review_id;
                return (
                  <div
                    key={r.review_id}
                    onClick={() => setSelectedReview(r)}
                    className={`p-3.5 text-xs cursor-pointer transition ${
                      isSelected
                        ? "bg-[#103126]/5 border-l-4 border-[#237A57]"
                        : "hover:bg-[#F5F7F4]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-[#172820] truncate">
                        {r.submitted_plot_id}
                      </span>
                      <span className="font-mono font-bold text-[11px] text-[#B7791F] bg-[#B7791F]/10 px-1.5 py-0.5 rounded border border-[#B7791F]/25">
                        IoU: {(r.iou * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="text-[11px] text-[#65756C] flex items-center justify-between">
                      <span>vs. {r.conflicting_plot_id}</span>
                      <span className="font-mono text-[10px]">
                        Drift: {r.centroid_distance_m}m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Detailed Comparison Workspace (8 cols) */}
          {selectedReview && (
            <div className="lg:col-span-8 space-y-4">
              {/* Conflict Case Overview Card */}
              <div className="bg-white p-5 rounded-lg border border-[#DCE5DE] shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE5DE] pb-3">
                  <div>
                    <span className="text-[11px] font-mono text-[#65756C] uppercase">
                      Case #{selectedReview.review_id.slice(-8)}
                    </span>
                    <h3 className="text-base font-bold text-[#172820] font-mono mt-0.5">
                      {selectedReview.submitted_plot_id} vs {selectedReview.conflicting_plot_id}
                    </h3>
                  </div>
                  <StatusBadge status={selectedReview.status} />
                </div>

                {/* Overlap Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-[#F5F7F4] rounded-md border border-[#DCE5DE]">
                    <span className="text-[11px] text-[#65756C]">Intersection / Union:</span>
                    <p className="font-mono font-bold text-[#B7791F] text-base mt-0.5">
                      {(selectedReview.iou * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-[#F5F7F4] rounded-md border border-[#DCE5DE]">
                    <span className="text-[11px] text-[#65756C]">Centroid Distance:</span>
                    <p className="font-mono font-bold text-[#172820] text-base mt-0.5">
                      {selectedReview.centroid_distance_m} m
                    </p>
                  </div>
                  <div className="p-3 bg-[#F5F7F4] rounded-md border border-[#DCE5DE]">
                    <span className="text-[11px] text-[#65756C]">Submitted Area:</span>
                    <p className="font-mono font-bold text-[#237A57] text-base mt-0.5">
                      {submittedPlot?.geodesic_area_ha ? `${submittedPlot.geodesic_area_ha.toFixed(2)} ha` : "..."}
                    </p>
                  </div>
                  <div className="p-3 bg-[#F5F7F4] rounded-md border border-[#DCE5DE]">
                    <span className="text-[11px] text-[#65756C]">Conflicting Area:</span>
                    <p className="font-mono font-bold text-[#B7791F] text-base mt-0.5">
                      {conflictingPlot?.geodesic_area_ha ? `${conflictingPlot.geodesic_area_ha.toFixed(2)} ha` : "..."}
                    </p>
                  </div>
                </div>

                {/* Dual-Polygon Comparison Map */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#172820]">
                      Overlaid Boundary Map Visualization
                    </span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#237A57] border border-[#16805D]" />
                        <span>Submitted (Solid Green)</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#B7791F]/30 border border-[#B7791F] border-dashed" />
                        <span>Existing Candidate (Dashed Amber)</span>
                      </span>
                    </div>
                  </div>

                  <MapPreview
                    geojson={parseGeojson(submittedPlot?.raw_geojson)}
                    comparisonGeojson={parseGeojson(conflictingPlot?.raw_geojson)}
                    height="320px"
                  />
                </div>

                {/* Adjudication Workbench Form */}
                <div className="pt-4 border-t border-[#DCE5DE] space-y-3">
                  <h4 className="text-xs font-bold text-[#172820] uppercase font-mono tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#237A57]" />
                    <span>Human Operator Adjudication</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#172820]">
                        Operator Identifier
                      </label>
                      <input
                        type="text"
                        value={operatorId}
                        onChange={(e) => setOperatorId(e.target.value)}
                        className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] focus:ring-1 focus:ring-[#237A57] outline-hidden"
                      />
                    </div>
                    <div className="text-xs text-[#65756C] flex items-center p-2 bg-[#F5F7F4] rounded-md border border-[#DCE5DE]">
                      <Info className="w-4 h-4 text-[#65756C] mr-2 shrink-0" />
                      <span>
                        Adjudication records are cryptographically anchored into the plot audit bundle.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#172820]">
                      Adjudication Justification &amp; Cadastral Evidence (min 15 chars)
                    </label>
                    <textarea
                      rows={2}
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      className="mt-1 w-full text-xs p-2.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] focus:ring-1 focus:ring-[#237A57] outline-hidden leading-relaxed"
                    />
                    <div className="flex justify-between text-[11px] text-[#65756C] mt-1">
                      <span>Requires minimum 15 characters for provenance trail</span>
                      <span className="font-mono">{justification.trim().length} chars</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={() => setPendingAction("CONFIRMED_DUPLICATE")}
                      disabled={actionLoading}
                      className="flex-1 py-2 px-3 text-xs font-semibold rounded-md bg-[#B83A3A] hover:bg-[#991B1B] text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      Confirm Same Plot (Duplicate Reject)
                    </button>
                    <button
                      onClick={() => setPendingAction("APPROVED_SEPARATE_PARCEL")}
                      disabled={actionLoading}
                      className="flex-1 py-2 px-3 text-xs font-semibold rounded-md bg-[#237A57] hover:bg-[#103126] text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      Approve as Separate Parcel (Activate)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Consequential Decisions */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#DCE5DE] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  pendingAction === "CONFIRMED_DUPLICATE"
                    ? "bg-[#B83A3A]/10 text-[#B83A3A]"
                    : "bg-[#237A57]/10 text-[#237A57]"
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#172820]">
                  Confirm Adjudication Decision
                </h3>
                <p className="text-xs text-[#65756C]">
                  This action is recorded in the immutable audit trail.
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#F5F7F4] rounded-md border border-[#DCE5DE] text-xs space-y-1">
              <div>
                Target Plot: <strong className="font-mono text-[#172820]">{selectedReview?.submitted_plot_id}</strong>
              </div>
              <div>
                Decision:{" "}
                <strong className={pendingAction === "CONFIRMED_DUPLICATE" ? "text-[#B83A3A]" : "text-[#237A57]"}>
                  {pendingAction === "CONFIRMED_DUPLICATE"
                    ? "CONFIRMED DUPLICATE (Mark as FLAGGED_DUPLICATE)"
                    : "APPROVED SEPARATE PARCEL (Activate Plot)"}
                </strong>
              </div>
              <div>
                Operator: <span className="font-mono">{operatorId}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 text-xs font-medium text-[#65756C] hover:text-[#172820] bg-white border border-[#DCE5DE] rounded-md transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmAdjudication}
                disabled={actionLoading}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-md transition shadow-xs cursor-pointer ${
                  pendingAction === "CONFIRMED_DUPLICATE"
                    ? "bg-[#B83A3A] hover:bg-[#991B1B]"
                    : "bg-[#237A57] hover:bg-[#103126]"
                }`}
              >
                {actionLoading ? "Executing..." : "Confirm & Commit Adjudication"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
