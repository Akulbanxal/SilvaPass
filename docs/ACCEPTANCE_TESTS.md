# SilvaPass Acceptance Tests & Spatial Benchmark Plan

**Document Version:** 1.0.0  
**Scope:** Test Harness, Benchmark Methodologies, Precision/Recall Metrics, and Automated Test Suites.

---

## 1. Spatial Identity Resolution Benchmark & Evaluation Methodology

### 1.1 The Inadequacy of Exact Hash Matching
Traditional database systems attempt plot deduplication by hashing raw coordinate arrays:
$$\text{HashMatch}(P_1, P_2) = \begin{cases} 1 & \text{if } \text{SHA256}(\text{coords}(P_1)) == \text{SHA256}(\text{coords}(P_2)) \\ 0 & \text{otherwise} \end{cases}$$

**Why this fails**:
- Adding a single extra vertex on a straight fence line changes the hash.
- Jittering a coordinate by 1 meter (0.000009 degrees GPS drift) changes the hash.
- Reversing vertex winding (clockwise vs counter-clockwise) changes the hash.
- Changing floating-point precision formatting changes the hash.

**Consequence**: An exact-hash deduplicator achieves **0% recall** against coordinate laundering and GPS noise.

### 1.2 Evaluation Metrics
We evaluate the SilvaPass spatial matching engine across four standard classification metrics:
$$\text{Recall} = \frac{TP}{TP + FN} \quad (\text{fraction of actual duplicates successfully caught})$$
$$\text{Precision} = \frac{TP}{TP + FP} \quad (\text{fraction of flagged duplicates that are genuine duplicates})$$
$$\text{False Positive Rate (FPR)} = \frac{FP}{FP + TN} \quad (\text{distinct adjacent plots incorrectly blocked as duplicates})$$
$$\text{F1-Score} = 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$

Where:
- **True Positive (TP)**: Jittered/perturbed versions of registered plots correctly identified as duplicates or flagged for review.
- **False Negative (FN)**: Altered duplicate plots incorrectly accepted as new distinct plots (laundering success).
- **False Positive (FP)**: Legitimate adjacent neighboring parcels incorrectly marked as duplicates.
- **True Negative (TN)**: Distinct neighboring plots correctly recognized as distinct.

### 1.3 Benchmark Test Dataset & Target Criteria
The test suite generates a synthetic benchmark corpus of 100 base agricultural polygons and applies standard perturbation profiles:
1. **GPS Jitter**: Gaussian noise on vertices ($\sigma = 2\text{m}, 5\text{m}, 10\text{m}$).
2. **Vertex Decimation / Simplification**: Douglas-Peucker simplification ($\epsilon = 0.0001$).
3. **Vertex Densification**: Inserting intermediate collinear vertices.
4. **Affine Shift & Slight Rotation**: Small centroid translations ($< 15\text{m}$) and rotations ($< 3^\circ$).
5. **Legitimate Adjacent Boundaries**: Shared straight boundaries and small sliver overlaps ($< 2\%$).

**Benchmark Target Acceptance Thresholds**:
- Exact Geometry Hash: Recall $\le 5\%$ (Baseline failure).
- **SilvaPass Spatial Engine Target**:
  - **Recall**: $\ge 98.0\%$ (Catches virtually all perturbed duplicates).
  - **Precision**: $\ge 95.0\%$ (Minimal false alarms on separate parcels).
  - **False Positive Rate**: $\le 2.0\%$ on clean adjacent farms.
  - **Zero Unreviewed Merges**: 100% of ambiguous overlaps ($0.05 \le \text{IoU} < 0.90$) held in review queue.

---

## 2. Automated Test Suites Specification

### 2.1 Suite 1: Geospatial Topology & Validation (`test_geo_validation.py`)
- `test_valid_polygon_ingestion`: Clean 4-point and complex multi-vertex polygons pass validation with accurate geodesic area.
- `test_reject_unclosed_ring`: GeoJSON ring whose first and last points differ is rejected with 422 error.
- `test_reject_self_intersecting_polygon`: "Figure 8" / bow-tie geometry is rejected via `is_valid` check.
- `test_reject_out_of_bounds_coordinates`: Latitudes $> 90$ or $<-90$, Longitudes $> 180$ or $<-180$ are rejected.
- `test_reject_degenerate_area`: Zero-area lines or points disguised as polygons are rejected.
- `test_winding_order_normalization`: Inverted winding order is normalized without altering geometry.

