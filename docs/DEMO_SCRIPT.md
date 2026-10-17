# SilvaPass Demonstration Script & Public Release Walkthrough
**IEEE ClimateChain Global Hackathon 2026**

## 1. Hackathon Demonstration Scenario (4-Minute Pitch & Walkthrough)

### [00:00 - 00:30] Introduction & Core Problem
- **On-Screen**: Tab 1 — *Overview & Boundaries* (`http://localhost:5173/`).
- **Narration**:
  > *"Under the European Union Deforestation Regulation (EUDR), operators must prove commodities originate from deforestation-free plots. However, current systems suffer from two fatal vulnerabilities: boundary jitter laundering—where bad actors alter polygon coordinates to register the same land multiple times—and the double-claiming problem—where multiple exporters claim shipments against the same physical harvest. SilvaPass solves both by pairing off-chain geospatial identity resolution with an on-chain shared claim invariant."*
- **Key Visual**: Highlight the system boundaries disclaimer and protocol architecture diagram.

---

### [00:30 - 01:15] Plot Ingestion & Geospatial Near-Duplicate Detection
- **On-Screen**: Tab 2 — *Plot Ingestion & Map*.
- **Action**:
  1. Inspect the registered base plot `PLOT-BASE-DEMO` (~30 hectares in Mato Grosso, Brazil).
  2. Load `DEMO_JITTERED_PLOT` (a coordinate-perturbed version with 3–5m GPS noise).
  3. Click **Validate Geometry**, then **Register Plot**.
- **Narration**:
  > *"Notice how naive exact coordinate hashing fails when vertices are reversed or slightly jittered (only achieving 25% recall in our benchmark). SilvaPass uses topological canonicalization, H3 spatial indexing, and pyproj geodesic measurement. The system immediately flags the perturbed polygon as a candidate duplicate with 99.25% spatial IoU and 1.27m centroid drift, locking it out of allowance creation."*
- **Reference**: Highlight synthetic benchmark evaluation metrics (SilvaPass F1 = 1.000 vs Baseline 1 = 0.400).

---

### [01:15 - 01:45] Ambiguous Overlap & Operator Review Queue
- **On-Screen**: Tab 3 — *Duplicate Review Queue*.
- **Action**:
  1. Show `PLOT-AMB-DEMO` which has a partial 40% boundary overlap.
  2. Point out that rather than blindly auto-merging, SilvaPass places it in `PENDING_REVIEW`.
  3. Review the side-by-side polygon comparison and demonstrate the auditable adjudication by `OP-SUPERVISOR-42`.
- **Narration**:
  > *"Crucially, SilvaPass avoids false positive merges on neighboring farms. When a 40% overlap occurs, the boundary enforcement policy routes it to an operator review queue. An authorized supervisor reviews the cadastral monuments, enters a mandatory auditable justification, and adjudicates the parcel."*

---

### [01:45 - 02:45] On-Chain Shared Claim Invariant & Over-Allocation Rejection
- **On-Screen**: Tab 4 — *Claim Ledger Invariant*.
- **Action**:
  1. Point to the connected live Hardhat EVM node (`Chain ID: 31337, Contract: 0x5FbDB...`).
  2. Review the approved quota of **3,000 kg** for `PLOT-BASE-DEMO`.
  3. Inspect Claim 1 (`CLAIM-BOL-DEMO-01`) for **1,800 kg**: Status `CONFIRMED`, Remaining: **1,200 kg**.
  4. Submit Claim 2 (`CLAIM-BOL-DEMO-02`) for **2,000 kg**: Status `REJECTED_OVER_ALLOCATION`.
  5. Demonstrate that the remaining balance is **strictly preserved at 1,200 kg**. Refresh the browser to prove state persistence.
- **Narration**:
  > *"Here is the core smart contract invariant in action: net claimed mass can never exceed approved allowance. Claim 1 deducts 1,800 kg, leaving exactly 1,200 kg. When a second buyer attempts to claim 2,000 kg, the EVM contract rejects the claim without reverting the transaction, preserving an auditable receipt on-chain while leaving the remaining 1,200 kg balance completely untouched. Double-claiming is physically impossible."*

---

