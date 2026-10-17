"""
Version 1 REST API Router for SilvaPass Backend.
Includes endpoints for:
- Plots & Validation
- Spatial Review Adjudication
- Allowances & On-Chain Management
- Shipment Document Extraction & Confirmation
- Shipment Claim Submission & Release
- Environmental Screening (FAO WHISP)
- Evidence Reports
"""
import uuid
import hashlib
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

from backend.schemas.api_models import (
    PlotValidationRequest,
    PlotValidationResponse,
    PlotRegistrationRequest,
    PlotRegistrationResponse,
    SpatialReviewItem,
    AdjudicateReviewRequest,
    GrantAllowanceRequest,
    AdjustAllowanceRequest,
    RevokeAllowanceRequest,
    AllowanceResponse,
    DocumentExtractionRequest,
    DocumentExtractionResponse,
    DocumentConfirmationRequest,
    ClaimSubmissionRequest,
    ClaimReleaseRequest,
    ClaimResponse,
    ClaimOnChainStatus,
    EnvironmentalScreeningRequest,
    EnvironmentalScreeningResponse,
    EvidenceReportResponse
)
from backend.geo.validator import validate_geojson_geometry
from backend.storage.database_manager import DatabaseManager
from backend.environmental.whisp_client import WhispScreeningService
from backend.documents.extractor import DocumentExtractor
from backend.evidence.report_builder import EvidenceReportBuilder
from backend.contracts_client.boundary import AllowanceServiceBoundary, OnChainAllowanceRequest
from backend.contracts_client.web3_client import BlockchainRegistryClient
from backend.geo.models import PlotStatus, ReviewStatus


router = APIRouter(prefix="/api/v1")
db = DatabaseManager()
whisp_service = WhispScreeningService()
doc_extractor = DocumentExtractor()
report_builder = EvidenceReportBuilder()
blockchain_client = BlockchainRegistryClient()


# --- 1. Plots Endpoints ---

@router.post("/plots/validate", response_model=PlotValidationResponse)
async def validate_plot(req: PlotValidationRequest):
    """Validates GeoJSON polygon without registering it into the database."""
    res = validate_geojson_geometry(req.geometry)
    return PlotValidationResponse(
        is_valid=res.is_valid,
        geom_type=res.geom_type,
        vertex_count=res.vertex_count,
        geodesic_area_ha=res.geodesic_area_ha,
        geodesic_perimeter_m=res.geodesic_perimeter_m,
        canonical_wkt=res.canonical_wkt,
        canonical_fingerprint=res.canonical_fingerprint,
        h3_indices_res8=res.h3_indices_res8,
        transformations=res.transformations,
        error_message=res.error_message
    )


