# SilvaPass Requirements Specification

**Document Version:** 1.0.0  
**Status:** Approved Engineering Specification  
**Scope:** IEEE ClimateChain Global Hackathon 2026

---

## 1. System Boundary and Objectives

SilvaPass is an evidence-backed plot-identity and shipment-integrity protocol designed to prevent coordinate laundering, near-duplicate plot registration, and double-allocation of agricultural allowances.

### 1.1 In-Scope Capabilities
1. **Plot Boundary Validation**: Ingestion, syntax validation, and topological sanitization of agricultural plot boundaries in WGS84 GeoJSON format.
2. **Off-Chain Plot Identity Resolution**: Multi-stage spatial matching combining H3 discrete global indexing and exact Shapely geometry operations (IoU, Hausdorff distance, centroid offset) to detect exact, altered, jittered, or rotated polygons.
3. **Review Safeguards**: Mandatory human review queue for ambiguous spatial matches; zero auto-merging of suspicious or overlapping parcels.
4. **Authorized Production Allowances**: Recording authorized production mass ceilings (kg/MT) linked to canonical plot identities, crop varieties, and harvest seasons.
5. **On-Chain Shared Claim Invariant**: Ethereum/EVM-compatible Solidity smart contract maintaining the canonical balance of claims against authorized allowances, preventing over-allocation atomically.
6. **Legitimate Releases & Revocations**: Contract-enforced mechanisms for releasing cancelled shipment claims and adjusting/revoking allowances under authorized roles with audited off-chain rationales.
7. **Environmental Screening (FAO WHISP)**: Standalone, independently testable screening service integrating FAO WHISP ("What is in that plot?") with clear data provenance tagging.
8. **AI-Assisted Document Extraction**: Extraction of shipment documents (bills of lading, phytosanitary certificates, invoices) into typed schemas with required human confirmation before on-chain commitment.
9. **Tamper-Evident Evidence Report**: Multi-source evidence bundles binding all plot proofs, environmental screening, human sign-offs, and on-chain transaction receipts into a cryptographically anchored SHA-256 digest.

### 1.2 Out-of-Scope & System Boundaries
- **No Scientific Yield Derivation from Remote Sensing**: Yield ceilings cannot be computed solely from NDVI or satellite canopy imagery. Allowances must be approved administrative inputs derived from agronomic audits or regional standard limits.
- **No Legal EUDR Guarantee**: The system provides verifiable cryptographic and geospatial evidence; it does not claim regulatory accreditation or legal compliance certificates under EUDR or TRACES.
- **No Global Double-Claim Prevention**: Claims executed outside participating SilvaPass smart contracts or through external unlinked ledgers cannot be detected or blocked.
- **No On-Chain Raw Geospatial or PII Data**: Raw farmer coordinates, land titles, and commercial invoice PII are strictly held off-chain. Only canonical hashes and zero-sensitive commitment digests are stored on-chain.

---

## 2. Core Entities and Domain Models

### 2.1 Plot (Off-Chain Canonical Entity)
- `plot_id` (UUIDv4): Internal primary identifier.
- `canonical_hash` (bytes32 hex): SHA-256 hash of canonical WKT / normalized boundary representation.
- `boundary_geojson`: GeoJSON Polygon or MultiPolygon (validated WGS84).
- `h3_indexes`: Set of H3 cell indexes at resolution 8 and 10 covering the parcel envelope.
- `geodesic_area_ha`: Geodesic surface area in hectares calculated via Shapely / pyproj.
- `country_code`: ISO 3166-1 alpha-2 code.
- `status`: `PENDING_REVIEW` | `ACTIVE` | `FLAGGED_DUPLICATE` | `REVOKED`.
- `created_at`: UTC timestamp.

