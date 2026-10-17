"""
Typed integration boundary connecting Geospatial Engine, SQLite persistence, and Contract Layer.
Ensures the backend cannot silently create an on-chain allowance while a plot remains in PENDING_REVIEW or FLAGGED_DUPLICATE.
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from backend.geo.models import PlotStatus, MatchClassification, PlotRegistrationResult
from backend.storage.spatial_db import SpatialStorage


class OnChainAllowanceRequest(BaseModel):
    plot_id: str
    season_id: int
    crop_code_str: str
    approved_allowance_kg: int = Field(gt=0, description="Approved integer kilograms")
    allowance_evidence_hash: str = Field(min_length=64, max_length=66, description="Hex-encoded bytes32 hash")


class OnChainAllowanceRegistrationReceipt(BaseModel):
    plot_id: str
    canonical_plot_hash: str
    season_id: int
    crop_code: str
    approved_allowance_kg: int
    remaining_allowance_kg: int
    status: str
    message: str


class AllowanceServiceBoundary:
    """
    Enforces the policy boundary:
    A plot MUST be ACTIVE and non-conflicting in the geospatial engine before
    an authorized allowance can be granted or committed on-chain.
    """
    def __init__(self, storage: SpatialStorage):
        self.storage = storage

    def validate_plot_eligible_for_allowance(self, plot_id: str) -> Dict[str, Any]:
        plot = self.storage.get_plot(plot_id)
        if not plot:
            raise ValueError(f"Plot '{plot_id}' does not exist in spatial registry.")

        current_status = plot["status"]
        if current_status == PlotStatus.PENDING_REVIEW.value:
            raise PermissionError(
                f"Cannot register allowance: Plot '{plot_id}' has an unresolved ambiguous spatial match "
                f"and is currently PENDING_REVIEW. Adjudication is required first."
            )

        if current_status == PlotStatus.FLAGGED_DUPLICATE.value:
            raise PermissionError(
                f"Cannot register allowance: Plot '{plot_id}' has been FLAGGED_DUPLICATE. "
                f"Duplicate parcels are strictly prohibited from receiving independent allowances."
            )

        if current_status != PlotStatus.ACTIVE.value:
            raise PermissionError(f"Cannot register allowance: Plot '{plot_id}' is in non-active status '{current_status}'.")

        return plot

    def prepare_on_chain_registration_payload(self, req: OnChainAllowanceRequest) -> Dict[str, Any]:
        """
        Validates plot eligibility and formats the bytes32 parameters for web3 / contract call.
        """
        plot = self.validate_plot_eligible_for_allowance(req.plot_id)
        canonical_fingerprint = plot["canonical_fingerprint"]
        plot_id_bytes32 = "0x" + canonical_fingerprint if not canonical_fingerprint.startswith("0x") else canonical_fingerprint

        return {
            "plot_id": req.plot_id,
            "plotIdBytes32": plot_id_bytes32,
            "seasonId": req.season_id,
            "cropCode": req.crop_code_str,
            "approvedAllowanceKg": req.approved_allowance_kg,
            "allowanceEvidenceHash": req.allowance_evidence_hash
        }
