# SilvaPass Architecture Specification

**Document Version:** 1.0.0  
**Technology Stack:** React + TypeScript (Frontend), Python FastAPI (Backend), Shapely + H3 (Geospatial), Solidity + OpenZeppelin (Blockchain), SQLite (Local Persistence).

---

## 1. System Architecture Overview

SilvaPass implements an off-chain/on-chain hybrid architecture. Geospatial validation, deduplication analysis, environmental screening, and document processing execute off-chain where complex computation and private data reside. The blockchain is strictly reserved as an auditable, neutral coordination layer enforcing the production allowance and claim invariant across mutually distrusting supply chain actors.

```mermaid
flowchart TD
    subgraph Client["Frontend Client (React + TypeScript)"]
        UI_Geo[Plot Upload & Map Inspector]
        UI_Review[Ambiguous Review Queue]
        UI_Doc[Shipment Doc Extraction & Confirmation]
        UI_Audit[Evidence Bundle & Report Viewer]
    end

    subgraph Backend["FastAPI Backend Service"]
        API_Router[REST API Router]
        
        subgraph GeoEngine["Geospatial & Identity Engine"]
            Geo_Val[Shapely 2.0 Topology Validator]
            H3_Index[H3 Spatial Candidate Indexer]
            Geo_Sim[IoU & Hausdorff Similarity Engine]
            Review_Mgr[Review Queue Adjudicator]
        end
        
        subgraph EnvEngine["Environmental Screening Engine"]
            WHISP_Adapter[FAO WHISP Client / Adapter]
            WHISP_Snapshots[Snapshot & Simulation Fallback Store]
        end
        
        subgraph DocEngine["Shipment Document Engine"]
            Doc_Parser[AI / Heuristic Parser]
            Doc_Validator[Pydantic Schema Validator]
            Human_Gate[Human Confirmation Gatekeeper]
        end
        
        subgraph EvidenceEngine["Evidence & Proof Generator"]
            Evidence_Builder[Evidence Bundle Builder]
            Hasher[SHA-256 Digest Generator]
        end
        
        subgraph Storage["Persistence Layer"]
            DB[(SQLite Local Database)]
        end
    end

    subgraph Blockchain["On-Chain State Layer (EVM / Hardhat Node)"]
        subgraph SmartContracts["SilvaPassRegistry.sol"]
            Registry_Admin[Role-Based Access Control]
            State_Store[Plot Allowance Storage]
            Invariant_Guard[Atomic Invariant Check]
            Event_Bus[Audit Event Emitter]
        end
    end

    %% Client to Backend
    UI_Geo -->|Submit GeoJSON| API_Router
    UI_Review -->|Adjudicate Review| API_Router
    UI_Doc -->|Upload Doc & Confirm Fields| API_Router
    UI_Audit -->|Fetch Verified Bundle| API_Router

    %% Internal Backend Flows
    API_Router --> Geo_Val
    Geo_Val --> H3_Index
    H3_Index --> Geo_Sim
    Geo_Sim --> Review_Mgr
    Review_Mgr --> DB
    
    API_Router --> WHISP_Adapter
    WHISP_Adapter --> WHISP_Snapshots
    WHISP_Adapter --> DB
    
    API_Router --> Doc_Parser
    Doc_Parser --> Doc_Validator
    Doc_Validator --> Human_Gate
    Human_Gate --> DB

    API_Router --> Evidence_Builder
    Evidence_Builder --> Hasher
    Evidence_Builder --> DB

    %% Backend to Blockchain
    Evidence_Builder -->|Register Allowance / Submit Claim| SmartContracts
    SmartContracts --> Invariant_Guard
    Invariant_Guard --> State_Store
    Invariant_Guard --> Event_Bus
    Event_Bus -.->|Events / Reverts| API_Router
```

---

## 2. Component Specifications & Boundaries

### 2.1 Frontend Client (React + TypeScript)
- **Role**: Presentation and human-in-the-loop interaction layer.
- **Key Modules**:
  - `PlotVisualizer`: Map component (Leaflet) rendering submitted boundaries, neighbor boundaries, and bounding envelopes.
  - `ReviewAdjudicator`: Side-by-side polygon diff viewer showing IoU scores, centroid drift, and input form for required operator justifications.
  - `DocumentConfirmModal`: Two-column display rendering the original document text alongside structured extracted fields, highlighting low-confidence fields for mandatory human review.
  - `EvidenceReportViewer`: Detailed transparency view displaying each evidence claim along with its cryptographic hash and provenance badge (`[MEASURED]`, `[EXTERNAL_VERIFIED]`, etc.).
