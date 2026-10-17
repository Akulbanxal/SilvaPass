# SilvaPass Evaluation Methodology, Experimental Protocol, and Benchmark Limitations

## Executive Summary
This document specifies the evaluation methodology, experimental setup, baseline formulations, statistical metrics, and threat model boundaries for the **SilvaPass EUDR Compliance Ledger** evaluation suite.

The offline evaluation suite is executable via a single documented command:
```bash
npm run evaluate
```
This command outputs machine-readable JSON metrics to `evaluation_results.json` and renders a structured terminal summary report.

---

## Evaluation A: Geospatial Plot Identity Resolution

### 1. Objective & Threat Model
In EUDR compliance workflows, bad actors or fragmented cadastral authorities may submit duplicate or perturbed polygon registrations for the same physical land parcel (e.g. to secure multiple quota allowances or launder deforestation-associated commodities). Conversely, adjacent legitimate plots sharing fence boundaries must not be falsely merged or denied registration.

### 2. Experimental Benchmark Design
We construct a labeled, deterministic synthetic benchmark suite located in Mato Grosso, Brazil (`-54.500000 lon`, `-12.500000 lat`), representing a ~30 hectare agricultural parcel subject to various realistic cadastral perturbations:

| Test Case | Description | Ground Truth Status | Expected Valid Geometry |
| :--- | :--- | :--- | :--- |
| **Exact duplicate** | Identical coordinates | Match / Duplicate | Yes |
| **Reversed vertex ordering** | Reverse winding (counter-clockwise) | Match / Duplicate | Yes |
| **Small shift (~15m)** | 15m coordinate translation offset | Match / Duplicate | Yes |
| **Coordinate jitter (~3-5m)** | Gaussian GPS drift (pseudo-random seed 42) | Match / Duplicate | Yes |
| **Rotated geometry (~2 deg)** | Centroid rotation within expected boundary | Match / Duplicate | Yes |
| **Vertex simplification** | Decimated perimeter vertices | Match / Duplicate | Yes |
| **Vertex densification** | Intermediate collinear vertices added | Match / Duplicate | Yes |
| **Duplicate vertices** | Consecutive repeated points | Match / Duplicate | Yes |
| **Partial overlap (~40%)** | 40% spatial intersection | Distinct (Ambiguous / Human Review) | Yes |
| **Adjacent legitimate plot** | Shares eastern fence line (0 interior overlap) | Distinct | Yes |
| **Distinct distant plot (5km)** | Independent parcel 5 km west | Distinct | Yes |
| **Different-size nearby centroid** | 1 ha subplot centered on 30 ha parcel centroid | Distinct | Yes |
| **Self-intersecting bow-tie** | Figure-8 self-intersecting polygon | Invalid Geometry (Rejected) | No |
| **Invalid coordinate range** | Out of WGS84 range (`lat > 90`) | Invalid Geometry (Rejected) | No |
| **Non-finite coordinates (NaN)** | NaN coordinate tuple | Invalid Geometry (Rejected) | No |

> [!IMPORTANT]
> **Synthetic Benchmark Notice:** All geospatial metrics reported below represent performance against **deterministically synthesized benchmark fixtures**. They do not represent real-world farm accuracy unless validated on ground-truth administrative cadastre datasets (such as Brazilian CAR or EU LPIS data).

### 3. Baseline Formulations
We evaluate the proposed SilvaPass spatial pipeline against two industry baselines:
1. **Baseline 1 — Exact Geometry Hashing:** Computes SHA-256 of the raw GeoJSON coordinate array. Fails whenever vertex winding, starting vertex, or GPS jitter alters the representation.
2. **Baseline 2 — Centroid Distance Baseline:** Flags candidate plots as duplicates if geodesic distance between centroids is $\le 25.0$ meters. Fails when distinct small subplots share centroids or when boundary shifts alter centroids.
3. **Proposed Method — SilvaPass Spatial Engine:**
   - Pre-filters candidates using spatial H3 indices (Resolution 8).
   - Enforces topological validity via Shapely 2.0.
   - Normalizes vertex sequences and winding to compute a canonical geometry fingerprint.
   - Computes planar & geodesic Intersection-over-Union (IoU), geodesic area ratio, pyproj WGS84 geodesic centroid drift, and Hausdorff boundary distance.
   - Routes intermediate overlaps ($0.05 \le \text{IoU} < 0.85$) to an auditable operator review queue (`PENDING_REVIEW`) rather than silently merging them.

### 4. Metrics Definition
- $\text{Precision} = \frac{TP}{TP + FP}$
- $\text{Recall} = \frac{TP}{TP + FN}$
- $\text{False Positive Rate (FPR)} = \frac{FP}{FP + TN}$
- $\text{False Negative Rate (FNR)} = \frac{FN}{FN + TP}$
- $\text{F1-Score} = 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$

---

## Evaluation B: Smart Contract Invariants

