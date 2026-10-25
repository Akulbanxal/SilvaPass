# SilvaPass

**Evidence-Backed Plot-Identity and Shipment-Integrity Protocol**  
*Built for the IEEE ClimateChain Global Hackathon 2026*

SilvaPass combines robust off-chain geospatial plot identity resolution (detecting coordinate laundering, polygon jitter, and duplicate plots) with an enforceable on-chain shared claim invariant (preventing over-allocation and double-claiming on EVM-compatible smart contracts).

---

## 1. Architecture & Repository Structure

```
silvapass/
  frontend/          # React + TypeScript + Vite web client
  backend/           # Python + FastAPI backend service (Shapely, H3, Pydantic)
  contracts/         # Solidity smart contracts & Hardhat 2 test harness
  data/demo/         # Synthetic benchmark geometries & reference snapshots
  docs/              # Formal engineering specifications & ADRs
    REQUIREMENTS.md
    ARCHITECTURE.md
    THREAT_MODEL.md
    ACCEPTANCE_TESTS.md
    DECISIONS.md
    PROJECT_BRIEF.md
    IMPLEMENTATION_PLAN.md
  scripts/           # Local development automation
  .github/workflows/ # GitHub Actions CI automation
  CLAUDE.md          # Engineering standards, workflow & mandatory constraints
  .env.example       # Example configuration template
  package.json       # Root developer command interface
```

---

## 2. Prerequisites

- **Node.js**: `v20+` or `v22+` (tested on Node.js 22.23.1).
- **npm**: `v10+` (tested on npm 10.9.8).
- **Python**: `3.9+` (tested on Python 3.9.6).
- **Git**: Installed.
- **Docker**: *Not required.*
- **Bun**: *Not supported (use npm).*

---

## 3. Quickstart & Clean Checkout Setup

### Step 1: Clone and Configure Environment
```bash
git clone <repository_url> silvapass
cd silvapass

# Copy environment template
cp .env.example .env
```

### Step 2: Set Up Python Backend Virtual Environment
```bash
# Create local virtual environment
python3 -m venv .venv

# Activate virtual environment
# On macOS / Linux:
source .venv/bin/activate
# On Windows (cmd/PowerShell):
# .venv\Scripts\activate

# Upgrade pip and install pinned backend dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Step 3: Install Smart Contract Dependencies
```bash
cd contracts
npm install
cd ..
```

### Step 4: Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

---

## 4. Running Automated Tests & Verification

From the repository root, you can run all automated checks:

```bash
# Run all test suites (contracts, backend, frontend)
npm test

# Or run individually:
npm run test:contracts   # Compiles and runs Hardhat tests
npm run test:backend     # Runs pytest on FastAPI backend
npm run test:frontend    # Runs Vitest on React frontend
npm run lint:frontend    # Lints frontend code
npm run build:frontend   # Validates production TypeScript build
npm run evaluate         # Executes reproducible 4-part evaluation suite (Outputs evaluation_results.json)
npm run test:whisp:live  # Live FAO WHISP connectivity probe (requires network access)
```

---

## 5. Offline Reproducible Evaluation Suite

SilvaPass features a unified 4-part evaluation and regression harness:
```bash
npm run evaluate
```
This produces:
- Machine-readable JSON metrics: `evaluation_results.json`
- Full methodology and limitation analysis: [`docs/EVALUATION_METHODOLOGY.md`](docs/EVALUATION_METHODOLOGY.md)

### Tracks Evaluated:
1. **Evaluation A (Plot Identity Resolution)**: Benchmarks SilvaPass spatial deduplication engine against exact hashing and centroid-distance baselines over 15 labeled synthetic test geometries (shifts, rotations, jitter, vertex decimation). *Clearly labeled as synthetic benchmark performance.*
2. **Evaluation B (Contract Invariants)**: Formally verifies mass-balance bounds ($\text{netClaimed} \le \text{approved}$), duplicate claim rejection, balance-preserving over-allocation rejection, and 30-round randomized property test.
3. **Evaluation C (Document Extraction)**: Evaluates field extraction accuracy, unit conversion (MT, bags), missing plot detection, and prompt injection defense on the deterministic fallback provider.
4. **Evaluation D (Fault Handling)**: Tests external API timeouts, HTTP 502 malformed responses, rate limits, contract boundary violations, and idempotent claim submissions.

---

## 6. Running the Application Locally (No Docker Required)

### Terminal 1: Smart Contract Node (Hardhat EVM)
```bash
npm run node:contracts
# Starts local JSON-RPC at http://127.0.0.1:8545
```

### Terminal 2: Backend API Service (FastAPI)
```bash
npm run start:backend
# Starts REST API at http://127.0.0.1:8000
# OpenAPI Swagger docs available at http://127.0.0.1:8000/docs
```

### Terminal 3: Frontend Client (Vite Dev Server)
```bash
npm run start:frontend
# Starts client at http://localhost:5173
```

Navigate to `http://localhost:5173` to interact with the full protocol interface.

