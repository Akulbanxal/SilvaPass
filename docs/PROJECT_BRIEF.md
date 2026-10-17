# SilvaPass Project Brief

**IEEE ClimateChain Global Hackathon 2026**  
*Evidence-Backed Plot Identity and Shipment Integrity Protocol*

---

## 1. Executive Summary & Problem Statement

Supply chain traceability regulations (such as EUDR) and voluntary carbon/agro-integrity standards require verifiable proof that agricultural commodities originate from legal, non-deforested, specific geographic plots of land without double-counting production yields.

However, existing systems suffer from critical integrity gaps:
1. **Coordinate Laundering / Near-Duplicate Plots**: Bad actors slightly perturb or jitter polygon boundary coordinates to bypass deduplication checks, registering the same plot under multiple identities.
2. **Double-Claiming & Over-Allocation**: Without a shared, tamper-resistant claim invariant, farmers or aggregators can repeatedly claim shipments against the same parcel allowance across disparate buyers or certifying bodies.
3. **Data Fabrication & Opaque AI**: Unsubstantiated claims of "AI verification" or "satellite green light" often mask missing data, opaque models, and lack of deterministic proofs.
4. **Privacy vs. Auditability**: Publishing raw farmer coordinates and private invoice documents directly onto public ledgers introduces severe privacy and legal violations.

**SilvaPass addresses these challenges** by establishing a deterministic, evidence-backed plot-identity resolution engine coupled with an off-chain/on-chain dual architecture: off-chain geospatial indexing and document verification with an on-chain, auditable allowance balance invariant.

---

## 2. Core Product Objectives

1. **Plot Ingestion & Strict Geometry Validation**:
   - Ingest GeoJSON / WKT polygon boundaries.
   - Enforce topological validity (RFC 7946, closure, self-intersection rejection, winding order, coordinate reference system WGS84).
2. **Robust Plot Identity & Near-Duplicate Detection**:
   - Compute spatial hashes (e.g. H3 discrete global grid / canonical envelope).
   - Evaluate geometric similarity metrics: Intersection over Union (IoU / Jaccard index), Hausdorff distance, centroid drift, and area delta.
   - Categorize plot comparison into distinct confidence bands:
     - *Identical / Near-Identical* (high confidence match)
     - *Ambiguous Overlap* (flags potential split, partial boundary theft, or vertex jitter)
     - *Distinct* (negligible or no spatial overlap)
3. **Review Safeguards for Ambiguous Matches**:
   - Never auto-merge or silently overwrite ambiguous plot matches.
   - Route questionable plots to a formal review queue requiring explicit operator adjudication and auditable resolution logging.
4. **Production Allowance Authorization**:
   - Bind an authorized production allowance (mass ceiling in kg/metric tons) to a canonical plot identity, crop type, and crop season/year.
   - Root allowances in explicit, versioned calculation parameters (e.g., regional agro-yield benchmarks, canopy area, or agronomist authorization).
   - Clearly delineate illustrative benchmarks from scientifically measured yields.
5. **On-Chain Shared Claim Invariant (Solidity Smart Contracts)**:
   - Maintain a transparent, cryptographically backed balance for each plot-season allowance.
   - Store canonical plot identity hash, season ID, total allowance cap, and accumulated claimed volume on-chain.
   - Accept valid shipment claims and guarantee atomic rejection of over-allocation attempts without state corruption.
6. **Environmental Screening Integration**:
   - Interface with external environmental datasets (e.g., Global Forest Watch / Sentinel-2 / Hansen tree cover loss snapshots).
   - Differentiate explicitly between:
     - Real-time live external API queries
     - Pinned/cached verifiable environmental snapshots
     - Deterministic simulations / fallback fixtures
     - Unresolved uncertainty / missing cloud-free imagery
7. **AI-Assisted Shipment Document Processing with Human Confirmation**:
   - Extract relevant shipment fields (bill of lading / phytosanitary certificate / invoice: plot ID, commodity volume, timestamp, carrier).
   - Perform schema validation against extracted entities.
   - Require explicit human sign-off before committing an extracted claim transaction.
   - Maintain a transparent fallback parser for offline/no-API conditions.
8. **Comprehensive Evidence Ledger & Integrity Report**:
   - Generate structured, machine-verifiable and human-readable evidence reports for every shipment.
   - Explicitly classify each assertion as: `[MEASURED]`, `[EXTERNAL_VERIFIED]`, `[CACHED_SNAPSHOT]`, `[SIMULATED]`, or `[UNRESOLVED_UNCERTAINTY]`.
   - Never claim absolute guarantees beyond the participating system perimeter.

---

## 3. System Architecture

```
                 +-----------------------------------------------------------+
                 |                      Client Interface                     |
                 |  - Plot Boundary Visualizer & Flagged Review UI          |
                 |  - Document Upload & Field Confirmation Form              |
                 |  - Evidence Report Inspector & Audit Trail                |
                 +-----------------------------+-----------------------------+
                                               | (HTTPS / REST)
                                               v
                 +-----------------------------------------------------------+
                 |                 SilvaPass Backend (Node.js/TS)            |
                 |                                                           |
                 |  +------------------------+  +-------------------------+  |
                 |  | Geospatial Validator   |  | Identity & Deduplication|  |
                 |  | - Topological validity |  | - H3 indexing           |  |
                 |  | - Area & boundary calc |  | - IoU & Hausdorff match |  |
                 |  +------------------------+  +-------------------------+  |
                 |  +------------------------+  +-------------------------+  |
                 |  | Environmental screener |  | Document extractor      |  |
                 |  | - Deforestation check  |  | - AI / Heuristic parser |  |
                 |  | - Data provenance tags |  | - Human confirmation UI |  |
                 |  +------------------------+  +-------------------------+  |
                 |  +-----------------------------------------------------+  |
                 |  | Evidence Report Generator (JSON & Canonical Hash)   |  |
                 |  +-----------------------------------------------------+  |
                 +--------------+-----------------------------+--------------+
                                |                             |
                 (Local DB / State Engine)        (EVM JSON-RPC / ethers.js)
                                |                             |
                                v                             v
                 +--------------------------+  +-----------------------------+
                 |  Off-Chain Data Store    |  |  On-Chain Invariant Anchor  |
                 |  - Raw GeoJSON polygons  |  |  (Solidity Smart Contract)  |
                 |  - PII & Invoices        |  |  - Canonical Plot Hash      |
                 |  - Review queue logs     |  |  - Season Allowance Ceiling |
                 |  - Evidence snapshots    |  |  - Accumulated Claim Balance|
                 +--------------------------+  +-----------------------------+
```

---

## 4. Engineering & Safety Constraints

- **Privacy Preservation**: Raw GeoJSON coordinates and proprietary commercial invoices are kept off-chain. Only hashes, cryptographic commitments, and necessary claim metadata are submitted to the smart contract.
- **Reproducibility**: Entire test suite must run locally via deterministic commands (`npm test`). No reliance on undocumented remote states.
- **Zero Hallucination / Provenance Tracking**: Every data field in an evidence report carries an explicit provenance tag.

---

## 5. Scope Boundaries & Claims Limitations

- **Prototype Scope**: SilvaPass is an evidence-backed protocol demonstrating verifiable plot identity and double-claim prevention within its participating ecosystem.
- **Explicit Non-Claims**:
  - It does **not** legally guarantee EUDR compliance.
  - It does **not** stop fraudulent claims executed entirely outside of the participating blockchain registry.
  - Baseline allowance values are structured demonstration models or benchmark formulas, not certified agronomical yield guarantees.