### 2.2 Suite 2: Spatial Identity Resolution & Deduplication (`test_geo_dedup.py`)
- `test_identical_polygon_match`: Exact copy returns `MATCH_IDENTICAL` ($\text{IoU} = 1.0$).
- `test_jittered_polygon_match`: Vertices jittered by 5m Gaussian noise return `MATCH_IDENTICAL` ($\text{IoU} > 0.90$).
- `test_simplified_polygon_match`: 20% vertex reduction still returns `MATCH_IDENTICAL`.
- `test_ambiguous_partial_overlap_queued`: Polygons overlapping by 40% return `AMBIGUOUS_OVERLAP` and generate a `SpatialReview` record.
- `test_distinct_adjacent_plots_accepted`: Neighboring plots sharing a fence line return `DISTINCT` ($\text{IoU} < 0.02$) and register cleanly.
- `test_review_queue_adjudication_lifecycle`:
  1. Flagged plot cannot receive an allowance while in `PENDING_REVIEW`.
  2. Operator adjudicates `CONFIRMED_DUPLICATE` $\implies$ Plot marked `FLAGGED_DUPLICATE`.
  3. Separate test: Operator adjudicates `APPROVED_SEPARATE_PARCEL` with valid reason $\implies$ Plot marked `ACTIVE`.

### 2.3 Suite 3: Solidity Smart Contract Invariant Suite (`SilvaPassRegistry.test.ts`)
- `test_register_allowance_success`: Authorized registrar registers plot allowance; state reflects approved capacity.
- `test_register_allowance_unauthorized_reverts`: Non-registrar caller reverts with `Unauthorized`.
- `test_duplicate_allowance_registration_reverts`: Registering same plot and season twice reverts with `AlreadyRegistered`.
- `test_claim_shipment_success`: Valid claim decrements remaining allowance; emits `ShipmentClaimAccepted`.
- `test_claim_exact_allowance_limit`: Claiming exactly the remaining capacity succeeds, leaving 0 remaining.
- `test_over_allocation_atomic_revert`: Claiming 1 unit above remaining capacity reverts with `AllowanceExceeded`; verifies remaining capacity is uncorrupted.
- `test_duplicate_claim_id_reverts`: Submitting a claim with an already used `claimId` reverts with `ClaimAlreadyExists`.
- `test_legitimate_claim_release`: Releasing an accepted claim restores allowance capacity and marks claim `isReleased = true`.
- `test_double_release_reverts`: Releasing an already released claim reverts with `ClaimAlreadyReleased`.
- `test_revoke_allowance`: Authorized registrar revokes allowance; subsequent claims revert with `AllowanceRevoked`.

### 2.4 Suite 4: Environmental Screening & Provenance (`test_environmental_whisp.py`)
- `test_whisp_live_query_success`: Live API call (when mock key provided) returns `LOW_RISK` and tags `EXTERNAL_VERIFIED`.
- `test_whisp_cached_snapshot_fallback`: When offline, loads pinned reference snapshot with matching SHA-256 digest and tags `CACHED_SNAPSHOT`.
- `test_whisp_simulation_fixture`: Synthetic test fixture returns simulated disturbance and tags `SIMULATED`.
- `test_whisp_api_failure_handling`: 500 error or timeout from WHISP returns transparent fallback tagged `UNRESOLVED_UNCERTAINTY`; never fakes success.

### 2.5 Suite 5: Document Extraction & Human-in-the-Loop (`test_document_confirmation.py`)
- `test_document_field_extraction`: Schema validation extracts bill of lading, net mass, and plot ID reference.
- `test_unconfirmed_document_cannot_claim`: Attempting to submit a claim on a document in `PENDING_CONFIRMATION` is rejected.
- `test_operator_confirmation_audit_trail`: Operator modifies extracted weight (correcting OCR error); audit log captures original value, corrected value, and operator ID.
- `test_confirmed_claim_submission`: Confirmed document successfully generates valid shipment claim evidence hash.

### 2.6 Suite 6: End-to-End System Integration Flow (`test_e2e_lifecycle.py`)
1. Ingest Base Plot A (Valid GeoJSON).
2. Register Base Plot A $\implies$ Status: `ACTIVE`.
3. Submit Jittered Plot A' $\implies$ Evaluated as Duplicate $\implies$ Rejected.
4. Submit Overlapping Plot B (50% IoU) $\implies$ Status: `PENDING_REVIEW`.
5. Verify Plot B cannot receive production allowance.
6. Adjudicate Plot B as separate parcel with required justification $\implies$ Status: `ACTIVE`.
7. Grant 20,000 kg allowance to Plot A on-chain.
8. Upload and extract shipment invoice (12,000 kg).
9. Confirm shipment fields with operator sign-off.
10. Submit on-chain claim for 12,000 kg $\implies$ Remaining capacity: 8,000 kg.
11. Submit second on-chain claim for 10,000 kg $\implies$ Reverts with `AllowanceExceeded(8000, 10000)`. Balance remains 8,000 kg.
12. Generate and export Canonical Evidence Report $\implies$ Verified digest matches on-chain committed evidence hash.
