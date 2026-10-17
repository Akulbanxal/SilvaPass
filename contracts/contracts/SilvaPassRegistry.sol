// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SilvaPassRegistry
 * @notice Enforces shared production-claim allowances and auditable shipment integrity.
 *
 * @dev ARCHITECTURAL AND SECURITY SPECIFICATION:
 *
 * 1. THE SHARED CLAIM INVARIANT:
 *    For every registered (plotId, seasonId):
 *       netClaimed = (claimedKg - releasedKg)
 *       netClaimed <= approvedAllowanceKg
 *    This property is invariant across all valid operations.
 *
 * 2. GEOSPATIAL BOUNDARY DISCLAIMER:
 *    Plot identity matching and polygon deduplication are performed off-chain by the
 *    geospatial service. A raw polygon coordinate hash DOES NOT detect jittered,
 *    rotated, or perturbed polygons. The contract receives and enforces the resolved
 *    canonical plot identifier (`plotId`) and its approved integer allowance.
 *
 * 3. EXPLICIT INTEGER UNITS:
 *    All allowances and claims are denominated in kilograms (kg) as integer uint256 quantities.
 *    No floating-point arithmetic is permitted.
 *
 * 4. THREAT MITIGATION AND ROLE SEPARATION:
 *    - `REGISTRAR_ROLE`: Trusted administrative role for plot registration, allowance adjustments,
 *      and plot revocations.
 *    - `EXPORTER_ROLE`: Authorized exporters/shippers who may submit shipment claims.
 *    - `CLAIM_OPERATOR_ROLE`: Authorized operators permitted to release claims upon cancellation.
 *    - Over-allocation attempts emit an auditable `ShipmentClaimRejected` event and return false
 *      WITHOUT reverting, allowing the failed attempt to appear in a successful transaction receipt
 *      while leaving balances strictly unchanged.
 *    - Authorization violations, duplicate identifiers, malformed inputs, and invalid releases
 *      trigger explicit custom error reverts.
 */
