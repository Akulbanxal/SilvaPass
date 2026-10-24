import React, { useState } from "react";
import { Scale, CheckCircle2, AlertOctagon, RotateCcw, ArrowRight, ShieldCheck, Info } from "lucide-react";

interface ClaimEvent {
  id: string;
  timestamp: string;
  quantityKg: number;
  status: "CONFIRMED" | "REJECTED_OVER_ALLOCATION";
  reason?: string;
  remainingAfter: number;
}

export const InteractiveClaimSimulator: React.FC = () => {
  const INITIAL_ALLOWANCE = 3000;
  const [approvedAllowance] = useState(INITIAL_ALLOWANCE);
  const [claimedTotal, setClaimedTotal] = useState(0);
  const [remainingAllowance, setRemainingAllowance] = useState(INITIAL_ALLOWANCE);

  const [inputQuantity, setInputQuantity] = useState<string>("1800");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<ClaimEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<ClaimEvent[]>([]);

  const handleReset = () => {
    setClaimedTotal(0);
    setRemainingAllowance(INITIAL_ALLOWANCE);
    setInputQuantity("1800");
    setErrorMessage(null);
    setLastEvent(null);
    setEventHistory([]);
  };

  const handleSubmitClaim = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    // Validation
    const trimmed = inputQuantity.trim();
    if (!trimmed) {
      setErrorMessage("Please enter a valid shipment quantity in kilograms.");
      return;
    }

    const qty = Number(trimmed);
    if (isNaN(qty)) {
      setErrorMessage("Quantity must be a valid numeric value.");
      return;
    }

    if (!Number.isFinite(qty)) {
      setErrorMessage("Value is invalid or too large.");
      return;
    }

    if (qty <= 0) {
      setErrorMessage("Shipment claim quantity must be greater than zero kg.");
      return;
    }

    const now = new Date().toLocaleTimeString([], { hour12: false });
    const eventId = `ev-${Math.random().toString(36).substring(2, 8)}`;

    // Invariant check: netClaimed <= approvedAllowance
    if (qty > remainingAllowance) {
      // Rejection logic: strictly preserve remaining balance!
      const excess = qty - remainingAllowance;
      const rejectedEvent: ClaimEvent = {
        id: eventId,
        timestamp: now,
        quantityKg: qty,
        status: "REJECTED_OVER_ALLOCATION",
        reason: `Exceeds remaining allowance (${remainingAllowance.toLocaleString()} kg) by ${excess.toLocaleString()} kg. Balance strictly preserved.`,
        remainingAfter: remainingAllowance,
      };

      setLastEvent(rejectedEvent);
      setEventHistory((prev) => [rejectedEvent, ...prev]);

      // If user just tried 1800 or 2000, let's keep the input or clear
      return;
    }

    // Success logic: Update claimed and remaining
    const newClaimed = claimedTotal + qty;
    const newRemaining = remainingAllowance - qty;

    const confirmedEvent: ClaimEvent = {
      id: eventId,
      timestamp: now,
      quantityKg: qty,
      status: "CONFIRMED",
      remainingAfter: newRemaining,
    };

    setClaimedTotal(newClaimed);
    setRemainingAllowance(newRemaining);
    setLastEvent(confirmedEvent);
    setEventHistory((prev) => [confirmedEvent, ...prev]);

    // Conveniently pre-fill next illustrative step if user just submitted 1800
    if (qty === 1800 && newRemaining === 1200) {
      setInputQuantity("2000");
    } else if (newRemaining > 0) {
      setInputQuantity(String(newRemaining));
    } else {
      setInputQuantity("");
    }
  };

  const percentageUsed = Math.min(100, Math.round((claimedTotal / approvedAllowance) * 100));

  return (
    <section id="integrity-protocol" className="py-24 px-6 relative border-t border-[#1b4332]/60 bg-[#07130F]">
      <div className="max-w-6xl mx-auto">
        {/* Title and Disclaimers */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10251C] border border-[#1b4332] text-[#B7ED78] text-xs font-mono tracking-wider uppercase mb-4">
            <Scale className="w-3.5 h-3.5" />
            Live Invariant Sandbox
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F2F5ED] mb-4">
            Try the claim ledger
          </h2>
          <p className="text-xs sm:text-sm font-mono text-[#80DDB0] uppercase tracking-wider">
            Interactive simulation &bull; Illustrative data &bull; Not a live blockchain transaction
          </p>
        </div>

        {/* Interactive Simulator Shell */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Plot Context & Claim Form (7 Cols) */}
          <div className="lg:col-span-7 bg-[#10251C] border border-[#1b4332] rounded-2xl p-7 shadow-2xl space-y-6">
            {/* Target Plot Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#1b4332]/80">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#A2B4A8]">REGISTERED BENCHMARK PLOT</span>
                <div className="text-xl font-bold font-mono text-[#F2F5ED]">SP-DEMO-104</div>
                <div className="text-xs text-[#80DDB0]">Crop: Cocoa &bull; Season: 2026 &bull; Country: GH</div>
              </div>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#07130F] border border-[#1b4332] text-xs font-mono text-[#A2B4A8] hover:text-[#F2F5ED] hover:border-[#80DDB0] transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Sandbox
              </button>
            </div>

            {/* Allowance Metrics Cards */}
            <div className="grid grid-cols-3 gap-3 font-mono text-center">
              <div className="bg-[#07130F] border border-[#1b4332] rounded-xl p-3.5">
                <div className="text-[10px] text-[#A2B4A8] uppercase">Approved Allowance</div>
                <div className="text-base sm:text-lg font-bold text-[#F2F5ED] mt-1">
                  {approvedAllowance.toLocaleString()} kg
                </div>
              </div>
              <div className="bg-[#07130F] border border-[#1b4332] rounded-xl p-3.5">
                <div className="text-[10px] text-[#A2B4A8] uppercase">Net Claimed</div>
                <div className="text-base sm:text-lg font-bold text-[#80DDB0] mt-1">
                  {claimedTotal.toLocaleString()} kg
                </div>
              </div>
              <div className="bg-[#07130F] border border-[#1b4332] rounded-xl p-3.5">
                <div className="text-[10px] text-[#A2B4A8] uppercase">Remaining</div>
                <div className="text-base sm:text-lg font-bold text-[#B7ED78] mt-1">
                  {remainingAllowance.toLocaleString()} kg
                </div>
              </div>
            </div>

            {/* Visual Balance Progress Bar */}
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-[11px] text-[#A2B4A8]">
                <span>Allowance Depletion Invariant</span>
                <span className="text-[#B7ED78]">{percentageUsed}% utilized</span>
              </div>
              <div className="w-full bg-[#07130F] h-3.5 rounded-full overflow-hidden border border-[#1b4332] p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentageUsed === 100
                      ? "bg-[#EF4444]"
                      : percentageUsed > 75
                      ? "bg-[#F59E0B]"
                      : "bg-gradient-to-r from-[#80DDB0] to-[#B7ED78]"
                  }`}
                  style={{ width: `${percentageUsed}%` }}
                />
              </div>
            </div>

            {/* Claim Submission Form */}
            <form onSubmit={handleSubmitClaim} className="space-y-4 pt-2">
              <div>
                <label htmlFor="shipment-quantity" className="block text-xs font-mono text-[#F2F5ED] mb-2 font-semibold">
                  Submit Simulated Shipment Claim (kg):
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="shipment-quantity"
                      type="text"
                      inputMode="numeric"
                      value={inputQuantity}
                      onChange={(e) => {
                        setInputQuantity(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. 1800"
                      className="w-full px-4 py-3 bg-[#07130F] border border-[#1b4332] rounded-xl text-sm font-mono text-[#F2F5ED] placeholder-[#A2B4A8]/40 focus:outline-none focus:border-[#B7ED78] transition"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#A2B4A8]">
                      kg
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-[#B7ED78] text-[#07130F] font-bold text-xs uppercase tracking-wider font-mono hover:bg-[#80DDB0] transition flex items-center gap-2 cursor-pointer shadow-forest-glow"
                  >
                    Submit Claim
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 bg-[#190d0e] border border-[#EF4444]/60 rounded-xl text-xs font-mono text-[#EF4444] flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Quick Preset Buttons */}
              <div className="pt-2">
                <span className="text-[11px] font-mono text-[#A2B4A8] block mb-2">
                  Recommended Test Cases:
                </span>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setInputQuantity("1800");
                      setErrorMessage(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#07130F] border border-[#1b4332] text-[#80DDB0] hover:border-[#80DDB0] transition"
                  >
                    Step 1: 1,800 kg (Valid claim)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputQuantity("2000");
                      setErrorMessage(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#07130F] border border-[#1b4332] text-[#EF4444] hover:border-[#EF4444] transition"
                  >
                    Step 2: 2,000 kg (Over-allocation test)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputQuantity(String(remainingAllowance));
                      setErrorMessage(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#07130F] border border-[#1b4332] text-[#B7ED78] hover:border-[#B7ED78] transition"
                  >
                    Remaining: {remainingAllowance.toLocaleString()} kg
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column: Execution Feedback & Audit Event Log (5 Cols) */}
          <div className="lg:col-span-5 bg-[#10251C] border border-[#1b4332] rounded-2xl p-7 shadow-2xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#1b4332]/80 mb-4">
                <span className="text-xs font-mono font-bold text-[#F2F5ED] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#B7ED78]" />
                  Ledger Event Audit Stream
                </span>
                <span className="text-[10px] font-mono text-[#A2B4A8]">
                  {eventHistory.length} Recorded
                </span>
              </div>

              {/* Latest Action Feedback Box */}
              {lastEvent ? (
                <div
                  className={`p-4 rounded-xl border mb-5 font-mono text-xs transition-all ${
                    lastEvent.status === "CONFIRMED"
                      ? "bg-[#07130F] border-[#B7ED78]/60 text-[#B7ED78]"
                      : "bg-[#190d0e] border-[#EF4444]/60 text-[#EF4444]"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    {lastEvent.status === "CONFIRMED" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#B7ED78]" />
                        <span>[CONFIRMED] Claim of {lastEvent.quantityKg.toLocaleString()} kg Accepted</span>
                      </>
                    ) : (
                      <>
                        <AlertOctagon className="w-4 h-4 text-[#EF4444]" />
                        <span>[REJECTED] Over-Allocation Attempt of {lastEvent.quantityKg.toLocaleString()} kg</span>
                      </>
                    )}
                  </div>
                  {lastEvent.reason ? (
                    <p className="text-[11px] text-[#A2B4A8] mt-1.5 leading-relaxed">
                      {lastEvent.reason}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#A2B4A8] mt-1.5">
                      Invariant verified on-chain. Remaining allowance reduced to {lastEvent.remainingAfter.toLocaleString()} kg.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#07130F] border border-[#1b4332] text-center font-mono text-xs text-[#A2B4A8] mb-5">
                  <Info className="w-5 h-5 mx-auto text-[#80DDB0] mb-2" />
                  Ready for simulation. Submit 1,800 kg to see confirmed claim, followed by 2,000 kg to test rejection.
                </div>
              )}

              {/* Event History Stream */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {eventHistory.length === 0 ? (
                  <div className="text-[11px] font-mono text-[#A2B4A8]/60 text-center py-4">
                    No claim events logged yet in current session.
                  </div>
                ) : (
                  eventHistory.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-lg bg-[#07130F] border border-[#1b4332] font-mono text-xs flex justify-between items-center"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              ev.status === "CONFIRMED" ? "bg-[#B7ED78]" : "bg-[#EF4444]"
                            }`}
                          />
                          <span className="text-[#F2F5ED] font-semibold">
                            {ev.quantityKg.toLocaleString()} kg
                          </span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded ${
                              ev.status === "CONFIRMED"
                                ? "bg-[#163327] text-[#B7ED78]"
                                : "bg-[#190d0e] text-[#EF4444]"
                            }`}
                          >
                            {ev.status === "CONFIRMED" ? "CONFIRMED" : "REJECTED"}
                          </span>
                        </div>
                        <div className="text-[9px] text-[#A2B4A8] mt-0.5">
                          Remaining after: {ev.remainingAfter.toLocaleString()} kg
                        </div>
                      </div>
                      <span className="text-[10px] text-[#A2B4A8]">{ev.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Integrity Guarantee Footnote */}
            <div className="pt-4 border-t border-[#1b4332]/80 text-[10px] font-mono text-[#A2B4A8] leading-relaxed">
              <span className="text-[#B7ED78] font-semibold">&bull; INVARIANT RULE:</span> Double-claiming and over-allocation are mathematically barred within the participating system.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