- **Boundary Rule**: The client never directly calls the Ethereum RPC or signs blockchain transactions; all transactions route through the FastAPI backend gateway to preserve signature auditability and coordinate commitments off-chain.

### 2.2 FastAPI Backend Service (Python 3.9+)
- **Role**: Orchestration, validation, data transformation, and off-chain persistence.
- **Key Modules**:
  - `core/`: Application settings (`pydantic-settings`), custom exception handlers, database session management, structured logging.
  - `geo/`:
    - `validator.py`: Shapely 2.0 topology verification (validity, simple polygon, ring closure, bounds, geodesic area via `pyproj`).
    - `indexer.py`: H3 spatial indexing (`h3-py`). Computes resolution 8 and 10 cells covering the polygon envelope to prune similarity candidates.
    - `matcher.py`: Shapely exact geometric comparisons (IoU calculation, Hausdorff distance, centroid drift, orientation checks).
    - `review.py`: State machine for flagging, holding, and adjudicating ambiguous plots.
  - `environmental/`:
    - `whisp_client.py`: Client for FAO WHISP API (`POST /submit/geojson`, `GET /status/{token}`) with `X-API-KEY`.
    - `fallback_provider.py`: Deterministic snapshot replays and mock fixtures when external network or keys are absent.
  - `documents/`:
    - `extractor.py`: Structured field extraction from raw documents (text or OCR) using schema-enforced prompt contracts or regex fallbacks.
    - `confirmation.py`: Human-in-the-loop workflow requiring operator sign-off before claim issuance.
  - `blockchain/`:
    - `client.py`: Web3.py wrapper interacting with `SilvaPassRegistry.sol` deployed on the local Hardhat node.
  - `evidence/`:
    - `report.py`: Aggregates plot geometry hash, WHISP screening digest, document hash, confirmation log, and on-chain tx receipt into a canonical JSON-LD / JSON schema and computes the root SHA-256 digest.

### 2.3 Off-Chain Persistence (SQLite)
- **Role**: Local fast-query storage for raw GeoJSON geometries, document archives, spatial indexes, operator review logs, and cached screening snapshots.
- **Tables**:
  - `plots`: `id`, `canonical_hash`, `boundary_wkt`, `area_ha`, `h3_res8`, `status`, `created_at`.
  - `spatial_reviews`: `id`, `submitted_plot_id`, `conflicting_plot_id`, `iou`, `hausdorff_m`, `status`, `operator_notes`, `adjudicated_at`.
  - `allowances`: `id`, `plot_id`, `season_id`, `crop_code`, `approved_kg`, `evidence_hash`, `status`.
  - `shipment_documents`: `id`, `file_hash`, `raw_text`, `extracted_json`, `confirmed_json`, `status`, `operator_id`.
  - `claims`: `id`, `claim_id_hex`, `plot_id`, `season_id`, `claimed_kg`, `tx_hash`, `status`, `created_at`.
  - `whisp_screenings`: `id`, `plot_id`, `risk_category`, `provenance`, `raw_response_digest`, `created_at`.

### 2.4 On-Chain Invariant Anchor (`SilvaPassRegistry.sol`)
- **Role**: Canonical, tamper-proof state layer enforcing the shared claim balance across mutually distrusting parties.
- **Contract Framework**: OpenZeppelin Contracts v5.x (`AccessControlUpgradeable` or standard `AccessControl`, `ReentrancyGuard`, `Pausable`).
- **Core State**:
  ```solidity
  struct Allowance {
      bytes32 plotId;
      uint256 seasonId;
      bytes32 cropCode;
      uint256 approvedAllowanceKg;
      uint256 claimedKg;
      bytes32 allowanceEvidenceHash;
      bool isRevoked;
  }
  
  struct Claim {
      bytes32 plotId;
      uint256 seasonId;
      uint256 claimedKg;
      bytes32 shipmentEvidenceHash;
      bool isReleased;
      address claimant;
      uint256 timestamp;
  }
  ```
- **Guaranteed Invariants**:
  1. `claimedKg <= approvedAllowanceKg` at all times.
  2. Double-claim prevention: Any `claimId` used once cannot be re-used.
  3. Atomic reversion on insufficient allowance capacity.
  4. Allowance reduction or revocation cannot retroactively invalidate already accepted claims without explicit administrative release.

