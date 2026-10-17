# SilvaPass Prioritized Implementation Plan

This roadmap outlines the systematic, verified implementation sequence for SilvaPass. In accordance with project engineering rules, each phase is self-contained, testable, and deterministic, building strictly upon verified preceding components.

---

## Phase 1: Environment & Project Foundation
- **Goal**: Initialize an auditable, strictly typed TypeScript & Node.js environment with deterministic testing tools.
- **Tasks**:
  1. Initialize `package.json` with npm, TypeScript (`tsconfig.json`), ESLint, and testing framework (Vitest).
  2. Setup project structure:
     - `src/core/` (domain logic, types, error handling)
     - `src/geo/` (geospatial parsing, topological validation, identity resolution)
     - `src/contracts/` (Solidity smart contracts and Hardhat/Foundry test harness)
     - `src/environmental/` (screening adapters, snapshot verifiers)
     - `src/documents/` (document field extraction, human confirmation contracts)
     - `src/evidence/` (provenance-tagged report builder)
     - `test/` (unit, integration, and property-based test suites)
  3. Create `.env.example` with clear schema definitions.
- **Acceptance Criteria**: `npm run build` and `npm test` execute cleanly with 0 errors.

---

## Phase 2: Plot Boundary Ingestion & Strict Topological Validation
- **Goal**: Accept, validate, and sanitize agricultural plot boundaries, rejecting invalid or degenerate geometries.
- **Tasks**:
  1. Define strict Zod schemas for GeoJSON Polygon / MultiPolygon input.
  2. Implement topology validation:
     - Check minimum/maximum coordinates (WGS84 bounds: lat [-90, 90], lon [-180, 180]).
     - Enforce polygon ring closure (first coordinate === last coordinate).
     - Detect and reject self-intersecting boundaries (simple polygon test).
     - Minimum vertex count (>= 4 points including closure).
     - Sensible area limits (prevent zero-area or continent-sized polygons).
  3. Compute deterministic geometric properties: geodesic area (hectares), bounding box, centroid.
- **Acceptance Criteria**: Unit test suite covering degenerate polygons, self-intersections, inverted winding, coordinate out-of-bounds, and valid farm parcel geometries.

---

## Phase 3: Spatial Identity Resolution & Near-Duplicate Detection
- **Goal**: Detect overlapping or coordinate-altered plots without relying on exact coordinate matches.
- **Tasks**:
  1. Compute spatial indexing (H3 discrete global grid cells at appropriate resolution, or canonical spatial bounding envelopes).
  2. Implement robust geometric similarity engine:
     - Compute Intersection-over-Union (IoU / Jaccard Index).
     - Compute boundary distance metrics (approximate Hausdorff distance / centroid displacement).
     - Detect coordinate jittering, vertex decimation/densification, and rotation.
  3. Categorize plot comparison outcomes into 3 explicit states:
     - `MATCH_IDENTICAL`: IoU > threshold (e.g., >= 0.95) -> Duplicate of existing registered plot.
     - `AMBIGUOUS_OVERLAP`: IoU between lower and upper bounds (e.g., 0.10 <= IoU < 0.95) -> Flag for mandatory human review.
     - `DISTINCT`: IoU < 0.10 and centroid separation -> New, distinct plot.
  4. Build the Ambiguous Match Review Queue:
     - Data model for flagged plot pairs.
     - Review actions: `CONFIRM_DUPLICATE`, `APPROVE_SEPARATE_PARCEL` (with required operator reason and audit record).
     - Strict rule: Ambiguous plots cannot register allowances until reviewed.
- **Acceptance Criteria**: Test harness with perturbed coordinates (jittered GPS noise, simplified vertices, shifted vertices) proving detection of duplicate or ambiguous cases and preventing automatic merges.

---

## Phase 4: On-Chain Shared Claim Invariant (Solidity Smart Contracts)
- **Goal**: Maintain an auditable, immutable claim balance preventing double-allocation and race conditions.
- **Tasks**:
  1. Set up Solidity development harness (Hardhat) with TypeScript test runner.
  2. Implement `SilvaPassRegistry.sol`:
     - Data structures: Plot record hash (`plotId` = hash of canonical spatial identity), season identifier, crop type, max allowance capacity (kg).
     - Claim record: accumulated claimed amount, remaining capacity, claim event logs with off-chain evidence hash commitments.
  3. Implement core methods:
     - `registerAllowance(bytes32 plotId, uint256 seasonId, uint256 maxKg, bytes32 allowanceEvidenceHash)` (authorized registrar only).
     - `claimShipment(bytes32 plotId, uint256 seasonId, uint256 claimKg, bytes32 shipmentEvidenceHash)`:
       - Requires `claimedAmount + claimKg <= maxKg`.
       - Atomically increments balance. Reverts with custom error `AllowanceExceeded(uint256 remaining, uint256 requested)` on over-allocation.
       - Reverts on unregistered plot/season.
  4. Write comprehensive smart contract tests:
     - Normal claims decrementing balance.
     - Edge cases: claiming exact remainder, claiming 0, claiming 1 unit over limit (must revert).
     - Concurrency/sequential multi-claim attempts draining balance correctly.