### 2.2 Spatial Review Case (Off-Chain)
- `review_id` (UUIDv4): Review case identifier.
- `submitted_plot_id`: UUID of new candidate plot.
- `conflicting_plot_id`: UUID of existing registered plot.
- `iou`: Intersection-over-Union value (0.00 to 1.00).
- `hausdorff_distance_m`: Metric Hausdorff distance between boundary perimeters.
- `centroid_drift_m`: Distance in meters between centroids.
- `adjudication_status`: `PENDING` | `CONFIRMED_DUPLICATE` | `APPROVED_SEPARATE_PARCEL`.
- `adjudicated_by`: Operator/Agronomist identifier.
- `adjudication_reason`: Required textual justification (minimum 20 characters).
- `adjudicated_at`: UTC timestamp.

### 2.3 Production Allowance (Off-Chain & On-Chain Anchor)
- `allowance_id` (UUIDv4): Off-chain identifier.
- `plot_id`: Foreign key to Plot entity.
- `canonical_plot_hash` (bytes32): Exact match to on-chain `plotId`.
- `crop_code`: Standardized crop identifier (e.g., `COFFEE_ARABICA`, `COCOA_FORASTERO`).
- `season_id` (uint256): Season/Year identifier (e.g., `2026`).
- `approved_allowance_kg` (uint256): Approved production mass ceiling.
- `remaining_allowance_kg` (uint256): Remaining claim capacity (mirrors on-chain state).
- `authorizing_role`: Address/Identity of the authorized authority.
- `allowance_evidence_hash` (bytes32): SHA-256 hash of the agronomic yield determination document.
- `status`: `ACTIVE` | `ADJUSTED` | `REVOKED`.

### 2.4 Shipment Document & Extraction Payload (Off-Chain)
- `document_id` (UUIDv4): Document identifier.
- `file_hash_sha256`: Hash of original uploaded PDF / image.
- `raw_text`: Extracted OCR/text buffer.
- `extraction_source`: `LLM_ASSISTED` | `HEURISTIC_FALLBACK`.
- `extracted_fields`:
  - `consignor_name`: string
  - `consignee_name`: string
  - `commodity_code`: string
  - `declared_weight_kg`: numeric
  - `shipment_date`: ISO 8601 Date
  - `bill_of_lading_number`: string
  - `referenced_plot_hash`: bytes32 hex
- `confirmation_status`: `PENDING_CONFIRMATION` | `CONFIRMED_BY_OPERATOR` | `REJECTED`.
- `confirmed_by`: Operator user identifier.
- `operator_adjustments`: Diff between extracted fields and final confirmed values.

### 2.5 Claim Record (Off-Chain & On-Chain)
- `claim_id` (bytes32): Unique claim identifier (UUIDv4 hash or bill-of-lading hash).
- `plot_id`: bytes32 canonical plot hash.
- `season_id`: uint256 season.
- `claimed_kg`: uint256 mass claimed in kilograms.
- `claimant`: Ethereum address submitting the claim.
- `shipment_evidence_hash`: bytes32 hash of the confirmed shipment evidence bundle.
- `status`: `ACCEPTED` | `RELEASED` | `REJECTED`.
- `transaction_hash`: On-chain EVM tx hash.
- `block_number`: EVM block number.

### 2.6 Environmental Screening Snapshot (Off-Chain)
- `screening_id` (UUIDv4): Screening result identifier.
- `plot_id`: UUID of plot.
- `service_name`: `FAO_WHISP`.
- `deforestation_risk`: `LOW_RISK` | `HIGH_RISK` | `MORE_INFO_NEEDED` | `UNAVAILABLE`.
- `cutoff_date`: `2020-12-31`.
- `convergence_details`: Forest presence indicator, commodity overlap indicator, post-2020 disturbance events count.
- `provenance_type`: `MEASURED` | `EXTERNAL_VERIFIED` | `CACHED_SNAPSHOT` | `SIMULATED` | `UNRESOLVED_UNCERTAINTY`.
- `response_digest`: SHA-256 digest of the raw WHISP JSON payload.

---

## 3. Mathematical & System Invariants