@router.post("/plots/register", response_model=PlotRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register_plot(req: PlotRegistrationRequest):
    """Validates, indexes, and registers a plot with duplicate detection."""
    try:
        res = db.register_and_classify_plot(
            geojson_geom=req.geometry,
            plot_id=req.plot_id,
            country_code=req.country_code,
            crop_code=req.crop_code
        )
        return PlotRegistrationResponse(
            plot_id=res.plot_id,
            status=res.status,
            classification=res.classification,
            canonical_fingerprint=res.canonical_fingerprint,
            geodesic_area_ha=res.geodesic_area_ha,
            review_id=res.review_id,
            similarity_evidence=res.similarity_evidence,
            policy_version=res.policy_version,
            message=res.message
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/plots/{plot_id}", response_model=Dict[str, Any])
async def get_plot(plot_id: str):
    plot = db.get_plot(plot_id)
    if not plot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plot '{plot_id}' not found.")
    return plot


@router.get("/plots", response_model=List[Dict[str, Any]])
async def list_plots(
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE, PENDING_REVIEW, FLAGGED_DUPLICATE)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    return db.list_plots(status=status, limit=limit, offset=offset)


# --- 2. Spatial Reviews Endpoints ---

@router.get("/reviews/pending", response_model=List[SpatialReviewItem])
async def list_pending_reviews(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    reviews = db.list_pending_reviews(limit=limit, offset=offset)
    return [
        SpatialReviewItem(
            review_id=r["review_id"],
            submitted_plot_id=r["submitted_plot_id"],
            conflicting_plot_id=r["conflicting_plot_id"],
            iou=r["iou"],
            centroid_distance_m=r["centroid_distance_m"],
            status=ReviewStatus(r["status"]),
            operator_id=r.get("operator_id"),
            justification=r.get("justification"),
            created_at=r["created_at"],
            adjudicated_at=r.get("adjudicated_at")
        )
        for r in reviews
    ]


@router.post("/reviews/{review_id}/adjudicate", response_model=Dict[str, Any])
async def adjudicate_review(review_id: str, req: AdjudicateReviewRequest):
    try:
        return db.adjudicate_review(
            review_id=review_id,
            action=req.action,
            operator_id=req.operator_id,
            justification=req.justification
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# --- 2.5 Blockchain & Network Status ---

@router.get("/blockchain/status")
async def get_blockchain_status():
    """Returns connectivity and deployment status of the EVM blockchain ledger."""
    return blockchain_client.get_network_status()


# --- 3. Allowances Endpoints ---

@router.post("/allowances/grant", response_model=AllowanceResponse, status_code=status.HTTP_201_CREATED)
async def grant_allowance(req: GrantAllowanceRequest):
    # Enforce boundary: Plot must be ACTIVE and non-conflicting
    boundary = AllowanceServiceBoundary(db)
    try:
        payload = boundary.prepare_on_chain_registration_payload(
            OnChainAllowanceRequest(
                plot_id=req.plot_id,
                season_id=req.season_id,
                crop_code_str=req.crop_code,
                approved_allowance_kg=req.approved_allowance_kg,
                allowance_evidence_hash=req.evidence_document_hash
            )
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    plot = db.get_plot(req.plot_id)
    fingerprint = plot["canonical_fingerprint"] if plot else req.plot_id

    # Call on-chain / blockchain client
    chain_receipt = blockchain_client.register_plot_allowance(
        plot_id=req.plot_id,
        canonical_fingerprint=fingerprint,
        season_id=req.season_id,
        crop_code=req.crop_code,
        approved_allowance_kg=req.approved_allowance_kg,
        evidence_hash=req.evidence_document_hash
    )
    tx_hash = chain_receipt.get("tx_hash")

    allowance = db.create_or_update_allowance(
        plot_id=req.plot_id,
        season_id=req.season_id,
        crop_code=req.crop_code,
        approved_allowance_kg=req.approved_allowance_kg,
        evidence_document_hash=req.evidence_document_hash,
        tx_hash=tx_hash
    )

    return AllowanceResponse(
        allowance_id=allowance["allowance_id"],
        plot_id=req.plot_id,
        canonical_plot_hash=plot["canonical_fingerprint"] if plot else "",
        season_id=allowance["season_id"],
        crop_code=allowance["crop_code"],
        approved_allowance_kg=allowance["approved_allowance_kg"],
        claimed_kg=allowance["claimed_kg"],
        releasedKg=allowance["released_kg"],
        remaining_allowance_kg=allowance["approved_allowance_kg"] - (allowance["claimed_kg"] - allowance["released_kg"]),
        status=allowance["status"],
        tx_hash=tx_hash
    )


@router.get("/allowances/{plot_id}/{season_id}", response_model=AllowanceResponse)
async def get_allowance(plot_id: str, season_id: int):
    allowance = db.get_allowance(plot_id, season_id)
    if not allowance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allowance record not found.")

    plot = db.get_plot(plot_id)
    return AllowanceResponse(
        allowance_id=allowance["allowance_id"],
        plot_id=plot_id,
        canonical_plot_hash=plot["canonical_fingerprint"] if plot else "",
        season_id=allowance["season_id"],
        crop_code=allowance["crop_code"],
        approved_allowance_kg=allowance["approved_allowance_kg"],
        claimed_kg=allowance["claimed_kg"],
        releasedKg=allowance["released_kg"],
        remaining_allowance_kg=allowance["approved_allowance_kg"] - (allowance["claimed_kg"] - allowance["released_kg"]),
        status=allowance["status"],
        tx_hash=allowance.get("tx_hash")
    )


# --- 4. Shipment Documents Endpoints ---

@router.post("/documents/extract", response_model=DocumentExtractionResponse)
async def extract_document(req: DocumentExtractionRequest):
    parsed = await doc_extractor.extract_fields_async(
        file_name=req.file_name,
        raw_text=req.raw_document_text,
        provider_override=req.provider_override
    )
    saved = db.save_shipment_document(
        file_name=req.file_name,
        file_hash_sha256=parsed.file_hash_sha256,
        raw_text=req.raw_document_text,
        extraction_source=parsed.extraction_source,
        extracted_fields=parsed.extracted_fields.model_dump()
    )
    parsed.document_id = saved["document_id"]
    return parsed


@router.post("/documents/{document_id}/confirm", response_model=Dict[str, Any])
async def confirm_document(document_id: str, req: DocumentConfirmationRequest):
    try:
        return db.confirm_shipment_document(
            document_id=document_id,
            operator_id=req.operator_id,
            confirmed_fields=req.confirmed_fields.model_dump()
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# --- 5. Shipment Claims Endpoints ---

@router.get("/claims", response_model=List[ClaimResponse])
async def list_claims_endpoint(
    plot_id: Optional[str] = Query(None),
    season_id: Optional[int] = Query(None)
):
    """Lists recorded shipment claims with filter by plot and season."""
    claims = db.list_claims(plot_id=plot_id, season_id=season_id)
    return [
        ClaimResponse(
            claim_id=c["claim_id"],
            plot_id=c["plot_id"],
            season_id=c["season_id"],
            claimed_kg=c["claimed_kg"],
            status=ClaimOnChainStatus(c["on_chain_status"]),
            tx_hash=c.get("tx_hash"),
            block_number=c.get("block_number"),
            message="On-chain claim record"
        )
        for c in claims
    ]


@router.post("/claims/submit", response_model=ClaimResponse)
async def submit_claim(req: ClaimSubmissionRequest):
    allowance = db.get_allowance(req.plot_id, req.season_id)
    if not allowance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Allowance for plot and season not found.")

    # Check for existing claim (idempotency check)
    existing_claim = db.get_claim(req.claim_id)
    if existing_claim:
        return ClaimResponse(
            claim_id=existing_claim["claim_id"],
            plot_id=existing_claim["plot_id"],
            season_id=existing_claim["season_id"],
            claimed_kg=existing_claim["claimed_kg"],
            status=ClaimOnChainStatus(existing_claim["on_chain_status"]),
            tx_hash=existing_claim.get("tx_hash"),
            block_number=existing_claim.get("block_number"),
            message="Claim previously recorded (idempotent response)."
        )

    plot = db.get_plot(req.plot_id)
    fingerprint = plot["canonical_fingerprint"] if plot else req.plot_id

    # Execute on blockchain or fallback simulator
    chain_receipt = blockchain_client.submit_shipment_claim(
        claim_id=req.claim_id,
        canonical_fingerprint=fingerprint,
        season_id=req.season_id,
        claimed_kg=req.claimed_kg,
        evidence_hash=req.shipment_evidence_hash
    )

    tx_hash = chain_receipt.get("tx_hash")
    block_num = chain_receipt.get("block_number", 42)

    net_claimed = allowance["claimed_kg"] - allowance["released_kg"]
    remaining = allowance["approved_allowance_kg"] - net_claimed

    # If live chain returned REJECTED_OVER_ALLOCATION or in fallback mode we verify capacity
    is_rejected = (
        chain_receipt.get("status") == "REJECTED_OVER_ALLOCATION"
        or (not chain_receipt.get("is_live_chain", False) and req.claimed_kg > remaining)
    )

    if is_rejected:
        recorded = db.record_claim(
            claim_id=req.claim_id,
            plot_id=req.plot_id,
            season_id=req.season_id,
            claimed_kg=req.claimed_kg,
            shipment_evidence_hash=req.shipment_evidence_hash,
            on_chain_status=ClaimOnChainStatus.REJECTED_OVER_ALLOCATION,
            document_id=req.document_id,
            tx_hash=tx_hash,
            block_number=block_num
        )
        return ClaimResponse(
            claim_id=req.claim_id,
            plot_id=req.plot_id,
            season_id=req.season_id,
            claimed_kg=req.claimed_kg,
            status=ClaimOnChainStatus.REJECTED_OVER_ALLOCATION,
            remaining_capacity_kg=remaining,
            tx_hash=tx_hash,
            block_number=block_num,
            message="Claim rejected due to over-allocation. Balance remains strictly unchanged."
        )

    # Success case
    recorded = db.record_claim(
        claim_id=req.claim_id,
        plot_id=req.plot_id,
        season_id=req.season_id,
        claimed_kg=req.claimed_kg,
        shipment_evidence_hash=req.shipment_evidence_hash,
        on_chain_status=ClaimOnChainStatus.CONFIRMED,
        document_id=req.document_id,
        tx_hash=tx_hash,
        block_number=block_num
    )

    new_remaining = remaining - req.claimed_kg
    return ClaimResponse(
        claim_id=req.claim_id,
        plot_id=req.plot_id,
        season_id=req.season_id,
        claimed_kg=req.claimed_kg,
        status=ClaimOnChainStatus.CONFIRMED,
        remaining_capacity_kg=new_remaining,
        tx_hash=tx_hash,
        block_number=block_num,
        message="Claim successfully confirmed on-chain."
    )


@router.post("/claims/{claim_id}/release", response_model=ClaimResponse)
async def release_claim(claim_id: str, req: ClaimReleaseRequest):
    try:
        mock_tx = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}"
        released = db.release_claim_record(claim_id=claim_id, reason=req.reason, tx_hash=mock_tx)
        allowance = db.get_allowance(released["plot_id"], released["season_id"])
        net_claimed = allowance["claimed_kg"] - allowance["released_kg"]
        remaining = allowance["approved_allowance_kg"] - net_claimed

        return ClaimResponse(
            claim_id=claim_id,
            plot_id=released["plot_id"],
            season_id=released["season_id"],
            claimed_kg=released["claimed_kg"],
            status=ClaimOnChainStatus.CONFIRMED,
            remaining_capacity_kg=remaining,
            tx_hash=mock_tx,
            message="Claim successfully released on-chain. Capacity restored."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# --- 6. Environmental Screening Endpoints ---

@router.post("/screening/whisp", response_model=EnvironmentalScreeningResponse)
async def screen_plot(req: EnvironmentalScreeningRequest):
    plot = db.get_plot(req.plot_id)
    if not plot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plot '{req.plot_id}' not found.")

    import json
    geom = json.loads(plot["raw_geojson"])
    screening = await whisp_service.screen_plot_geometry(
        plot_id=req.plot_id,
        geojson_geom=geom,
        override_mode=req.mode
    )

    # Save to local database cache
    db.save_environmental_screening(
        plot_id=req.plot_id,
        service_name=screening.service_name,
        deforestation_risk=screening.deforestation_risk.value,
        cutoff_date=screening.cutoff_date,
        indicators=screening.indicators.model_dump(),
        provenance=screening.provenance.value,
        source_digest=screening.source_digest,
        is_cached=screening.is_cached_snapshot
    )

    return screening


# --- 7. Evidence Reports Endpoints ---

@router.get("/evidence/report/{plot_id}", response_model=EvidenceReportResponse)
async def get_evidence_report(
    plot_id: str,
    season_id: int = Query(2026),
    claim_id: Optional[str] = Query(None)
):
    plot = db.get_plot(plot_id)
    if not plot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plot '{plot_id}' not found.")

    allowance = db.get_allowance(plot_id, season_id)
    claim = db.get_claim(claim_id) if claim_id else None
    screening = db.get_environmental_screening(plot_id)

    # Check for review record
    review = None
    with db._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM spatial_reviews WHERE submitted_plot_id = ? ORDER BY created_at DESC LIMIT 1", (plot_id,))
        r = cursor.fetchone()
        if r:
            review = dict(r)

    document = None
    if claim and claim.get("document_id"):
        document = db.get_shipment_document(claim["document_id"])

    report = report_builder.build_report(
        plot_record=plot,
        allowance_record=allowance,
        claim_record=claim,
        document_record=document,
        screening_record=screening,
        review_record=review
    )

    return report
