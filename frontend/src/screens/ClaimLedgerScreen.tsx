import React, { useEffect, useState, useCallback } from "react";
import { getAllowance, grantAllowance, submitClaim, releaseClaim, listClaims, getBlockchainStatus } from "../api/client";
import { StatusBadge } from "../components/Badges";
import type { AllowanceResponse, ClaimResponse } from "../types";

export const ClaimLedgerScreen: React.FC<{ activePlotId?: string }> = ({
  activePlotId = "PLOT-BASE-DEMO",
}) => {
  const [plotId, setPlotId] = useState<string>(activePlotId);
  const [seasonId, setSeasonId] = useState<number>(2026);
  const [allowance, setAllowance] = useState<AllowanceResponse | null>(null);

  // Blockchain Network Status
  const [chainStatus, setChainStatus] = useState<{
    connected: boolean;
    rpc_url: string;
    chain_id?: number;
    block_number?: number;
    contract_address?: string;
    contract_deployed?: boolean;
    mode: "LIVE_EVM" | "FALLBACK_SIMULATED";
    message: string;
  } | null>(null);

  // Grant Allowance State
  const [grantApprovedKg, setGrantApprovedKg] = useState<number>(3000);
  const [grantCropCode, setGrantCropCode] = useState<string>("SOY");

  // Claim State
  const [claimId, setClaimId] = useState<string>("CLAIM-BOL-DEMO-01");
  const [claimKg, setClaimKg] = useState<number>(1800);

  // Ledger History
  const [claimsHistory, setClaimsHistory] = useState<ClaimResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "warning"; msg: string } | null>(null);

  const fetchBlockchainStatus = useCallback(async () => {
    try {
      const status = await getBlockchainStatus();
      setChainStatus(status);
    } catch {
      // Ignored
    }
  }, []);

  const fetchAllowance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allowanceData, claimsData] = await Promise.all([
        getAllowance(plotId, seasonId).catch((err) => {
          if (!err.message?.includes("404")) {
            setError(err.message || "Failed to load allowance");
          }
          return null;
        }),
        listClaims(plotId, seasonId).catch(() => []),
      ]);
      setAllowance(allowanceData);
      if (claimsData && claimsData.length > 0) {
        setClaimsHistory(claimsData);
      }
    } finally {
      setLoading(false);
    }
  }, [plotId, seasonId]);

  useEffect(() => {
    fetchBlockchainStatus();
    fetchAllowance();
  }, [fetchBlockchainStatus, fetchAllowance]);


  const handleGrantAllowance = async () => {
    setLoading(true);
    setError(null);
    setNotification(null);
    try {
      const res = await grantAllowance({
        plot_id: plotId,
        season_id: seasonId,
        crop_code: grantCropCode,
        approved_allowance_kg: grantApprovedKg,
        evidence_document_hash: "0x" + "a".repeat(64),
      });
      setAllowance(res);
      setNotification({
        type: "success",
        msg: `Authorized allowance of ${grantApprovedKg.toLocaleString()} kg registered on-chain for ${plotId} (Season ${seasonId}).`,
      });
    } catch (err: any) {
      setError(err.message || "Grant allowance failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async (customKg?: number, customId?: string) => {
    const targetKg = customKg !== undefined ? customKg : claimKg;
    const targetId = customId || claimId;

    setLoading(true);
    setError(null);
    setNotification(null);
    try {
      const res = await submitClaim({
        claim_id: targetId,
        plot_id: plotId,
        season_id: seasonId,
        claimed_kg: targetKg,
        shipment_evidence_hash: "0x" + "b".repeat(64),
      });

      // Add to local ledger history
      setClaimsHistory((prev) => [res, ...prev.filter((c) => c.claim_id !== res.claim_id)]);

      if (res.status === "CONFIRMED") {
        setNotification({
          type: "success",
          msg: `Claim '${res.claim_id}' for ${targetKg.toLocaleString()} kg confirmed! Remaining balance: ${res.remaining_capacity_kg?.toLocaleString()} kg.`,
        });
      } else if (res.status === "REJECTED_OVER_ALLOCATION") {
        setNotification({
          type: "warning",
          msg: `Claim '${res.claim_id}' REJECTED: Requested ${targetKg.toLocaleString()} kg exceeds remaining balance (${res.remaining_capacity_kg?.toLocaleString()} kg). Balance unchanged!`,
        });
      }
      await fetchAllowance();
    } catch (err: any) {
      setError(err.message || "Claim submission failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseClaim = async (cid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await releaseClaim(cid, "Shipment transport cancelled by buyer at port");
      setClaimsHistory((prev) =>
        prev.map((c) => (c.claim_id === cid ? { ...c, message: "Released on-chain (capacity restored)" } : c))
      );
      setNotification({
        type: "success",
        msg: `Claim '${cid}' released on-chain! Capacity restored to ${res.remaining_capacity_kg?.toLocaleString()} kg.`,
      });
      await fetchAllowance();
    } catch (err: any) {
      setError(err.message || "Release failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview & Invariant banner */}
      <div className="bg-white p-6 rounded-lg border border-[#e2e8e0] shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#081c15] tracking-tight">
              On-Chain Claim Ledger &amp; Allowance Invariant
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Maintains an immutable shared balance. Prevents double-claiming across buyers atomically without corrupting the balance.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded font-mono font-semibold">
              INVARIANT: AcceptedClaims - Releases &le; ApprovedCapacity
            </span>
            {chainStatus && (
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded font-mono font-medium flex items-center gap-1.5 ${
                  chainStatus.connected
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
                title={chainStatus.message}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    chainStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                {chainStatus.mode === "LIVE_EVM"
                  ? `EVM RPC Connected (Chain ID: ${chainStatus.chain_id}, Block #${chainStatus.block_number})`
                  : `Deterministic Simulation Ledger (Standalone)`}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs">
            <strong>Error:</strong> {error}
          </div>
        )}
        {notification && (
          <div
            className={`mt-4 p-3 rounded text-xs border ${
              notification.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <strong>{notification.type === "success" ? "Transaction Confirmed: " : "Notice: "}</strong>
            {notification.msg}
          </div>
        )}

        {/* Plot Selector */}
        <div className="mt-6 flex flex-wrap items-center gap-4 p-4 bg-[#f8faf9] rounded border border-[#e2e8e0]">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Target Plot ID</label>
            <input
              type="text"
              value={plotId}
              onChange={(e) => setPlotId(e.target.value)}
              className="mt-1 text-xs font-mono px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#1b4332]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Season Year</label>
            <input
              type="number"
              value={seasonId}
              onChange={(e) => setSeasonId(Number(e.target.value))}
              className="mt-1 text-xs font-mono px-3 py-1.5 border border-slate-300 rounded w-28 focus:ring-1 focus:ring-[#1b4332]"
            />
          </div>
          <div className="pt-4">
            <button
              onClick={fetchAllowance}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded hover:bg-slate-50 text-slate-700 transition"
            >
              Refresh State
            </button>
          </div>
        </div>

        {/* Current Balance Display or Grant Allowance Form */}
        <div className="mt-6">
          {allowance ? (
            <div className="p-5 bg-white border border-[#1b4332] rounded-lg shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Active Allowance</span>
                  <h3 className="text-lg font-bold text-[#081c15] font-mono">{allowance.plot_id}</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Crop / Season:</span>
                  <div className="font-semibold text-slate-800">{allowance.crop_code} | {allowance.season_id}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-center">
                <div className="p-3 bg-slate-50 rounded">
                  <span className="text-xs text-slate-500">Approved Ceiling</span>
                  <div className="text-lg font-bold text-slate-800 mt-1">
                    {allowance.approved_allowance_kg.toLocaleString()} <span className="text-xs font-normal">kg</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded">
                  <span className="text-xs text-slate-500">Total Claimed</span>
                  <div className="text-lg font-bold text-amber-700 mt-1">
                    {allowance.claimed_kg.toLocaleString()} <span className="text-xs font-normal">kg</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded">
                  <span className="text-xs text-slate-500">Released Mass</span>
                  <div className="text-lg font-bold text-blue-700 mt-1">
                    {allowance.releasedKg.toLocaleString()} <span className="text-xs font-normal">kg</span>
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
                  <span className="text-xs text-emerald-800 font-semibold">Remaining Capacity</span>
                  <div className="text-lg font-bold text-[#1b4332] mt-1">
                    {allowance.remaining_allowance_kg.toLocaleString()} <span className="text-xs font-normal">kg</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-lg">
              <h4 className="text-sm font-bold text-amber-900">No Allowance Registered for this Plot &amp; Season</h4>
              <p className="text-xs text-amber-800 mt-1">
                Before submitting shipment claims, an authorized authority must register the approved mass ceiling for {plotId}.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  value={grantApprovedKg}
                  onChange={(e) => setGrantApprovedKg(Number(e.target.value))}
                  placeholder="Allowance (kg)"
                  className="text-xs font-mono px-3 py-1.5 border border-slate-300 rounded bg-white w-36"
                />
                <input
                  type="text"
                  value={grantCropCode}
                  onChange={(e) => setGrantCropCode(e.target.value)}
                  placeholder="Crop Code"
                  className="text-xs font-mono px-3 py-1.5 border border-slate-300 rounded bg-white w-24"
                />
                <button
                  onClick={handleGrantAllowance}
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-semibold rounded bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition disabled:opacity-50"
                >
                  {loading ? "Registering..." : `Grant ${grantApprovedKg.toLocaleString()} kg Allowance`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Shipment Claim Interactive Controls */}
        {allowance && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Submit Shipment Claim Transaction
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Demonstrates atomic double-allocation rejection. Claim 1 (1,800 kg) succeeds; subsequent Claim 2 (2,000 kg) is rejected without mutating balance.
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Claim ID / BOL</label>
                <input
                  type="text"
                  value={claimId}
                  onChange={(e) => setClaimId(e.target.value)}
                  className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Claim Mass (kg)</label>
                <input
                  type="number"
                  value={claimKg}
                  onChange={(e) => setClaimKg(Number(e.target.value))}
                  className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => handleSubmitClaim()}
                  disabled={loading}
                  className="w-full py-2 text-xs font-semibold rounded bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition disabled:opacity-50"
                >
                  Submit Custom Claim
                </button>
              </div>
            </div>

            {/* Quick Scenario Preset Buttons */}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => handleSubmitClaim(1800, `CLAIM-VALID-1800-${Date.now().toString().slice(-4)}`)}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition"
              >
                1. Submit Valid Claim (1,800 kg)
              </button>
              <button
                onClick={() => handleSubmitClaim(2000, `CLAIM-OVER-ALLOC-2000-${Date.now().toString().slice(-4)}`)}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition"
              >
                2. Attempt Over-Allocation (2,000 kg)
              </button>
            </div>
          </div>
        )}

        {/* Recent Transaction Log */}
        {claimsHistory.length > 0 && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              On-Chain Claim Activity Log
            </h3>
            <div className="mt-3 border border-slate-200 rounded overflow-hidden divide-y divide-slate-100 text-xs">
              {claimsHistory.map((c) => (
                <div key={c.claim_id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <div className="font-semibold text-slate-800 font-mono flex items-center gap-2">
                      <span>{c.claim_id}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Mass: <strong>{c.claimed_kg.toLocaleString()} kg</strong> | Tx: <span className="font-mono">{c.tx_hash?.slice(0, 18)}...</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{c.message}</p>
                  </div>
                  <div>
                    {c.status === "CONFIRMED" && (
                      <button
                        onClick={() => handleReleaseClaim(c.claim_id)}
                        disabled={loading}
                        className="px-2.5 py-1 text-xs border border-red-300 rounded text-red-700 hover:bg-red-50 font-medium transition"
                      >
                        Release Claim
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