### 3.1 The Fundamental Claim Invariant
For any canonical plot `p` and season `s`:
$$\sum_{c \in \text{AcceptedClaims}(p,s)} \text{claimed\_kg}(c) - \sum_{r \in \text{ValidReleases}(p,s)} \text{released\_kg}(r) \le \text{ApprovedAllowanceKg}(p,s)$$

- Invariant MUST be enforced atomically in the smart contract execution thread.
- If a claim requests `Q` where $\text{RemainingAllowance}(p,s) < Q$, the entire transaction MUST revert, preserving previous balances.
- Rejected or reverted claims MUST NOT alter balances, emit claim acceptance events, or consume claim IDs.
- Valid releases can only be authorized by designated roles (or claim originators) referencing an active accepted claim ID, decremented once.

### 3.2 Plot Identity Decision Invariant
- Off-chain geospatial analysis is the sole decider of plot duplication.
- Two polygons $P_1$ and $P_2$ with boundary points differing by $\epsilon$ (jitter) will generate different raw coordinate hashes:
  $$\text{SHA256}(\text{coords}(P_1)) \ne \text{SHA256}(\text{coords}(P_2))$$
- Therefore, the contract **must never assume** hash equality is sufficient for geographic uniqueness.
- Identity resolution evaluates:
  $$\text{IoU}(P_1, P_2) = \frac{\text{Area}(P_1 \cap P_2)}{\text{Area}(P_1 \cup P_2)}$$
  - If $\text{IoU} \ge 0.90 \implies$ Duplicate match. Reject or assign existing canonical ID.
  - If $0.05 \le \text{IoU} < 0.90 \implies$ Ambiguous overlap. Route to mandatory human review queue.
  - If $\text{IoU} < 0.05 \implies$ Distinct parcel.

---

## 4. External Data Provenance Classifications

All evidence, reports, and API responses must tag data fields with one of the following exact enum values:
1. `MEASURED`: Physical on-ground measurement or authorized surveyor log.
2. `EXTERNAL_VERIFIED`: Directly fetched and verified response from an official third-party API (e.g., FAO WHISP live API with active API key).
3. `CACHED_SNAPSHOT`: Pinned, cryptographically hashed historical snapshot from a previous live query.
4. `SIMULATED`: Synthetic fixture or deterministic benchmark generated for testing/demo purposes.
5. `UNRESOLVED_UNCERTAINTY`: Incomplete observations, cloud cover, sensor failure, or unverified claims.

---

## 5. Scope Prioritization: MVP vs. Deferred

| Component | MVP Scope (Hackathon Required) | Deferred / Future Scope |
| :--- | :--- | :--- |
| **Polygon Analysis** | WGS84 GeoJSON, Shapely 2.0 (IoU, Hausdorff, area, winding order, self-intersection rejection). H3 for candidate indexing. | Multi-spectral satellite band ingestion, complex 3D terrain elevation adjustment. |
| **Identity Resolution** | 3-state deterministic classifier (Match, Ambiguous, Distinct). SQLite persistence. | Distributed spatial vector DB (PostGIS/PgVector), multi-tenant federated matching. |
| **Smart Contract** | Single `SilvaPassRegistry.sol` on local Hardhat EVM. Full invariant checking, role-based access, claim/release/revert logic. | L2 deployment (Arbitrum/Optimism/Base), multi-signature governance, ERC-20 wrapped allowance tokens. |
| **Environmental Screening** | Standalone FAO WHISP client supporting live API queries, pinned snapshots, and deterministic simulation fallback. | Automated continuous Sentinel-2 pipeline, live radar/SAR monitoring. |
| **Document Processing** | Dual engine: LLM extraction via structured prompts + deterministic regex/heuristic fallback. Mandatory human confirmation UI. | Fully autonomous multi-page document OCR with zero human oversight, multi-language speech-to-text. |
| **User Interface** | React + TypeScript SPA: plot upload with Leaflet map, review queue adjudicator, document confirm modal, audit report view. | Mobile native app, offline field surveyor PWA with Bluetooth GPS receiver pairing. |