### [02:45 - 03:15] AI-Assisted Document Extraction with Mandatory Human Confirmation
- **On-Screen**: Tab 5 — *Document Extraction*.
- **Action**:
  1. Extract fields from `bol_demo_1800kg.txt`.
  2. Point out the extracted fields (Commodity: `SOY`, Net: `1,800 KG`, Plot: `PLOT-BASE-DEMO`).
  3. Show that the status is held at `PENDING_CONFIRMATION`—the system strictly prohibits an LLM or regex engine from mutating on-chain balances autonomously.
  4. Confirm the document fields as `OP-CUSTOMS-OFFICER-01`.
- **Narration**:
  > *"SilvaPass extracts structured consignment data from raw Bills of Lading and phytosanitary certificates, normalizing metric tons and bags. But by design, AI models never have write access to the ledger. Every extraction requires explicit human officer confirmation."*

---

### [03:15 - 03:45] Environmental Screening & Canonical Evidence Bundle
- **On-Screen**: Tab 6 — *FAO WHISP Screening* & Tab 7 — *Evidence Report*.
- **Action**:
  1. Display the FAO WHISP screening results: `LOW_RISK`, `0 post-cutoff disturbances`, with explicit `CACHED_SNAPSHOT` provenance tag.
  2. Switch to Tab 7 to review the unified Evidence Report.
  3. Show the Root Evidence Bundle Hash: `0x2c0c904fec...` binding geometry, review justification, WHISP indicators, and on-chain receipt.
- **Narration**:
  > *"We integrate with FAO Open Foris WHISP to screen against the December 31, 2020 deforestation cutoff date. Every observation is tagged with honest provenance—we never fabricate live API verification when using cached benchmarks. Finally, all evidence is cryptographically bound into an immutable canonical bundle digest suitable for customs verification."*

---

### [03:45 - 04:00] Conclusion & Project Mission
- **On-Screen**: Final protocol overview.
- **Narration**:
  > *"SilvaPass demonstrates that transparent climate infrastructure does not require speculative tokens or opaque AI agents. With reproducible geospatial mathematics and deterministic smart contract invariants, we deliver verifiable land integrity for global supply chains. Thank you."*

---

## 2. One-Command Clean Demonstration Launch

To start the complete working prototype from scratch:

```bash
# 1. Reset and populate all 10 synthetic demo fixtures
npm run seed:demo:reset

# 2. Run the offline evaluation suite to verify all metrics
npm run evaluate

# 3. Start the three local servers in separate terminals (or background):
# Terminal 1: npm run node:contracts   (Hardhat EVM Node at http://127.0.0.1:8545)
# Terminal 2: npm run start:backend     (FastAPI Backend at http://127.0.0.1:8000)
# Terminal 3: npm run start:frontend    (React Client at http://localhost:5173)
```

---

## 3. Public Testnet vs. Local Network Deployment Status

| Component | Target Network | Current Deployment Status | Obstacle / Configuration Note |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | Localhost (Vite) / Vercel | **Verified Locally** (`http://localhost:5173`) | Public cloud hosting blocked: No cloud credentials (Vercel/Netlify/Fly) configured in environment. Builds cleanly via `npm run build:frontend`. |
| **Backend REST API** | Localhost (Uvicorn) | **Verified Locally** (`http://127.0.0.1:8000`) | Bound to `127.0.0.1:8000` with strict CORS and health checks (`/health`). |
| **Smart Contract** | Hardhat EVM (Local) | **Deployed** (`0x5FbDB2315678afecb367f032d93F642f64180aa3`) | **Public EVM Testnet (e.g. Sepolia) blocked**: No public RPC credentials (Infura/Alchemy) or funded private key configured in environment. Operating in verified local Hardhat EVM mode. |
| **Environmental Screening**| FAO Open Foris WHISP | **Verified Offline** (`CACHED_SNAPSHOT`) | Operating with documented reference snapshot fixtures. Live probe available via `npm run test:whisp:live` when `WHISP_API_KEY` is provided. |

> **Transparency Notice**: *All on-screen transaction receipts, blocks, and addresses in this demonstration are generated against the local Hardhat EVM network (`Chain ID: 31337`). No real mainnet or testnet funds were used.*
