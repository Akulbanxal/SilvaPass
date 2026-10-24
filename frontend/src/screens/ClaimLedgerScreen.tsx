import React, { useEffect, useState, useCallback } from "react";
import {
  getAllowance,
  grantAllowance,
  submitClaim,
  releaseClaim,
  listClaims,
  getBlockchainStatus,
} from "../api/client";
import { StatusBadge } from "../components/Badges";
import type { AllowanceResponse, ClaimResponse } from "../types";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface ClaimLedgerScreenProps {
  activePlotId?: string;
}

export const ClaimLedgerScreen: React.FC<ClaimLedgerScreenProps> = ({
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
  const [notification, setNotification] = useState<{
    type: "success" | "warning";
    title: string;
    msg: string;
    details?: { attemptedKg: number; availableKg: number; excessKg: number };
  } | null>(null);

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
        title: "Allowance Approved & Anchored",
        msg: `Authorized ceiling of ${grantApprovedKg.toLocaleString()} kg registered on-chain for ${plotId} (Season ${seasonId}).`,
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

      // Update local history
      setClaimsHistory((prev) => [res, ...prev.filter((c) => c.claim_id !== res.claim_id)]);

      if (res.status === "CONFIRMED") {
        setNotification({
          type: "success",
          title: "Claim Verified & Anchored On-Chain",
          msg: `Claim '${res.claim_id}' for ${targetKg.toLocaleString()} kg confirmed! Remaining balance: ${res.remaining_capacity_kg?.toLocaleString()} kg.`,
        });
      } else if (res.status === "REJECTED_OVER_ALLOCATION") {
        const available = res.remaining_capacity_kg ?? 0;
        const excess = Math.max(0, targetKg - available);
        setNotification({
          type: "warning",
          title: "Atomic Over-Allocation Rejected (Invariant Enforced)",
          msg: `Attempted claim of ${targetKg.toLocaleString()} kg exceeds remaining recorded capacity (${available.toLocaleString()} kg) by ${excess.toLocaleString()} kg. Smart contract execution halted. Balance preserved!`,
          details: { attemptedKg: targetKg, availableKg: available, excessKg: excess },
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
        prev.map((c) =>
          c.claim_id === cid
            ? { ...c, status: "RELEASED", message: "Released on-chain (capacity restored)" }
            : c
        )
      );
      setNotification({
        type: "success",
        title: "Claim Capacity Released",
        msg: `Claim '${cid}' released on-chain! Capacity restored to ${res.remaining_capacity_kg?.toLocaleString()} kg.`,
      });
      await fetchAllowance();
    } catch (err: any) {
      setError(err.message || "Release failed");
    } finally {
      setLoading(false);
    }
  };

  // Capacity calculations
  const totalCeiling = allowance?.approved_allowance_kg || 0;
  const netClaimed = allowance?.claimed_kg || 0;
  const percentUsed = totalCeiling > 0 ? Math.min(100, (netClaimed / totalCeiling) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE5DE]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#172820]">
              Claim Ledger
            </h2>
            <span className="font-mono text-xs bg-[#103126] text-[#B6E986] px-2.5 py-0.5 rounded-full border border-[#237A57]">
              Shared Invariant Protocol
            </span>
          </div>
          <p className="text-sm text-[#65756C] mt-1">
            Inspect approved allowances, submitted claims, releases, and the shared quantity invariant.
          </p>
        </div>

        {/* Network Indicator */}
        <div className="flex items-center gap-2">
          {chainStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-[#DCE5DE] text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  chainStatus.connected ? "bg-[#16805D] animate-pulse" : "bg-[#B7791F]"
                }`}
              />
              <span className="font-semibold text-[#172820]">
                {chainStatus.mode === "LIVE_EVM" ? "Hardhat EVM" : "Simulated Ledger"}
              </span>
              <span className="text-[#65756C]">Chain {chainStatus.chain_id || 31337}</span>
            </div>
          )}
        </div>
      </div>

      {/* Target Selector Toolbar */}
      <div className="p-3.5 bg-white rounded-lg border border-[#DCE5DE] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#65756C]">Target Plot ID</label>
            <input
              type="text"
              value={plotId}
              onChange={(e) => setPlotId(e.target.value)}
              className="mt-0.5 text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#65756C]">Season Year</label>
            <input
              type="number"
              value={seasonId}
              onChange={(e) => setSeasonId(Number(e.target.value))}
              className="mt-0.5 text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden w-24"
            />
          </div>
          <div className="pt-4">
            <button
              onClick={fetchAllowance}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#172820] bg-[#F5F7F4] hover:bg-[#DCE5DE] rounded-md transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Query Ledger</span>
            </button>
          </div>
        </div>

        <div className="text-right text-[11px] font-mono text-[#65756C]">
          <span>Invariant: NetClaims &le; ApprovedCapacity</span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#B83A3A]/10 border border-[#B83A3A]/25 rounded-md text-xs text-[#B83A3A] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Notification Banner (with Detailed Over-Allocation Info) */}
      {notification && (
        <div
          className={`p-4 rounded-lg border text-xs space-y-1.5 ${
            notification.type === "success"
              ? "bg-[#16805D]/10 border-[#16805D]/30 text-[#16805D]"
              : "bg-[#B7791F]/10 border-[#B7791F]/30 text-[#B7791F]"
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>{notification.title}</span>
          </div>
          <p className="leading-relaxed">{notification.msg}</p>
          {notification.details && (
            <div className="mt-2 p-2.5 bg-white/80 rounded border border-current/20 font-mono text-[11px] grid grid-cols-3 gap-2 text-center text-[#172820]">
              <div>
                <span className="text-[#65756C] block">Attempted Amount</span>
                <span className="font-bold text-[#B83A3A] tabular-nums">
                  {notification.details.attemptedKg.toLocaleString()} kg
                </span>
              </div>
              <div>
                <span className="text-[#65756C] block">Available Ceiling</span>
                <span className="font-bold text-[#237A57] tabular-nums">
                  {notification.details.availableKg.toLocaleString()} kg
                </span>
              </div>
              <div>
                <span className="text-[#65756C] block">Excess Rejected</span>
                <span className="font-bold text-[#B7791F] tabular-nums">
                  +{notification.details.excessKg.toLocaleString()} kg
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Allowance & Invariant Summary Panel */}
      {allowance ? (
        <div className="bg-white p-6 rounded-lg border border-[#DCE5DE] shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE5DE] pb-4">
            <div>
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#65756C]">
                Active Production Allowance
              </span>
              <h3 className="text-xl font-bold text-[#172820] font-mono mt-0.5">
                {allowance.plot_id}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#65756C]">Crop &bull; Season:</span>
              <div className="font-semibold text-sm text-[#172820] font-mono">
                {allowance.crop_code} &bull; Season {allowance.season_id}
              </div>
            </div>
          </div>

          {/* Metric Cards Strip with Tabular Numerals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#F5F7F4] rounded-lg border border-[#DCE5DE]">
              <span className="text-xs text-[#65756C] font-medium">Approved Allowance</span>
              <div className="text-xl font-bold text-[#172820] font-mono tabular-nums mt-1">
                {allowance.approved_allowance_kg.toLocaleString()} <span className="text-xs font-normal text-[#65756C]">kg</span>
              </div>
              <div className="text-[10px] text-[#65756C] mt-1">Authorized harvest ceiling</div>
            </div>

            <div className="p-4 bg-[#F5F7F4] rounded-lg border border-[#DCE5DE]">
              <span className="text-xs text-[#65756C] font-medium">Total Claimed</span>
              <div className="text-xl font-bold text-[#B7791F] font-mono tabular-nums mt-1">
                {allowance.claimed_kg.toLocaleString()} <span className="text-xs font-normal text-[#65756C]">kg</span>
              </div>
              <div className="text-[10px] text-[#65756C] mt-1">Recorded shipment mass</div>
            </div>

            <div className="p-4 bg-[#F5F7F4] rounded-lg border border-[#DCE5DE]">
              <span className="text-xs text-[#65756C] font-medium">Released Quantity</span>
              <div className="text-xl font-bold text-[#237A57] font-mono tabular-nums mt-1">
                {allowance.releasedKg.toLocaleString()} <span className="text-xs font-normal text-[#65756C]">kg</span>
              </div>
              <div className="text-[10px] text-[#65756C] mt-1">Restored to capacity</div>
            </div>

            <div className="p-4 bg-[#16805D]/10 rounded-lg border border-[#16805D]/30">
              <span className="text-xs font-semibold text-[#16805D]">Remaining Capacity</span>
              <div className="text-xl font-bold text-[#16805D] font-mono tabular-nums mt-1">
                {allowance.remaining_allowance_kg.toLocaleString()} <span className="text-xs font-normal">kg</span>
              </div>
              <div className="text-[10px] text-[#16805D] mt-1">Available for claims</div>
            </div>
          </div>

          {/* Visual Invariant Progress Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#65756C]">Capacity Utilization: {percentUsed.toFixed(1)}%</span>
              <span className="font-semibold text-[#172820]">
                {netClaimed.toLocaleString()} / {totalCeiling.toLocaleString()} kg
              </span>
            </div>
            <div className="w-full h-3 bg-[#F5F7F4] rounded-full overflow-hidden border border-[#DCE5DE]">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  percentUsed >= 100
                    ? "bg-[#B83A3A]"
                    : percentUsed > 75
                    ? "bg-[#B7791F]"
                    : "bg-[#237A57]"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          {/* Contract Hash Provenance */}
          <div className="pt-2 flex flex-wrap items-center justify-between text-[11px] font-mono text-[#65756C] border-t border-[#DCE5DE]">
            <span className="truncate max-w-sm">Allowance Tx: {allowance.tx_hash}</span>
            <span>Anchor: SilvaPassRegistry.sol</span>
          </div>
        </div>
      ) : (
        /* Grant Allowance State */
        <div className="bg-white p-6 rounded-lg border border-dashed border-[#B7791F]/50 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#B7791F]" />
            <h4 className="text-base font-bold text-[#172820]">
              No Allowance Registered for {plotId} (Season {seasonId})
            </h4>
          </div>
          <p className="text-xs text-[#65756C] max-w-xl">
            Before shipment claims can be submitted, an authorized certifying authority must grant and anchor an initial production allowance ceiling on-chain.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#65756C]">Ceiling Mass (kg)</label>
              <input
                type="number"
                value={grantApprovedKg}
                onChange={(e) => setGrantApprovedKg(Number(e.target.value))}
                className="mt-0.5 text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white w-36"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#65756C]">Crop Code</label>
              <input
                type="text"
                value={grantCropCode}
                onChange={(e) => setGrantCropCode(e.target.value)}
                className="mt-0.5 text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white w-24"
              />
            </div>
            <div className="pt-4">
              <button
                onClick={handleGrantAllowance}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[#237A57] hover:bg-[#103126] text-white transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {loading ? "Registering..." : `Grant ${grantApprovedKg.toLocaleString()} kg Ceiling`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Submission & Double-Claim Invariant Simulation */}
      {allowance && (
        <div className="bg-white p-6 rounded-lg border border-[#DCE5DE] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#DCE5DE] pb-3">
            <div>
              <h3 className="text-base font-bold text-[#172820]">Submit Shipment Claim</h3>
              <p className="text-xs text-[#65756C]">
                Execute on-chain claim against recorded plot allowance. Atomic invariant rejects excess allocations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#172820]">
                Claim Identifier / BOL
              </label>
              <input
                type="text"
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
                className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#172820]">
                Claim Mass (kg)
              </label>
              <input
                type="number"
                value={claimKg}
                onChange={(e) => setClaimKg(Number(e.target.value))}
                className="mt-1 w-full text-xs font-mono px-3 py-1.5 border border-[#DCE5DE] rounded-md bg-[#F5F7F4] focus:bg-white focus:border-[#237A57] outline-hidden tabular-nums"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => handleSubmitClaim()}
                disabled={loading}
                className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#237A57] hover:bg-[#103126] rounded-md transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Claim"}
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-[#65756C]">Quick Scenarios:</span>
            <button
              onClick={() =>
                handleSubmitClaim(1800, `CLAIM-VALID-1800-${Date.now().toString().slice(-4)}`)
              }
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#16805D]/10 hover:bg-[#16805D]/20 text-[#16805D] border border-[#16805D]/30 transition cursor-pointer"
            >
              1. Submit Valid Claim (1,800 kg)
            </button>
            <button
              onClick={() =>
                handleSubmitClaim(2000, `CLAIM-OVER-ALLOC-2000-${Date.now().toString().slice(-4)}`)
              }
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#B7791F]/10 hover:bg-[#B7791F]/20 text-[#B7791F] border border-[#B7791F]/30 transition cursor-pointer"
            >
              2. Test Over-Allocation Rejection (2,000 kg)
            </button>
          </div>
        </div>
      )}

      {/* Claim Activity Ledger Table */}
      {claimsHistory.length > 0 && (
        <div className="bg-white p-5 rounded-lg border border-[#DCE5DE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#172820]">On-Chain Claim History</h3>
              <p className="text-xs text-[#65756C]">
                Immutable transactions anchoring shipment quantities against plot allowances.
              </p>
            </div>
            <span className="text-xs font-mono text-[#65756C]">
              {claimsHistory.length} recorded events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DCE5DE] text-[#65756C] font-mono uppercase text-[10px]">
                  <th className="py-2.5 px-3">Claim Identifier</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Transaction Receipt</th>
                  <th className="py-2.5 px-3">Outcome Message</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5DE]/60">
                {claimsHistory.map((c) => (
                  <tr key={c.claim_id} className="hover:bg-[#F5F7F4] transition">
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#172820]">
                      {c.claim_id}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold tabular-nums text-[#172820]">
                      {c.claimed_kg.toLocaleString()} kg
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#65756C] truncate max-w-[140px]">
                      {c.tx_hash || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[#65756C] max-w-xs truncate">
                      {c.message}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {c.status === "CONFIRMED" && (
                        <button
                          onClick={() => handleReleaseClaim(c.claim_id)}
                          disabled={loading}
                          className="px-2.5 py-1 text-[11px] font-semibold border border-[#B83A3A]/40 rounded text-[#B83A3A] hover:bg-[#B83A3A]/10 transition cursor-pointer"
                        >
                          Release Capacity
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
