# SilvaPass Threat Model & Adversarial Analysis

**Document Version:** 1.0.0  
**Scope:** Threat Vectors, Attack Surfaces, Mitigations, and Failure Behavior.

---

## 1. Adversarial Assumptions & Threat Actors

We evaluate SilvaPass against a spectrum of realistic adversaries operating in global agricultural trade:
1. **Malicious / Opportunistic Producers & Aggregators**: Attempting to register identical or overlapping plots under fictitious IDs to multiply their permitted export quota ("quota laundering").
2. **Dishonest Exporters / Shippers**: Attempting to reuse the same shipment certificate/bill of lading multiple times or exceed their authorized harvest volume.
3. **Corrupt / Compromised Registrars**: Authorized internal operators who attempt to arbitrarily inflate allowances or suppress duplicate flags.
4. **Adversarial External Attackers**: Submitting malformed geometries (e.g. self-intersecting "polygon bombs"), exploiting race conditions via concurrent claim submissions, or attempting to corrupt the smart contract state.
5. **Degraded Infrastructure**: External API outages (FAO WHISP down, Ethereum RPC latency/forks, offline network nodes).

---

## 2. Threat Vector Matrix & Mitigations

| Threat Vector / Attack | Target Component | Threat Scenario | System Defense & Mitigation | Expected System Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **1. Coordinate Jitter / Vertex Perturbation** | Geospatial Engine | Attacker randomly offsets polygon vertices by a few meters (GPS noise simulation) to alter coordinate hash and evade exact-match deduplication. | H3 spatial indexing retrieves neighborhood candidates; Shapely computes Intersection-over-Union (IoU) and Hausdorff distance. | If $\text{IoU} \ge 0.90$, immediately flagged as duplicate of original plot. Rejected with 409 Conflict. |
| **2. Rotated, Scaled, or Simplified Polygons** | Geospatial Engine | Attacker applies affine transformation (slight rotation/simplification) to duplicate a large parcel. | IoU overlap remains high despite vertex rearrangement. Centroid drift check detects unnatural shifts. | High IoU ($\ge 0.90$) flags duplicate; moderate IoU ($0.05 \le \text{IoU} < 0.90$) halts registration into mandatory human review. |
| **3. Legitimate Adjacent Plots** | Geospatial Engine | Two bona fide neighboring farms share a boundary line or fence. | Exact boundary intersection check detects 1-dimensional edge contact (zero shared area) or minimal sliver overlap. | IoU is evaluated; shared boundary lines yield $\text{IoU} \approx 0.00$. Registered cleanly as distinct parcels. Slivers ($<0.05$) pass with tolerance. |
| **4. Malformed / Degenerate Polygons** | Geospatial Engine | Attacker uploads self-intersecting ("figure 8"), unclosed, or infinite-coordinate GeoJSON to crash backend or exhaust CPU. | Strict Zod/Pydantic syntax validation followed by Shapely 2.0 `is_valid` and `is_simple` checks. Coordinate bounding boxes enforced [-180, 180, -90, 90]. | Rejected immediately with 422 Unprocessable Entity and descriptive topological error. Never reaches database. |
| **5. Duplicate Claim Identifiers** | Smart Contract | Exporter attempts to claim against the same shipment bill of lading twice. | `SilvaPassRegistry.sol` maintains a mapping `mapping(bytes32 => Claim) public claims;`. Checks `require(claims[claimId].timestamp == 0, "ClaimExists")`. | Transaction reverts immediately. No balance modified. |
| **6. Over-Allocation / Claim Exhaustion** | Smart Contract | Exporter attempts to claim 10,000 kg when only 4,000 kg remain in the season's approved allowance. | Atomic on-chain check: if `requestedClaimKg > remaining`, emits `ShipmentClaimRejected` event and returns `false` without reverting, leaving balances untouched while creating an on-chain receipt. | Non-reverting audit record emitted. Transaction succeeds on-chain; balance remaining is strictly unchanged. |
| **7. Concurrent Claim Race Condition** | Smart Contract / Node | Two exporters attempt to claim the remaining 5,000 kg simultaneously in the same block or consecutive blocks. | EVM serial transaction execution. Whichever transaction is included first succeeds and decrements remaining capacity to 0. The second transaction triggers `ShipmentClaimRejected`. | Zero possibility of negative balance or balance corruption. System remains strictly within invariant. |
| **8. Unauthorized Registrars & Claimants** | Smart Contract | Unauthenticated Ethereum address attempts to call `registerPlot` or `revokePlot`. | OpenZeppelin `AccessControl`. Function restricted to `onlyRole(REGISTRAR_ROLE)`. | Transaction reverts with standard unauthorized role error `AccessControlUnauthorizedAccount`. |
| **9. Inaccurate or Malicious AI Extraction** | Document Engine | LLM / OCR hallucinates incorrect weight (e.g., extracts 1,000 kg instead of 100,000 kg) or attacker submits fabricated invoice. | Automated extraction yields `PENDING_CONFIRMATION` status. The system enforces a mandatory human confirmation step where an authorized officer must verify against the original file hash. | Unconfirmed claims cannot be signed or committed to the smart contract. Corrections are auditably logged. |
| **10. Stale / Forged Environmental Evidence** | Screening Engine | Attacker provides fabricated deforestation clearance or claims an old 2019 report proves 2026 compliance. | Environmental screening requires fresh query to FAO WHISP or cryptographic verification of a pinned snapshot. Every report carries mandatory provenance badge (`[MEASURED]`, `[EXTERNAL_VERIFIED]`, `[CACHED_SNAPSHOT]`, etc.) with explicit timestamp and query digest. | Stale or unverified claims are explicitly branded as `[UNRESOLVED_UNCERTAINTY]`. |
| **11. Compromised Registrar Account** | Governance / Off-Chain | A corrupt internal operator attempts to inflate an allowance or approve an illegitimate duplicate. | Allowance adjustments require explicit justification text and off-chain audit logs; smart contracts emit indexed events with evidence hashes. In multi-sig setups, allowance caps require threshold sign-offs. | Off-chain monitoring alerts on abnormal allowance adjustments. Evidence hashes expose unauthorized discrepancies. |
| **12. API Outage (FAO WHISP Down)** | Integration Service | External FAO WHISP endpoint returns 500 or times out. | Timeout circuit-breaker (1.0 to 10.0 seconds). Service transparently falls back to verified offline reference snapshots or mock simulation fixtures with explicit provenance tagging. | API does not crash; evidence bundle clearly marks result as `[CACHED_SNAPSHOT]` or `[SIMULATED]`. Never pretends live verification succeeded. |
| **13. Blockchain RPC Outage** | Backend Gateway | Local Hardhat node or remote EVM RPC is unreachable during claim submission. | Backend catches connection error, operates in verified simulation fallback mode, logs structured warning, and marks receipt as simulated. | No state inconsistency created; transaction will not silently fail or pretend to have been mined. |