---

## 7. Cloud Deployment (Vercel, Netlify, Render, Railway)

SilvaPass includes out-of-the-box configuration manifests for instant cloud hosting:
- **Frontend (Vercel / Netlify)**: Pre-configured SPA routing via [`vercel.json`](vercel.json) and [`netlify.toml`](netlify.toml).
- **Backend (Render / Railway)**: Pre-configured Python service via [`render.yaml`](render.yaml), [`railway.toml`](railway.toml), and [`Procfile`](Procfile).

For the full step-by-step setup walkthrough and environment variables reference, see **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**.

---

## 8. FAO Open Foris WHISP Integration & Provenance

SilvaPass integrates with **FAO Open Foris WHISP** (*"What is in that plot?"*) to perform multi-map convergence-of-evidence deforestation risk screenings relative to the December 31, 2020 cutoff date.

### Authentication & Configuration:
1. Register for an account at [https://whisp.openforis.org](https://whisp.openforis.org).
2. Generate an API token from your profile.
3. Configure `WHISP_API_KEY` in your `.env` file:
   ```bash
   WHISP_MODE=SNAPSHOT     # Options: SNAPSHOT, LIVE, SIMULATION
   WHISP_API_URL=https://whisp.openforis.org/api
   WHISP_API_KEY=your_api_token_here
   ```
4. Never expose `WHISP_API_KEY` to the browser or commit it to Git.

### Provenance Distinction:
- `EXTERNAL_VERIFIED`: Directly returned by live FAO WHISP API (`POST /api/submit/geojson`) with authenticated API key.
- `CACHED_SNAPSHOT`: Documented, immutable reference benchmark snapshot (e.g. Mato Grosso Soy baseline).
- `SIMULATED`: Explicitly synthetic rule calculation for offline pipeline verification.
- `UNRESOLVED_UNCERTAINTY`: Emitted on rate-limiting (HTTP 429), timeouts, invalid geometry, or missing credentials.

### Testing Live Connectivity:
```bash
npm run test:whisp:live
```
The standard test suite (`npm test`) remains completely offline and deterministic, using snapshots and simulations.

---

## 8. Smart Contract Boundaries & Non-Protected Areas

The `SilvaPassRegistry.sol` smart contract enforces strict on-chain mass balance bounds, but operating organizations must be aware of technical boundaries:
- **What IS Enforced On-Chain**:
  - Non-negative remaining capacity ($\text{remaining} \ge 0$).
  - Claim mass cannot exceed approved allowance ($\text{netClaimed} \le \text{approvedAllowanceKg}$).
  - Claim idempotency: duplicate claim IDs revert without deducting capacity twice.
  - Non-mutating rejections: over-allocation claims emit audit events while preserving storage state.
  - Role-based separation between registrars, exporters, and operators.
- **What is NOT Protected By the Contract**:
  - **Off-chain cadastral authenticity**: The contract cannot verify whether a physical plot boundary submitted by a compromised registrar corresponds to genuine land title; this depends on cadastral authorities.
  - **External physical commodity substitution**: The contract proves allocation caps within participating registries; physical grain blending or off-system laundering requires physical chain-of-custody tracking.
  - **Role Misconfiguration**: If admin roles grant `REGISTRAR_ROLE` to an untrusted address, excessive allowances could be created on-chain. Multisig or governance controls are required for production deployments.

---

## 9. Troubleshooting & Incident-Free Clean Install

### Issue 1: `ModuleNotFoundError: No module named 'backend'`
- **Cause**: Python path does not include the workspace root.
- **Fix**: Always run tests and scripts with `PYTHONPATH=.` set, or use the root npm runner: `npm run test:backend`.

### Issue 2: `LibreSSL` Warning with `urllib3`
- **Notice**: macOS default Python may display `NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+`. This is an informational warning and does not impair test or cryptographic execution.

### Issue 3: Hardhat Node Port Conflict
- **Cause**: An existing service is bound to port 8545.
- **Fix**: Identify and kill the hanging process: `lsof -i :8545` followed by `kill -9 <PID>`.

---

## 10. Secrets & Environment Configuration Policy

- Real credentials, private keys, and API tokens **MUST NEVER** be committed to version control.
- All secrets are loaded through environment variables defined in `.env` (managed via `.gitignore`).
- The `REGISTRAR_PRIVATE_KEY` present in `.env.example` is the standard Hardhat Account #0 key intended **strictly for local development and automated testing**. Never use this key with real mainnet or testnet assets.


