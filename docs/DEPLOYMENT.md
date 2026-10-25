# SilvaPass Cloud Deployment Guide
**Production Hosting for Frontend (Vercel / Netlify) and Backend (Render / Railway)**

SilvaPass is architected for clean separation of concerns, enabling the web client to be hosted on serverless global edge CDNs (Vercel or Netlify) while the FastAPI backend service runs on containerized cloud infrastructure (Render or Railway).

---

## 1. Quick Reference & Configuration Files

The repository is pre-configured with native deployment manifests:

| Target Platform | Component | Configuration File | Root & Subfolder Support |
| :--- | :--- | :--- | :--- |
| **Vercel** | Frontend Client | [`vercel.json`](../vercel.json) & [`frontend/vercel.json`](../frontend/vercel.json) | Supported (SPA rewrites + assets cache) |
| **Netlify** | Frontend Client | [`netlify.toml`](../netlify.toml) & [`frontend/netlify.toml`](../frontend/netlify.toml) | Supported (build hooks + redirects) |
| **Render** | Backend Service | [`render.yaml`](../render.yaml) | Supported (Infrastructure Blueprint) |
| **Railway** | Backend Service | [`railway.toml`](../railway.toml) & [`Procfile`](../Procfile) | Supported (Nixpacks build + uvicorn) |

---

## 2. Deploying the Backend

### Option A: Render (Recommended for FastAPI)

#### Method 1: Using Render Blueprint (Fastest)
1. Push your repository to GitHub or GitLab.
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New** -> **Blueprint**.
4. Connect your SilvaPass repository.
5. Render will detect [`render.yaml`](../render.yaml) and automatically configure the `silvapass-backend` web service.
6. (Optional) In the Render service dashboard under **Environment Variables**, add any proprietary keys:
   - `WHISP_API_KEY` (if `WHISP_MODE=LIVE`)
   - `OPENAI_API_KEY` (if `EXTRACTION_MODE=LIVE`)
7. Click **Apply**. Once built, copy your backend service URL (e.g., `https://silvapass-backend.onrender.com`).

#### Method 2: Manual Web Service on Render
If configuring manually:
- **Environment**: Python
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/health`

---

### Option B: Railway

1. Log into [Railway Dashboard](https://railway.com).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your SilvaPass repository.
4. Railway will automatically detect [`railway.toml`](../railway.toml) and [`Procfile`](../Procfile).
5. In **Settings** -> **Networking**, click **Generate Domain** to get a public HTTPS URL (e.g., `https://silvapass-production.up.railway.app`).
6. In **Variables**, add the required environment variables (see Section 4 below).

---

## 3. Deploying the Frontend

### Option A: Vercel (Recommended for Vite + React)

1. Log into [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your SilvaPass Git repository.
4. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Leave as `./` (or select `frontend` if deploying frontend alone)
   - **Build Command**: `npm run build:frontend` (or `npm run build` if root is `frontend`)
   - **Output Directory**: `frontend/dist` (or `dist` if root is `frontend`)
5. In **Environment Variables**, add:
   ```env
   VITE_BACKEND_API_URL=https://your-backend-service.onrender.com
   ```
   *(Replace with your actual deployed backend URL without trailing slash)*
6. Click **Deploy**. Vercel will build and serve your site with instantaneous global CDN distribution.

---

### Option B: Netlify

1. Log into [Netlify Dashboard](https://app.netlify.com).
2. Click **Add new site** -> **Import an existing project**.
3. Connect your repository.
4. Netlify will detect [`netlify.toml`](../netlify.toml):
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. In **Site configuration** -> **Environment variables**, add:
   ```env
   VITE_BACKEND_API_URL=https://your-backend-service.onrender.com
   ```
6. Click **Deploy Site**.

---

## 4. Environment Variables Reference Table

### Backend Environment Variables (`backend/config.py`)

| Variable | Default Value | Cloud Recommended | Description |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | `production` | Enables production security policies |
| `LOG_LEVEL` | `INFO` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `BACKEND_HOST` | `127.0.0.1` | `0.0.0.0` | Host interface (Render/Railway use `PORT` and `0.0.0.0`) |
| `ALLOWED_ORIGINS` | `http://localhost:5173,...` | `*` or `https://silvapass.vercel.app` | Comma-separated CORS origins (or `*`) |
| `DATABASE_URL` | `sqlite:///./silvapass.db` | `sqlite:///./silvapass.db` | SQLite URI (auto-seeds demo scenario if empty) |
| `WHISP_MODE` | `SNAPSHOT` | `SNAPSHOT` or `LIVE` | `LIVE` requires `WHISP_API_KEY` |
| `WHISP_API_KEY` | `""` | `[SECRET]` | FAO Open Foris token (never commit to git) |
| `EXTRACTION_MODE` | `MOCK` | `MOCK` or `LIVE` | `LIVE` uses OpenAI `gpt-4o-mini` |
| `OPENAI_API_KEY` | `""` | `[SECRET]` | OpenAI API key (sanitized in all logs) |
| `EVM_RPC_URL` | `http://127.0.0.1:8545` | Public EVM RPC URL | Target blockchain JSON-RPC endpoint |
| `SILVAPASS_REGISTRY_ADDRESS` | `""` | `0x...` | Deployed `SilvaPassRegistry.sol` contract address |

### Frontend Environment Variables (`frontend/.env`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_BACKEND_API_URL` | Deployed backend REST API base URL | `https://silvapass-backend.onrender.com` |

---

## 5. Automated Data Initialization on First Boot

When deployed to a cloud container (Render or Railway) where `silvapass.db` does not yet exist:
1. The backend automatically initializes all required tables via [`DatabaseManager`](../backend/storage/database_manager.py).
2. The `lifespan` handler detects the clean database and executes [`seed_demo_environment()`](../scripts/seed_demo_scenario.py).
3. The instance is immediately pre-populated with:
   - Base reference plot (`PLOT-BASE-DEMO` in Mato Grosso, Brazil)
   - Candidate duplicate plot (`PLOT-DUP-DEMO` demonstrating 99.25% spatial IoU)
   - Adjudicated parcel (`PLOT-AMB-DEMO`)
   - On-chain allowance (3,000 kg approved)
   - Confirmed shipment claim (1,800 kg) & preserved over-allocation rejection (2,000 kg)
   - FAO WHISP environmental screening Low Risk snapshot
   - Extracted Bill of Lading evidence bundle

---

## 6. Post-Deployment Verification

Once deployed, verify the deployment:

```bash
# 1. Verify backend health
curl -s https://your-backend.onrender.com/health | jq .

# 2. Verify backend ping
curl -s https://your-backend.onrender.com/api/v1/ping | jq .

# 3. Verify CORS pre-flight for frontend domain
curl -I -X OPTIONS https://your-backend.onrender.com/api/v1/plots \
  -H "Origin: https://your-frontend.vercel.app" \
  -H "Access-Control-Request-Method: GET"
```

Navigate to your frontend URL (`https://your-frontend.vercel.app`) in your browser to interact with the full protocol console.