---

## 3. Detailed Data Flows & Sequence Diagrams

### 3.1 Plot Registration & Ambiguity Review Flow
```mermaid
sequenceDiagram
    autonumber
    actor Submitter as Producer / Aggregator
    participant API as FastAPI Backend
    participant Geo as Shapely & H3 Engine
    participant DB as SQLite DB
    actor Operator as Adjudication Operator

    Submitter->>API: POST /api/plots/register (GeoJSON, Metadata)
    API->>Geo: Validate Topology & Coordinates
    alt Topology Invalid (Self-intersecting, unclosed)
        Geo-->>API: ValidationError
        API-->>Submitter: 422 Unprocessable Entity (Invalid Topology)
    else Topology Valid
        Geo->>Geo: Compute Canonical Hash, Area, H3 Cells
        Geo->>DB: Query candidate neighbors sharing H3 cells
        DB-->>Geo: Candidate plot records
        Geo->>Geo: Compute IoU & Hausdorff Distance against candidates
        alt IoU >= 0.90 (Duplicate)
            Geo-->>API: MatchFound (Existing Plot ID)
            API-->>Submitter: 409 Conflict (Duplicate Plot Detected)
        else 0.05 <= IoU < 0.90 (Ambiguous Overlap)
            Geo->>DB: Store Plot as PENDING_REVIEW
            Geo->>DB: Create SpatialReview Record
            API-->>Submitter: 202 Accepted (Queued for Review)
            Operator->>API: GET /api/reviews/pending
            API-->>Operator: Review details with visual diff & IoU
            Operator->>API: POST /api/reviews/{id}/adjudicate (Status, Reason)
            API->>DB: Update Plot & Review Status
        else IoU < 0.05 (Distinct)
            Geo->>DB: Store Plot as ACTIVE
            API-->>Submitter: 201 Created (Plot Registered, Plot ID)
        end
    end
```

### 3.2 Shipment Claim Lifecycle & On-Chain Invariant Enforcement
```mermaid
sequenceDiagram
    autonumber
    actor Exporter as Exporter / Logistics
    participant API as FastAPI Backend
    participant Doc as Document Extractor
    actor Operator as Verification Officer
    participant Registry as SilvaPassRegistry.sol
    participant Chain as EVM / Hardhat Node

    Exporter->>API: POST /api/documents/upload (PDF / Image)
    API->>Doc: Extract Fields (Bill of Lading, Weight, Plot ID)
    Doc-->>API: Extracted JSON (Status: PENDING_CONFIRMATION)
    API-->>Exporter: Return Document ID & Extracted Data
    
    Operator->>API: POST /api/documents/{id}/confirm (Confirmed Data)
    API->>API: Generate Canonical Shipment Evidence Bundle
    API->>API: Compute SHA-256 shipmentEvidenceHash
    
    API->>Registry: claimShipment(claimId, plotId, seasonId, claimedKg, evidenceHash)
    Registry->>Registry: Check: claimId not previously registered
    Registry->>Registry: Check: allowance exists and is not revoked
    Registry->>Registry: Check: claimedKg + currentClaimed <= approvedAllowanceKg
    
    alt Over-Allocation (claimedKg exceeds remaining)
        Registry-->>API: Revert: AllowanceExceeded(remaining, requested)
        API-->>Exporter: 400 Bad Request (Allowance Exceeded, 0 balance change)
    else Capacity Available
        Registry->>Registry: currentClaimed += claimedKg
        Registry->>Registry: Store Claim Record
        Registry->>Chain: Emit ShipmentClaimAccepted(claimId, plotId, seasonId, claimedKg)
        Registry-->>API: Transaction Receipt (Block Number, Tx Hash)
        API->>API: Save Claim in SQLite
        API-->>Exporter: 200 OK (Claim Accepted with Tx Hash & Evidence Receipt)
    end
```

---

## 4. API Contracts (FastAPI REST Specification)

### 4.1 Plot Endpoints
- `POST /api/plots/validate`:
  - Request: `{ "geojson": { "type": "Feature", "geometry": ... }, "crs": "EPSG:4326" }`
  - Response: `{ "is_valid": true, "area_ha": 14.25, "perimeter_m": 1640.2, "errors": [] }`