- **Acceptance Criteria**: 100% test pass on Solidity contracts with gas reporting and state invariant verification.

---

## Phase 5: Environmental Screening & Provenance Classification
- **Goal**: Screen parcel boundaries against environmental/deforestation indicators with crystal-clear data provenance.
- **Tasks**:
  1. Implement environmental adapter interface:
     - `screenPlot(plotGeometry, observationDateRange): Promise<EnvironmentalScreeningResult>`
  2. Support multiple operational modes:
     - Live external integration (when credentials/connectivity available).
     - Verifiable pinned historical snapshots (reproducible offline verification).
     - Deterministic benchmark simulation fixtures (clearly identified).
  3. Assign strict provenance tags to all outputs:
     - `[MEASURED]`: direct sensor/verified observation.
     - `[EXTERNAL_VERIFIED]`: third-party registry query response.
     - `[CACHED_SNAPSHOT]`: pinned cryptographic snapshot from reference test set.
     - `[SIMULATED]`: synthetic demonstration benchmark.
     - `[UNRESOLVED_UNCERTAINTY]`: cloud cover, missing data, or unconfirmed status.
- **Acceptance Criteria**: Screening pipeline correctly flags deforestation risk or confirms clear status; never claims live data when running on fallback snapshots or simulation.

---

## Phase 6: Document Extraction & Human-in-the-Loop Confirmation
- **Goal**: Extract shipment certificate/invoice fields, validate against schemas, and require human confirmation.
- **Tasks**:
  1. Ingest document payloads (bills of lading, harvest receipts, phytosanitary certificates).
  2. Implement document field extractor:
     - Extract: Plot ID reference, Commodity / Crop type, Net Weight / Quantity, Shipment Date, Consignor/Consignee.
     - Support structured extraction engine with transparent offline heuristic/regex fallback.
  3. Enforce Human-in-the-Loop Confirmation:
     - Extracted payload status defaults to `PENDING_CONFIRMATION`.
     - Operator confirmation endpoint / mechanism requires review of extracted fields against raw document hash.
     - Discrepancy corrections logged with operator identity and timestamp before triggering on-chain claim.
- **Acceptance Criteria**: Document parsing accurately extracts fields; requires human confirmation step before claim submission; transparent fallback operates predictably offline.

---

## Phase 7: Evidence Report Generation & End-to-End Audit Trail
- **Goal**: Produce a comprehensive, tamper-evident evidence bundle for any shipment.
- **Tasks**:
  1. Aggregate all lifecycle proofs:
     - Plot topological validity check record.
     - Spatial deduplication and identity resolution report.
     - Review adjudication record (if ambiguous match occurred).
     - Environmental screening snapshot & provenance tags.
     - Verified document fields & human confirmation signature.
     - On-chain transaction receipt (block number, contract address, tx hash).
  2. Compute canonical SHA-256 evidence bundle root hash matching the on-chain committed hash.
  3. Render human-readable (Markdown / PDF / JSON-LD) audit report with clear disclaimer of boundaries and non-claims.
- **Acceptance Criteria**: Deterministic hashing of the evidence report; verifiable against on-chain claim record; complete audit trail from plot submission to shipment claim.

---

## Phase 8: Verification, Documentation & Clean Checkout Demonstration
- **Goal**: Ensure the entire system can be cloned, verified, and demonstrated by any third party with zero friction.
- **Tasks**:
  1. Provide automated test runner script (`npm test`) executing:
     - Unit tests (geometry, deduplication, schemas).
     - Smart contract tests (Hardhat invariant tests).
     - Integration scenario: Ingest plot -> Detect coordinate perturbation -> Review queue -> Authorize allowance -> Ingest shipment doc -> Human confirm -> On-chain claim -> Attempt double-claim (rejected) -> Export evidence report.
  2. Write comprehensive `README.md` and user walk-through guide.
  3. Verify clean checkout reproduction steps.
- **Acceptance Criteria**: Complete end-to-end verification passing deterministically on standard Node 22 / npm environment.
