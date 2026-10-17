import React, { useState } from "react";
import { extractDocument, confirmDocument } from "../api/client";
import { DEMO_SAMPLE_DOCUMENT_TEXT } from "../types/demoFixtures";
import type { DocumentExtractionResponse, ExtractedFields } from "../types";

export const ShipmentDocumentScreen: React.FC<{ onConfirmed?: () => void }> = ({ onConfirmed }) => {
  const [docText, setDocText] = useState<string>(DEMO_SAMPLE_DOCUMENT_TEXT);
  const [fileName, setFileName] = useState<string>("bill_of_lading_9941.txt");
  const [extraction, setExtraction] = useState<DocumentExtractionResponse | null>(null);
  const [editableFields, setEditableFields] = useState<ExtractedFields | null>(null);
  const [operatorId, setOperatorId] = useState<string>("OP-CUSTOMS-OFFICER-12");

  const [loading, setLoading] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedSuccess, setConfirmedSuccess] = useState<boolean>(false);

  const handleExtract = async () => {
    setLoading(true);
    setError(null);
    setConfirmedSuccess(false);
    try {
      const res = await extractDocument(fileName, docText);
      setExtraction(res);
      setEditableFields(res.extracted_fields);
    } catch (err: any) {
      setError(err.message || "Document extraction failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!extraction || !editableFields) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmDocument(extraction.document_id, operatorId, editableFields);
      setConfirmedSuccess(true);
      if (onConfirmed) {
        onConfirmed();
      }
    } catch (err: any) {
      setError(err.message || "Confirmation failed");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-[#e2e8e0] shadow-sm">
        <h2 className="text-xl font-bold text-[#081c15] tracking-tight">
          Shipment Document Extraction &amp; Human Confirmation
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Automated structured field extraction from bills of lading. Enforces human confirmation before an on-chain shipment claim can be registered.
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs">
            <strong>Error:</strong> {error}
          </div>
        )}
        {confirmedSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs">
            <strong>Document Confirmed!</strong> Extraction status updated to CONFIRMED. Ready for on-chain claim submission.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Document Ingestion Text */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Document File Name</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#1b4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Raw Commercial Invoice / Bill of Lading Text
              </label>
              <textarea
                rows={12}
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                className="mt-1 w-full text-xs font-mono p-3 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#1b4332]"
              />
            </div>
            <button
              onClick={handleExtract}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition disabled:opacity-50"
            >
              {loading ? "Extracting Fields..." : "Extract Structured Fields"}
            </button>
          </div>

          {/* Extracted Fields & Human Confirmation Form */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Human-in-the-Loop Field Verification
            </h3>

            {editableFields ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3 text-xs">
                {/* Provenance and Confidence Header */}
                {extraction && (
                  <div className="flex flex-wrap items-center justify-between p-2.5 bg-white border border-slate-200 rounded">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Engine Source:</span>
                      <div className="font-mono font-semibold text-slate-800 text-[11px]">{extraction.extraction_source}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Confidence:</span>
                      <div className="font-bold text-[#1b4332] text-xs">{(extraction.confidence_score * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                )}

                {/* Warnings / Missing Fields Banner */}
                {extraction?.warnings && extraction.warnings.length > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] space-y-1">
                    <strong className="block text-[10px] uppercase tracking-wider">Field Notice:</strong>
                    {extraction.warnings.map((w, idx) => (
                      <div key={idx}>&bull; {w}</div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-slate-500 font-medium">Shipment Identifier (BOL / Invoice)</label>
                  <input
                    type="text"
                    value={editableFields.shipment_identifier || editableFields.bill_of_lading_number || ""}
                    onChange={(e) =>
                      setEditableFields({
                        ...editableFields,
                        shipment_identifier: e.target.value,
                        bill_of_lading_number: e.target.value
                      })
                    }
                    className="mt-1 w-full text-xs font-mono px-2 py-1.5 border border-slate-300 rounded bg-white"
                  />
                  {editableFields.field_evidence?.["shipment_identifier"]?.source_snippet && (
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      Matched: "{editableFields.field_evidence["shipment_identifier"].source_snippet}"
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-medium">Declared Weight (kg)</label>
                    <input
                      type="number"
                      value={editableFields.declared_weight_kg}
                      onChange={(e) =>
                        setEditableFields({ ...editableFields, declared_weight_kg: Number(e.target.value) })
                      }
                      className="mt-1 w-full text-xs font-mono font-bold text-[#1b4332] px-2 py-1.5 border border-slate-300 rounded bg-white"
                    />
                    {editableFields.field_evidence?.["shipment_quantity"]?.source_snippet && (
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        Matched: "{editableFields.field_evidence["shipment_quantity"].source_snippet}"
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium">Referenced Plot Cadastre</label>
                    <input
                      type="text"
                      value={editableFields.referenced_plot_id || ""}
                      placeholder="e.g. PLOT-BASE-DEMO"
                      onChange={(e) =>
                        setEditableFields({ ...editableFields, referenced_plot_id: e.target.value })
                      }
                      className="mt-1 w-full text-xs font-mono px-2 py-1.5 border border-slate-300 rounded bg-white"
                    />
                    {editableFields.field_evidence?.["referenced_plot_id"]?.source_snippet && (
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        Matched: "{editableFields.field_evidence["referenced_plot_id"].source_snippet}"
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-medium">Commodity Code</label>
                    <input
                      type="text"
                      value={editableFields.commodity_code}
                      onChange={(e) =>
                        setEditableFields({ ...editableFields, commodity_code: e.target.value })
                      }
                      className="mt-1 w-full text-xs font-mono px-2 py-1.5 border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium">Shipment Date</label>
                    <input
                      type="text"
                      value={editableFields.shipment_date}
                      onChange={(e) =>
                        setEditableFields({ ...editableFields, shipment_date: e.target.value })
                      }
                      className="mt-1 w-full text-xs font-mono px-2 py-1.5 border border-slate-300 rounded bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium">Verifying Officer ID</label>
                  <input
                    type="text"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="mt-1 w-full text-xs font-mono px-2 py-1.5 border border-slate-300 rounded bg-white"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Human confirmation is required. AI draft cannot automatically register on-chain.
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleConfirm}
                    disabled={confirming || confirmedSuccess}
                    className="w-full py-2 text-xs font-semibold rounded bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition disabled:opacity-50"
                  >
                    {confirming ? "Confirming..." : confirmedSuccess ? "Confirmed" : "Confirm Fields & Authorize Claim"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded text-xs text-slate-500">
                Click "Extract Structured Fields" to parse the raw invoice and initiate operator verification.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