contract SilvaPassRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant EXPORTER_ROLE = keccak256("EXPORTER_ROLE");
    bytes32 public constant CLAIM_OPERATOR_ROLE = keccak256("CLAIM_OPERATOR_ROLE");

    enum RegistrationStatus {
        ACTIVE,
        REVOKED
    }

    struct PlotRegistration {
        bytes32 plotId;                // Stable canonical plot hash
        bytes32 geometryCommitment;    // SHA-256 / keccak256 digest of normalized geometry
        bytes32 cropCode;              // Standardized crop code (e.g. keccak256("SOY"))
        uint256 seasonId;              // Production season/year (e.g. 2026)
        uint256 approvedAllowanceKg;   // Authorized production allowance in integer kilograms
        uint256 claimedKg;             // Total accepted claim mass in integer kilograms
        uint256 releasedKg;            // Total legitimately released claim mass in kilograms
        bytes32 allowanceEvidenceHash; // Off-chain agronomic yield audit document hash
        RegistrationStatus status;     // ACTIVE or REVOKED
        bool exists;                   // Registration existence flag
    }

    struct Claim {
        bytes32 claimId;               // Unique shipment claim identifier
        bytes32 plotId;                // Bound canonical plot identifier
        uint256 seasonId;              // Production season/year
        uint256 claimedKg;             // Claimed mass in integer kilograms
        bytes32 shipmentEvidenceHash;  // Hash of verified shipment documents
        address exporter;              // Exporter address submitting the claim
        uint256 timestamp;             // Block timestamp
        bool isReleased;               // Release status flag
        bool exists;                   // Claim existence flag
    }

    // Mapping: plotSeasonKey => PlotRegistration
    // plotSeasonKey = keccak256(abi.encodePacked(plotId, seasonId))
    mapping(bytes32 => PlotRegistration) private _registrations;

    // Mapping: claimId => Claim
    mapping(bytes32 => Claim) private _claims;

    // --- Events ---
    event PlotRegistered(
        bytes32 indexed plotId,
        uint256 indexed seasonId,
        bytes32 geometryCommitment,
        bytes32 cropCode,
        uint256 approvedAllowanceKg,
        bytes32 allowanceEvidenceHash,
        address indexed registrar
    );

    event AllowanceAdjusted(
        bytes32 indexed plotId,
        uint256 indexed seasonId,
        uint256 oldAllowanceKg,
        uint256 newAllowanceKg,
        string reason,
        address indexed registrar
    );

    event PlotRevoked(
        bytes32 indexed plotId,
        uint256 indexed seasonId,
        string reason,
        address indexed registrar
    );

    event ShipmentClaimAccepted(
        bytes32 indexed claimId,
        bytes32 indexed plotId,
        uint256 indexed seasonId,
        uint256 claimedKg,
        uint256 remainingAllowanceKg,
        bytes32 shipmentEvidenceHash,
        address exporter
    );

    event ShipmentClaimRejected(
        bytes32 indexed claimId,
        bytes32 indexed plotId,
        uint256 indexed seasonId,
        uint256 requestedClaimKg,
        uint256 remainingAllowanceKg,
        string reason,
        address exporter
    );

    event ShipmentClaimReleased(
        bytes32 indexed claimId,
        bytes32 indexed plotId,
        uint256 indexed seasonId,
        uint256 releasedKg,
        uint256 newRemainingAllowanceKg,
        string reason,
        address operator
    );

    // --- Custom Errors ---
    error EmptyIdentifier();
    error ZeroQuantity();
    error PlotAlreadyExists(bytes32 plotId, uint256 seasonId);
    error PlotNotFound(bytes32 plotId, uint256 seasonId);
    error PlotRevokedError(bytes32 plotId, uint256 seasonId);
    error ClaimAlreadyExists(bytes32 claimId);
    error ClaimNotFound(bytes32 claimId);
    error ClaimAlreadyReleased(bytes32 claimId);
    error AdjustmentBelowNetClaimed(uint256 requestedAllowanceKg, uint256 netClaimedKg);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(EXPORTER_ROLE, msg.sender);
        _grantRole(CLAIM_OPERATOR_ROLE, msg.sender);
    }

    /**
     * @notice Computes composite storage key for a plot and season.
     */
    function getRegistrationKey(bytes32 plotId, uint256 seasonId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(plotId, seasonId));
    }

    /**
     * @notice Registers a plot boundary commitment, crop, season, and approved production allowance.
     * @dev Only callable by an authorized registrar.
     */
    function registerPlot(
        bytes32 plotId,
        bytes32 geometryCommitment,
        bytes32 cropCode,
        uint256 seasonId,
        uint256 approvedAllowanceKg,
        bytes32 allowanceEvidenceHash
    ) external onlyRole(REGISTRAR_ROLE) {
        if (plotId == bytes32(0)) revert EmptyIdentifier();
        if (geometryCommitment == bytes32(0)) revert EmptyIdentifier();
        if (approvedAllowanceKg == 0) revert ZeroQuantity();

        bytes32 key = getRegistrationKey(plotId, seasonId);
        if (_registrations[key].exists) revert PlotAlreadyExists(plotId, seasonId);

        _registrations[key] = PlotRegistration({
            plotId: plotId,
            geometryCommitment: geometryCommitment,
            cropCode: cropCode,
            seasonId: seasonId,
            approvedAllowanceKg: approvedAllowanceKg,
            claimedKg: 0,
            releasedKg: 0,
            allowanceEvidenceHash: allowanceEvidenceHash,
            status: RegistrationStatus.ACTIVE,
            exists: true
        });

        emit PlotRegistered(
            plotId,
            seasonId,
            geometryCommitment,
            cropCode,
            approvedAllowanceKg,
            allowanceEvidenceHash,
            msg.sender
        );
    }

    /**
     * @notice Submits a shipment claim against a registered plot allowance.
     * @dev Only callable by an authorized exporter.
     *      If requested quantity exceeds remaining allowance, the claim is rejected
     *      without reverting, emitting an auditable `ShipmentClaimRejected` event and
     *      leaving the state strictly unchanged.
     */
    function claimShipment(
        bytes32 claimId,
        bytes32 plotId,
        uint256 seasonId,
        uint256 requestedClaimKg,
        bytes32 shipmentEvidenceHash
    ) external onlyRole(EXPORTER_ROLE) nonReentrant returns (bool) {
        if (claimId == bytes32(0)) revert EmptyIdentifier();
        if (requestedClaimKg == 0) revert ZeroQuantity();
        if (_claims[claimId].exists) revert ClaimAlreadyExists(claimId);

        bytes32 key = getRegistrationKey(plotId, seasonId);
        PlotRegistration storage reg = _registrations[key];

        if (!reg.exists) revert PlotNotFound(plotId, seasonId);
        if (reg.status == RegistrationStatus.REVOKED) revert PlotRevokedError(plotId, seasonId);

        uint256 netClaimed = reg.claimedKg - reg.releasedKg;
        uint256 remaining = reg.approvedAllowanceKg > netClaimed
            ? reg.approvedAllowanceKg - netClaimed
            : 0;

        // Invariant guard: Net claims cannot exceed approved allowance
        if (requestedClaimKg > remaining) {
            emit ShipmentClaimRejected(
                claimId,
                plotId,
                seasonId,
                requestedClaimKg,
                remaining,
                "Over-allocation: requested mass exceeds remaining capacity",
                msg.sender
            );
            return false;
        }

        // Accept claim
        reg.claimedKg += requestedClaimKg;

        _claims[claimId] = Claim({
            claimId: claimId,
            plotId: plotId,
            seasonId: seasonId,
            claimedKg: requestedClaimKg,
            shipmentEvidenceHash: shipmentEvidenceHash,
            exporter: msg.sender,
            timestamp: block.timestamp,
            isReleased: false,
            exists: true
        });

        uint256 newRemaining = remaining - requestedClaimKg;

        emit ShipmentClaimAccepted(
            claimId,
            plotId,
            seasonId,
            requestedClaimKg,
            newRemaining,
            shipmentEvidenceHash,
            msg.sender
        );

        return true;
    }

    /**
     * @notice Releases a previously accepted shipment claim (e.g. cancelled transport).
     * @dev Restores allowance capacity. Bounded strictly by the claimed amount.
     */
    function releaseClaim(
        bytes32 claimId,
        string calldata reason
    ) external onlyRole(CLAIM_OPERATOR_ROLE) nonReentrant {
        if (!_claims[claimId].exists) revert ClaimNotFound(claimId);
        Claim storage claimRecord = _claims[claimId];

        if (claimRecord.isReleased) revert ClaimAlreadyReleased(claimId);

        bytes32 key = getRegistrationKey(claimRecord.plotId, claimRecord.seasonId);
        PlotRegistration storage reg = _registrations[key];

        claimRecord.isReleased = true;
        reg.releasedKg += claimRecord.claimedKg;

        uint256 netClaimed = reg.claimedKg - reg.releasedKg;
        uint256 newRemaining = reg.approvedAllowanceKg - netClaimed;

        emit ShipmentClaimReleased(
            claimId,
            claimRecord.plotId,
            claimRecord.seasonId,
            claimRecord.claimedKg,
            newRemaining,
            reason,
            msg.sender
        );
    }

    /**
     * @notice Adjusts an approved allowance with required audit rationale.
     * @dev New allowance cannot be set below net claimed mass.
     */
    function adjustAllowance(
        bytes32 plotId,
        uint256 seasonId,
        uint256 newApprovedAllowanceKg,
        string calldata reason
    ) external onlyRole(REGISTRAR_ROLE) {
        bytes32 key = getRegistrationKey(plotId, seasonId);
        PlotRegistration storage reg = _registrations[key];

        if (!reg.exists) revert PlotNotFound(plotId, seasonId);
        if (reg.status == RegistrationStatus.REVOKED) revert PlotRevokedError(plotId, seasonId);

        uint256 netClaimed = reg.claimedKg - reg.releasedKg;
        if (newApprovedAllowanceKg < netClaimed) {
            revert AdjustmentBelowNetClaimed(newApprovedAllowanceKg, netClaimed);
        }

        uint256 oldAllowance = reg.approvedAllowanceKg;
        reg.approvedAllowanceKg = newApprovedAllowanceKg;

        emit AllowanceAdjusted(
            plotId,
            seasonId,
            oldAllowance,
            newApprovedAllowanceKg,
            reason,
            msg.sender
        );
    }

    /**
     * @notice Revokes a plot registration, permanently disabling further claims.
     */
    function revokePlot(
        bytes32 plotId,
        uint256 seasonId,
        string calldata reason
    ) external onlyRole(REGISTRAR_ROLE) {
        bytes32 key = getRegistrationKey(plotId, seasonId);
        PlotRegistration storage reg = _registrations[key];

        if (!reg.exists) revert PlotNotFound(plotId, seasonId);
        if (reg.status == RegistrationStatus.REVOKED) revert PlotRevokedError(plotId, seasonId);

        reg.status = RegistrationStatus.REVOKED;

        emit PlotRevoked(plotId, seasonId, reason, msg.sender);
    }

    // --- View Functions ---

    function getPlotRegistration(
        bytes32 plotId,
        uint256 seasonId
    ) external view returns (
        bytes32 geometryCommitment,
        bytes32 cropCode,
        uint256 approvedAllowanceKg,
        uint256 claimedKg,
        uint256 releasedKg,
        uint256 remainingAllowanceKg,
        bytes32 allowanceEvidenceHash,
        RegistrationStatus status,
        bool exists
    ) {
        bytes32 key = getRegistrationKey(plotId, seasonId);
        PlotRegistration storage reg = _registrations[key];
        if (!reg.exists) {
            return (bytes32(0), bytes32(0), 0, 0, 0, 0, bytes32(0), RegistrationStatus.ACTIVE, false);
        }

        uint256 netClaimed = reg.claimedKg - reg.releasedKg;
        uint256 remaining = reg.approvedAllowanceKg > netClaimed
            ? reg.approvedAllowanceKg - netClaimed
            : 0;

        return (
            reg.geometryCommitment,
            reg.cropCode,
            reg.approvedAllowanceKg,
            reg.claimedKg,
            reg.releasedKg,
            remaining,
            reg.allowanceEvidenceHash,
            reg.status,
            reg.exists
        );
    }

    function getClaim(
        bytes32 claimId
    ) external view returns (
        bytes32 plotId,
        uint256 seasonId,
        uint256 claimedKg,
        bytes32 shipmentEvidenceHash,
        address exporter,
        uint256 timestamp,
        bool isReleased,
        bool exists
    ) {
        Claim storage c = _claims[claimId];
        return (
            c.plotId,
            c.seasonId,
            c.claimedKg,
            c.shipmentEvidenceHash,
            c.exporter,
            c.timestamp,
            c.isReleased,
            c.exists
        );
    }

    function ping() external pure returns (string memory) {
        return "SilvaPassRegistry::v1.0.0";
    }
}