### 1. Objective & Invariant Specification
The `SilvaPassRegistry.sol` smart contract enforces physical mass balance invariants on-chain, preventing double-claiming and over-allocation.

Deterministic unit tests and property-based randomized sequence tests verify the following formal invariants:
1. **Non-Negative Balance:** $\text{remainingAllowanceKg} \ge 0$ unconditionally.
2. **Mass Balance Upper Bound:** $\text{claimedKg} - \text{releasedKg} \le \text{approvedAllowanceKg}$ after every operation.
3. **Idempotency / Unique Claims:** Duplicate claim identifiers revert (`ClaimAlreadyExists`) and never deduct twice.
4. **Non-Mutating Rejections:** When a claim exceeds remaining capacity, the contract emits a non-reverting `ShipmentClaimRejected` event and leaves storage balances completely untouched.
5. **Role-Based Access Control (RBAC):** Only authorized registrars (`REGISTRAR_ROLE`) may approve allowances; only authorized exporters (`EXPORTER_ROLE`) may submit claims; only operators (`CLAIM_OPERATOR_ROLE`) may release claims.
6. **Safe Adjustment & Revocation:** Allowance cannot be adjusted below net active claims; revoking a plot permanently halts further claims.
7. **Randomized Sequence Verification:** 30 consecutive pseudo-random claim and release operations maintain the mass invariant after every single transaction.

---

## Evaluation C: Document Extraction Engine

### 1. Objective & Provider Strategy
Evaluates the information extraction engine responsible for extracting draft shipment fields from commercial documentation (Bills of Lading, Invoices, Phytosanitary Certificates).

The architecture uses a two-tier provider strategy:
1. **Deterministic Rule-Based Fallback Provider:** Regex and heuristic token extraction with zero external API dependencies. Evaluated deterministically across all benchmark documents.
2. **External LLM Provider (`OpenAIExtractionProvider`):** Invoked when `OPENAI_API_KEY` is configured.
> [!NOTE]
> Evaluation results for the fallback engine and external LLM providers are evaluated and recorded **separately**; fallback performance is never conflated with LLM provider capabilities.

### 2. Evaluated Capabilities
- **Field-Level Accuracy:** Exact matching of commodity code, shipment quantity, declared weight in kg, plot references, and document identifiers.
- **Unit Normalization:** Normalizing Metric Tons (MT $\to$ kg) and standard 60 kg coffee bags ($\text{bags} \times 60 \to \text{kg}$).
- **Missing Plot Detection:** Flags missing cadastral references as reviewable fields.
- **Ambiguity & Conflict Handling:** Flags contradictory declared weights and requires human-in-the-loop confirmation.
- **Prompt Injection Defense:** Verifies that adversarial injection text in remarks (e.g. system override commands) cannot zero out declared quantities or bypass human confirmation.

---

## Evaluation D: Fault Handling & System Boundaries

### 1. Evaluated Fault Scenarios
SilvaPass enforces strict boundary denials and graceful degradation under external failure:
- **Environmental API Timeout:** Bounded HTTP timeout (1.0s) yielding `UNRESOLVED_UNCERTAINTY` without hanging server threads.
- **Malformed / 502 Bad Gateway:** Gracefully catches non-JSON HTML payloads from external screening services.
- **Authentication Failure:** Flags missing or expired API credentials with auditable provenance metadata.
- **Rate Limiting (HTTP 429):** Bounded exponential backoff before returning uncertainty.
- **Stale Environmental Snapshot:** Returns cached benchmark data explicitly tagged with `CACHED_SNAPSHOT` provenance.
- **Boundary Denial:** Unresolved plots (`PENDING_REVIEW` or `FLAGGED_DUPLICATE`) are strictly blocked from receiving on-chain allowances.
- **Over-Allocation & Idempotency:** API layer preserves balances and deduplicates identical submissions.

---

## Limitations and Sources of Bias

1. **Synthetic Geometry Bias:**
   - The synthetic benchmark fixtures are generated from idealized geometric transformations. Real agricultural plots often exhibit organic meandering boundaries (rivers, tree lines) and survey inaccuracies that can cause edge cases not fully captured by regular polygons.
2. **Absence of Real Ground-Truth Cadastre:**
   - Due to the absence of public ground-truth cadastral registries with confirmed double-claiming ground truth, the spatial performance is labeled strictly as synthetic benchmark performance.
3. **Deterministic Extractor Rule Heuristics:**
   - The deterministic document extractor relies on English and Portuguese keyword heuristics. Unstructured free-form text or non-standard languages require configuring an external multimodal LLM provider.
4. **Simulated Blockchain Latency in Local Runs:**
   - Contract invariant tests execute against Hardhat's in-memory EVM. In production public networks, transaction reorgs, RPC timeouts, and gas price spikes represent operational failure modes managed by SilvaPass's off-chain queue worker.
