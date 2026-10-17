import React, { useEffect, useState, useCallback } from "react";
import { listPendingReviews, adjudicateReview, getPlot } from "../api/client";
import { MapPreview } from "../components/MapPreview";
import { StatusBadge } from "../components/Badges";
import type { SpatialReviewItem, PlotRecord } from "../types";

export const DuplicateReviewScreen: React.FC<{ onReviewResolved?: () => void }> = ({ onReviewResolved }) => {
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

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPendingReviews();
      setReviews(data);
      if (data.length > 0) {
        setSelectedReview((prev) => prev || data[0]);
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
          getPlot(selectedReview.submitted_plot_id),
          getPlot(selectedReview.conflicting_plot_id),
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


  const handleAdjudicate = async (action: "CONFIRMED_DUPLICATE" | "APPROVED_SEPARATE_PARCEL") => {
    if (!selectedReview) return;
    if (justification.trim().length < 15) {
      setError("Please provide a comprehensive justification of at least 15 characters.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await adjudicateReview(
        selectedReview.review_id,
        action,
        operatorId,
        justification
      );
      setSuccessMsg(
        `Review adjudicated successfully! Plot '${selectedReview.submitted_plot_id}' updated to '${res.new_plot_status}'.`
      );
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
      <div className="bg-white p-6 rounded-lg border border-[#e2e8e0] shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#081c15] tracking-tight">
              Spatial Match Review Queue
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Human-in-the-loop adjudication for ambiguous boundary conflicts. Prevents coordinate laundering without falsely merging neighboring farms.
            </p>
          </div>
          <button
            onClick={fetchReviews}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 font-medium text-slate-700 transition"
          >
            Refresh Queue
          </button>
        </div>

        {loading && <p className="text-xs text-slate-500 py-4">Loading pending reviews...</p>}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs">
            <strong>Error:</strong> {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs">
            <strong>Success:</strong> {successMsg}
          </div>
        )}

        {!loading && reviews.length === 0 && (
          <div className="mt-6 p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded">
            <p className="text-sm text-slate-600 font-medium">No pending review cases.</p>
            <p className="text-xs text-slate-400 mt-1">
              All registered plots are currently either distinct or resolved. To generate an ambiguous conflict, register an overlapping polygon from the Plot Ingestion tab.
            </p>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Reviews List */}
            <div className="lg:col-span-1 border border-slate-200 rounded divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {reviews.map((r) => (
                <div
                  key={r.review_id}
                  onClick={() => setSelectedReview(r)}
                  className={`p-3 text-xs cursor-pointer transition ${
                    selectedReview?.review_id === r.review_id
                      ? "bg-emerald-50/60 border-l-4 border-[#1b4332]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-center font-semibold text-slate-800">
                    <span className="truncate">{r.submitted_plot_id}</span>
                    <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                      IoU: {(r.iou * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1 text-[11px]">
                    Conflict: {r.conflicting_plot_id}
                  </div>
                  <div className="text-slate-400 text-[10px] mt-0.5">
                    Drift: {r.centroid_distance_m}m | Created: {r.created_at.slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>

            {/* Side-by-side comparison & adjudication controls */}
            {selectedReview && (
              <div className="lg:col-span-2 space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Conflict Case #{selectedReview.review_id.slice(-8)}</span>
                    <StatusBadge status={selectedReview.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-slate-500">Submitted Plot:</span>
                      <p className="font-mono font-semibold text-[#1b4332]">
                        {selectedReview.submitted_plot_id}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Area: {submittedPlot?.geodesic_area_ha || "..."} ha
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Existing Conflicting Plot:</span>
                      <p className="font-mono font-semibold text-amber-700">
                        {selectedReview.conflicting_plot_id}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Area: {conflictingPlot?.geodesic_area_ha || "..."} ha
                      </p>
                    </div>
                  </div>
                </div>

                {/* Overlaid Map Visualizer */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Overlaid Geographic Comparison</span>
                    <span className="text-slate-500 text-[11px]">
                      <span className="inline-block w-2.5 h-2.5 bg-[#2d6a4f] rounded-full mr-1 align-middle" />
                      Submitted (Green) &nbsp;&nbsp;
                      <span className="inline-block w-2.5 h-2.5 bg-[#f59e0b] rounded-full mr-1 align-middle" />
                      Conflicting Existing (Orange)
                    </span>
                  </div>
                  <MapPreview
                    geojson={parseGeojson(submittedPlot?.raw_geojson)}
                    comparisonGeojson={parseGeojson(conflictingPlot?.raw_geojson)}
                    height="260px"
                  />
                </div>

                {/* Adjudication Form */}
                <div className="p-4 bg-white border border-slate-200 rounded space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Operator Adjudication Decision
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Operator ID</label>
                      <input
                        type="text"
                        value={operatorId}
                        onChange={(e) => setOperatorId(e.target.value)}
                        className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#1b4332]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Spatial Decision</label>
                      <div className="text-[11px] text-slate-500 mt-2">
                        Must choose whether this is a fraudulent duplicate or a bona fide separate plot.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Adjudication Justification &amp; Audit Rationale (min 15 chars)
                    </label>
                    <textarea
                      rows={2}
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      className="mt-1 w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#1b4332]"
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => handleAdjudicate("CONFIRMED_DUPLICATE")}
                      disabled={actionLoading}
                      className="flex-1 py-2 text-xs font-semibold rounded bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
                    >
                      {actionLoading ? "Adjudicating..." : "Confirm as Duplicate (Reject Plot)"}
                    </button>
                    <button
                      onClick={() => handleAdjudicate("APPROVED_SEPARATE_PARCEL")}
                      disabled={actionLoading}
                      className="flex-1 py-2 text-xs font-semibold rounded bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition disabled:opacity-50"
                    >
                      {actionLoading ? "Adjudicating..." : "Approve as Separate Parcel (Activate)"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