- `POST /api/plots/register`:
  - Request: `{ "geojson": ..., "country_code": "BR", "crop_type": "SOY" }`
  - Response: `{ "plot_id": "uuid", "canonical_hash": "0x...", "status": "ACTIVE" | "PENDING_REVIEW" }`
- `GET /api/plots/{plot_id}`:
  - Returns complete plot metadata, canonical hash, and associated allowance status.

### 4.2 Spatial Review Endpoints
- `GET /api/reviews/pending`:
  - Returns list of open spatial conflicts requiring human adjudication.
- `POST /api/reviews/{review_id}/adjudicate`:
  - Request: `{ "action": "CONFIRM_DUPLICATE" | "APPROVE_SEPARATE_PARCEL", "justification": "Operator inspected survey marker..." }`
  - Response: `{ "review_id": "uuid", "status": "ADJUDICATED", "timestamp": "..." }`

### 4.3 Allowance & On-Chain Endpoints
- `POST /api/allowances/grant`:
  - Request: `{ "plot_id": "uuid", "season_id": 2026, "crop_code": "COFFEE", "approved_kg": 50000, "evidence_document_hash": "0x..." }`
  - Response: `{ "allowance_id": "uuid", "tx_hash": "0x...", "status": "CONFIRMED_ON_CHAIN" }`
- `POST /api/claims/submit`:
  - Request: `{ "document_id": "uuid", "plot_id": "uuid", "season_id": 2026, "claimed_kg": 12500 }`
  - Response: `{ "claim_id": "0x...", "status": "ACCEPTED", "remaining_capacity_kg": 37500, "tx_hash": "0x..." }`
- `POST /api/claims/{claim_id}/release`:
  - Request: `{ "reason": "Shipment cancelled at port of departure" }`
  - Response: `{ "claim_id": "0x...", "status": "RELEASED", "restored_kg": 12500, "tx_hash": "0x..." }`

### 4.4 Environmental Screening Endpoints (FAO WHISP)
- `POST /api/screening/whisp`:
  - Request: `{ "plot_id": "uuid", "mode": "LIVE" | "SNAPSHOT" | "SIMULATION" }`
  - Response:
    ```json
    {
      "screening_id": "uuid",
      "plot_id": "uuid",
      "risk_category": "LOW_RISK",
      "cutoff_date": "2020-12-31",
      "convergence_summary": {
        "forest_overlap_pct": 0.0,
        "post_cutoff_disturbances": 0,
        "commodity_detected": true
      },
      "provenance": "EXTERNAL_VERIFIED",
      "source_digest": "sha256:...",
      "timestamp": "2026-10-16T23:00:00Z"
    }
    ```

---

## 5. Justification of Blockchain vs. Conventional Database

SilvaPass explicitly documents why blockchain is used and where a conventional database would be preferable:

| Criterion | Conventional Database (PostgreSQL / SQLite) | Distributed Ledger / Smart Contract (EVM) | SilvaPass Design Decision |
| :--- | :--- | :--- | :--- |
| **Trust Model** | Requires trusting a single central server operator or hosting provider. | Neutral, shared state machine enforced by math & consensus among distrusting peers. | **Blockchain used for Claim Invariant**: Multiple independent buyers, shippers, and customs brokers cannot trust an exporter's private database not to manipulate allowances. |
| **Data Privacy** | Trivial to restrict table access, encrypt at rest, and protect farmer PII. | Public ledger reveals all state and transaction inputs to all node observers. | **Database used for GeoJSON & PII**: Raw polygon boundaries, farmer identities, and private invoices remain in SQLite / local storage. |
| **Throughput & Latency** | Tens of thousands of transactions/second with sub-millisecond latency. | Bound by block generation times and network gas fees. | **Database for spatial indexing & deduplication**: Shapely and H3 spatial matching execute off-chain in microseconds. |
| **Immutability & Audit** | Logs can be rewritten by database superusers without external trace. | Cryptographic append-only history with deterministic reverts on invariant violations. | **Blockchain for Allowance Ledger**: Absolute mathematical guarantee that $Claimed \le Approved$. |

**Conclusion**: When all participants belong to a single trusted corporation, a conventional PostgreSQL database with row-level security is preferable and superior. In multi-stakeholder cross-border agricultural supply chains where aggregators have economic incentives to double-sell the same harvest across disparate buyers, an on-chain smart contract provides an indispensable tamper-proof coordination anchor.
