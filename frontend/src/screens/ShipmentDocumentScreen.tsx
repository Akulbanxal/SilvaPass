import React, { useState } from "react";
import { extractDocument, confirmDocument } from "../api/client";
import { DEMO_SAMPLE_DOCUMENT_TEXT } from "../types/demoFixtures";
import type { DocumentExtractionResponse, ExtractedFields } from "../types";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  FileCheck,
} from "lucide-react";

interface ShipmentDocumentScreenProps {
  onConfirmed?: () => void;
  onNavigateToLedger?: () => void;
}

export const ShipmentDocumentScreen: React.FC<ShipmentDocumentScreenProps> = ({
  onConfirmed,
  onNavigateToLedger,
}) => {
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE5DE]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#172820]">
              Document Extraction
            </h2>
            <span className="font-mono text-xs bg-slate-100 text-[#65756C] px-2.5 py-0.5 rounded-full border border-[#DCE5DE]">
              Rule-Based NLP &bull; Human Confirmation Gate
            </span>
          </div>
          <p className="text-sm text-[#65756C] mt-1">
            Convert shipment documents into structured, reviewable claim records with mandatory human operator sign-off.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#B83A3A]/10 border border-[#B83A3A]/25 rounded-md text-xs text-[#B83A3A] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {confirmedSuccess && (
        <div className="p-4 bg-[#16805D]/10 border border-[#16805D]/30 rounded-lg text-xs text-[#16805D] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <strong className="block text-sm">Document Confirmed by Operator {operatorId}</strong>
              <p className="text-[11px] text-[#16805D]/90 mt-0.5">
                Status updated to CONFIRMED. The verified shipment quantity ({editableFields?.declared_weight_kg.toLocaleString()} kg) is ready for on-chain claim submission.
              </p>
            </div>
          </div>
          {onNavigateToLedger && (
            <button
              onClick={onNavigateToLedger}
              className="px-3.5 py-1.5 rounded-md bg-[#16805D] text-white hover:bg-[#103126] transition font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>Submit to Claim Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Two-Column Document Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Raw Document Input (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-lg border border-[#DCE5DE] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#DCE5DE] pb-3">
            <h3 className="text-base font-bold text-[#172820] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#237A57]" />
              <span>Source Document Ingestion</span>
            </h3>
            <span className="text-[11px] font-mono text-[#65756C]">Plaintext / PDF OCR</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#172820]">
              Document Filename
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#172820] flex items-center justify-between">
              <span>Raw Commercial Invoice / Bill of Lading Text</span>
              <span className="text-[10px] font-mono text-[#65756C]">WGS84 Reference Match</span>
            </label>
            <textarea
              rows={13}
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              className="mt-1 w-full text-xs font-mono p-3 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden leading-relaxed"
            />
          </div>

          <button
            onClick={handleExtract}
            disabled={loading}
            className="w-full py-2 px-3 text-xs font-semibold rounded-md bg-[#237A57] hover:bg-[#103126] text-white transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>{loading ? "Extracting Structured Fields..." : "Extract Structured Fields"}</span>
          </button>

          {/* Engine Provenance Note */}
          <div className="p-3 bg-[#F5F7F4] rounded-md border border-[#DCE5DE] text-[11px] text-[#65756C] space-y-1">
            <div className="flex items-center justify-between font-mono">
              <span>Parser: Regex &amp; Semantic Rule Extractor</span>
              <span>Off-Chain</span>
            </div>
            <p>
              Private commercial invoices and seller details remain off-chain to maintain trade privacy. Only verified hashes and quantities anchor to the public ledger.
            </p>
          </div>
        </div>

        {/* Right Column: Structured Field Review & Operator Sign-off (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-lg border border-[#DCE5DE] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#DCE5DE] pb-3">
            <div>
              <h3 className="text-base font-bold text-[#172820] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#237A57]" />
                <span>Structured Field Review &amp; Confirmation</span>
              </h3>
              <p className="text-xs text-[#65756C]">
                Human verification of automated extraction before ledger anchoring.
              </p>
            </div>
            {extraction && (
              <span className="text-xs font-mono font-semibold text-[#16805D] bg-[#16805D]/10 px-2.5 py-1 rounded-full border border-[#16805D]/25">
                {(extraction.confidence_score * 100).toFixed(0)}% Confidence
              </span>
            )}
          </div>

          {editableFields ? (
            <div className="space-y-4">
              {/* Warnings / Field Notices */}
              {extraction?.warnings && extraction.warnings.length > 0 && (
                <div className="p-3 bg-[#B7791F]/10 border border-[#B7791F]/30 rounded-md text-xs text-[#B7791F] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Extraction Notices:</span>
                  </div>
                  {extraction.warnings.map((w, idx) => (
                    <div key={idx} className="text-[11px]">&bull; {w}</div>
                  ))}
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#172820]">
                    Shipment Identifier (BOL / Invoice)
                  </label>
                  <input
                    type="text"
                    value={editableFields.shipment_identifier || editableFields.bill_of_lading_number || ""}
                    onChange={(e) =>
                      setEditableFields({
                        ...editableFields,
                        shipment_identifier: e.target.value,
                        bill_of_lading_number: e.target.value,
                      })
                    }
                    className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
                  />
                  {editableFields.field_evidence?.["shipment_identifier"]?.source_snippet && (
                    <span className="text-[10px] text-[#65756C] font-mono block mt-0.5">
                      Matched: "{editableFields.field_evidence["shipment_identifier"].source_snippet}"
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#172820]">
                      Declared Mass (kg)
                    </label>
                    <input
                      type="number"
                      value={editableFields.declared_weight_kg}
                      onChange={(e) =>
                        setEditableFields({
                          ...editableFields,
                          declared_weight_kg: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full text-xs font-mono font-bold text-[#237A57] px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden tabular-nums"
                    />
                    {editableFields.field_evidence?.["shipment_quantity"]?.source_snippet && (
                      <span className="text-[10px] text-[#65756C] font-mono block mt-0.5">
                        Matched: "{editableFields.field_evidence["shipment_quantity"].source_snippet}"
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#172820]">
                      Referenced Plot Identifier
                    </label>
                    <input
                      type="text"
                      value={editableFields.referenced_plot_id || ""}
                      onChange={(e) =>
                        setEditableFields({
                          ...editableFields,
                          referenced_plot_id: e.target.value,
                        })
                      }
                      className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
                    />
                    {editableFields.field_evidence?.["referenced_plot_id"]?.source_snippet && (
                      <span className="text-[10px] text-[#65756C] font-mono block mt-0.5">
                        Matched: "{editableFields.field_evidence["referenced_plot_id"].source_snippet}"
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#172820]">
                      Commodity Code
                    </label>
                    <input
                      type="text"
                      value={editableFields.commodity_code}
                      onChange={(e) =>
                        setEditableFields({ ...editableFields, commodity_code: e.target.value })
                      }
                      className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#172820]">
                      Shipment Date
                    </label>
                    <input
                      type="text"
                      value={editableFields.shipment_date}
                      onChange={(e) =>
                        setEditableFields({ ...editableFields, shipment_date: e.target.value })
                      }
                      className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#DCE5DE]">
                  <label className="block text-[11px] font-semibold text-[#172820]">
                    Verifying Customs Officer Identifier
                  </label>
                  <input
                    type="text"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
                  />
                  <span className="text-[10px] text-[#65756C] block mt-0.5">
                    Attestation is permanently bound to the shipment transaction proof bundle.
                  </span>
                </div>
              </div>

              <button
                onClick={handleConfirm}
                disabled={confirming || confirmedSuccess}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-md bg-[#237A57] hover:bg-[#103126] text-white transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {confirming
                    ? "Recording Confirmation..."
                    : confirmedSuccess
                    ? "Confirmed by Operator"
                    : "Confirm Fields & Authorize Claim Record"}
                </span>
              </button>
            </div>
          ) : (
            /* Meaningful Empty State */
            <div className="p-12 text-center bg-[#F5F7F4] rounded-lg border border-dashed border-[#DCE5DE] space-y-3">
              <FileText className="w-10 h-10 text-[#65756C]/40 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-[#172820]">No Document Extracted Yet</h4>
                <p className="text-xs text-[#65756C] mt-1 max-w-sm mx-auto">
                  Click "Extract Structured Fields" on the left to parse the bill of lading and initiate human operator confirmation.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
