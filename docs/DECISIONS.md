# SilvaPass Architecture & Engineering Decisions (ADR)

**Document Version:** 1.0.0  
**Status:** Approved Architecture Decisions

---

## ADR-001: Off-Chain / On-Chain Hybrid Boundary
- **Context**: Agricultural supply chain traceability systems often suffer from either:
  1. Putting all data on-chain (incurring prohibitive gas costs, exposing farmer land titles and private commercial invoices publicly, and running into computational limits for geospatial operations).
  2. Relying entirely on a centralized private database (where an aggregator or exporter can rewrite balances or double-allocate the same harvest across different buyers).
- **Decision**: SilvaPass strictly bifurcates the system:
  - **Off-Chain**: All polygon geometry processing (Shapely), spatial indexing (H3), raw GeoJSON files, full invoice texts, human review logs, and environmental screening data reside off-chain in FastAPI and SQLite.
  - **On-Chain**: Only canonical plot identity hashes (`bytes32`), season IDs, crop codes, authorized allowance ceilings (`uint256`), accumulated claimed volumes, and SHA-256 evidence commitments reside on-chain in `SilvaPassRegistry.sol`.
- **Consequences**: Protects farmer privacy and commercial confidentiality while mathematically guaranteeing that over-allocation cannot occur regardless of off-chain database manipulation.

---

## ADR-002: Geospatial Matching using Shapely 2.0 with H3 as a Candidate Pruning Index
- **Context**: We need to detect near-duplicate polygons even when coordinates have been perturbed, simplified, rotated, or jittered.
- **Evaluation of Alternatives**:
  - *Option A: Raw Coordinate Hashing (SHA-256)*: Rejected. 0% recall against jittered or simplified coordinates.
  - *Option B: H3 Pure Cell Matching*: Calculating cell set overlap (Jaccard of H3 cells). Good for rapid indexing, but at resolution 8 (~0.7 km² area per cell) or resolution 10 (~15,000 m² per cell), boundary edges create false positives/negatives for irregular smallholder plots.
  - *Option C: Shapely 2.0 Exact Geometry Analysis*: Computes exact planar/geodesic intersection over union (IoU) and Hausdorff boundary distance. Highly accurate, but $O(N)$ comparisons against every registered plot is computationally inefficient.
- **Decision**: Hybrid approach. Use **H3** to compute spatial index cells covering the candidate polygon's envelope to filter candidate neighbors ($O(1)$ lookup in SQLite index). Then, use **Shapely 2.0** to perform exact geometric $\text{IoU}$ and Hausdorff distance calculations exclusively against those pruned candidates.
- **Consequences**: Combines the sub-millisecond retrieval of discrete spatial indexing with the mathematical precision of continuous computational geometry.

---

## ADR-003: Mandatory Review Queue for Ambiguous Spatial Matches
- **Context**: In parcel boundary administration, geometries frequently overlap partially due to GPS survey inaccuracy, shared boundary disputes, or intentional coordinate theft.
- **Decision**: The system defines three deterministic confidence bands:
  1. $\text{IoU} \ge 0.90$: `MATCH_IDENTICAL` $\implies$ Direct duplicate. Registration rejected or assigned existing ID.
  2. $0.05 \le \text{IoU} < 0.90$: `AMBIGUOUS_OVERLAP` $\implies$ Routed to mandatory human review queue (`PENDING_REVIEW`). Zero allowance can be granted until explicit operator adjudication.
  3. $\text{IoU} < 0.05$: `DISTINCT` $\implies$ Clean registration as a distinct parcel.
- **Consequences**: Eliminates silent auto-merging of land parcels. Prevents fraudulent acquisition of adjacent land while avoiding false rejections of legitimate neighboring farms.

---

## ADR-004: Environmental Screening Architecture (FAO WHISP Adapter)
- **Context**: The FAO Open Foris initiative developed WHISP ("What is in that plot?") to evaluate EUDR deforestation risks using a multi-map "convergence of evidence" methodology. However, in hackathon, demo, or offline test environments, live API endpoints may be unreachable, rate-limited, or require unavailable API keys.
- **Decision**: SilvaPass builds a dedicated `WhispScreeningService` adapter with three explicit, auditable operational modes:
  1. `LIVE`: Calls official WHISP endpoint (`POST /submit/geojson` + `GET /status/{token}`) using `X-API-KEY`. Result tagged `EXTERNAL_VERIFIED`.
  2. `SNAPSHOT`: Uses pre-recorded, cryptographically pinned JSON responses from real WHISP evaluations for reference benchmark parcels. Result tagged `CACHED_SNAPSHOT`.
  3. `SIMULATION`: Deterministic rule-based fallback fixture evaluating basic latitude/longitude bounding boxes. Result tagged `SIMULATED`.
- **Consequences**: The system never crashes during network or API outages and never fabricates live verification. Every report visibly displays its true data provenance.

---

## ADR-005: AI Document Extraction with Schema Enforcement & Mandatory Human Confirmation
- **Context**: Large language models can extract structured fields from bills of lading and invoices, but are prone to hallucinations, digit transposition (e.g. 10,000 vs 100,000 kg), and false certainty.
- **Decision**:
  - LLM extraction outputs are strictly constrained to a Pydantic schema (`ShipmentDocumentExtraction`).
  - Extracted records are initially assigned status `PENDING_CONFIRMATION`.
  - The API and UI enforce a **Human-in-the-Loop Confirmation Gate**: An authorized human officer must review the extracted fields alongside the raw document text/preview and explicitly sign off.
  - The final confirmed JSON payload is hashed (`shipmentEvidenceHash`) and committed on-chain during claim execution.
- **Consequences**: Prevents unverified AI hallucinations from mutating smart contract balances, while still providing significant time savings over manual data entry.

---

## ADR-006: Local Hardhat Node & Solidity Smart Contract Tooling
- **Context**: The project requires Solidity contracts, verifiable invariants, deterministic tests, and easy local demonstration without Docker or Bun.
- **Decision**:
  - Use Hardhat (`npx hardhat`) running on Node.js 22 with standard `npm`.
  - Contracts use OpenZeppelin Contracts v5.x for standardized `AccessControl`, `ReentrancyGuard`, and `Pausable`.
  - Backend communicates with the local Hardhat node via `web3.py` or `eth-account`.
- **Consequences**: 100% reproducible on any standard macOS/Linux workstation with Node.js and Python. No Docker daemon required.