---

## 3. Detailed Contract Failure Behaviors

The `SilvaPassRegistry.sol` smart contract enforces strict, deterministic failure states via Solidity 0.8.x custom errors and non-reverting rejection events:

1. **`PlotAlreadyExists(bytes32 plotId, uint256 seasonId)`**:
   - Reverts when a registration already exists for the given plot and season.
2. **`PlotNotFound(bytes32 plotId, uint256 seasonId)`**:
   - Reverts when attempting to claim or adjust an unregistered plot-season pair.
3. **`PlotRevokedError(bytes32 plotId, uint256 seasonId)`**:
   - Reverts when attempting to claim against a plot that has been administratively revoked.
4. **`ShipmentClaimRejected(...)` (Non-Reverting Event)**:
   - Emitted when requested claim mass exceeds remaining capacity. The transaction succeeds on-chain and returns `false`, generating an auditable transaction receipt without corrupting or deducting from storage balances.
5. **`ClaimAlreadyExists(bytes32 claimId)`**:
   - Reverts when attempting to reuse an existing claim ID.
6. **`ClaimNotFound(bytes32 claimId)`**:
   - Reverts when attempting to release a non-existent claim.
7. **`ClaimAlreadyReleased(bytes32 claimId)`**:
   - Reverts when attempting to double-release an already released claim.
8. **`AccessControlUnauthorizedAccount(address account, bytes32 neededRole)`**:
   - Reverts when an unauthorized caller attempts administrative functions.


---

## 4. Trust Assumptions & Attack Surface Limits

- **What SilvaPass Guarantees**:
  - Within the participating system, no plot can be registered twice under minor geometric perturbations.
  - No exporter can claim more than the approved allowance on-chain.
  - No claim can be created without verified human confirmation and cryptographic evidence digests.
  - All environmental data is transparently attributed to its true origin without fabrication.
- **What SilvaPass Does NOT Guarantee**:
  - It cannot physically inspect physical borders on the ground; if an applicant colludes with an authorized surveyor to measure land they do not own, the system records the authenticated surveyor's measurement.
  - It cannot prevent an exporter from selling commodities to buyers who do not participate in or check the SilvaPass registry.
