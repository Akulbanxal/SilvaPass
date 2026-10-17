import { expect } from "chai";
import { ethers } from "hardhat";

describe("SilvaPassRegistry - Production Allowance Ledger & Invariant Tests", function () {
  let registry: any;
  let admin: any;
  let registrar: any;
  let exporter: any;
  let operator: any;
  let unauthorizedUser: any;

  // Fixed test identities
  const plotId = ethers.keccak256(ethers.toUtf8Bytes("CANONICAL-PLOT-BRAZIL-MATO-GROSSO-001"));
  const geometryCommitment = ethers.keccak256(ethers.toUtf8Bytes("WKT-POLYGON-NORMALIZED-GEOJSON-COMMITMENT"));
  const season2026 = 2026;
  const cropSoy = ethers.keccak256(ethers.toUtf8Bytes("SOY"));
  const allowanceEvidenceHash = ethers.keccak256(ethers.toUtf8Bytes("AGRONOMIC-YIELD-AUDIT-2026"));

  beforeEach(async function () {
    [admin, registrar, exporter, operator, unauthorizedUser] = await ethers.getSigners();

    const SilvaPassRegistryFactory = await ethers.getContractFactory("SilvaPassRegistry");
    registry = await SilvaPassRegistryFactory.deploy();
    await registry.waitForDeployment();

    // Assign roles
    const REGISTRAR_ROLE = await registry.REGISTRAR_ROLE();
    const EXPORTER_ROLE = await registry.EXPORTER_ROLE();
    const CLAIM_OPERATOR_ROLE = await registry.CLAIM_OPERATOR_ROLE();

    await registry.grantRole(REGISTRAR_ROLE, registrar.address);
    await registry.grantRole(EXPORTER_ROLE, exporter.address);
    await registry.grantRole(CLAIM_OPERATOR_ROLE, operator.address);
  });

  describe("1. Plot Registration and Authorization", function () {
    it("should allow an authorized registrar to register a plot with geometry commitment and allowance", async function () {
      const approvedKg = 3000;

      const tx = await registry.connect(registrar).registerPlot(
        plotId,
        geometryCommitment,
        cropSoy,
        season2026,
        approvedKg,
        allowanceEvidenceHash
      );

      await expect(tx)
        .to.emit(registry, "PlotRegistered")
        .withArgs(plotId, season2026, geometryCommitment, cropSoy, approvedKg, allowanceEvidenceHash, registrar.address);

      const reg = await registry.getPlotRegistration(plotId, season2026);
      expect(reg.geometryCommitment).to.equal(geometryCommitment);
      expect(reg.cropCode).to.equal(cropSoy);
      expect(reg.approvedAllowanceKg).to.equal(3000);
      expect(reg.claimedKg).to.equal(0);
      expect(reg.releasedKg).to.equal(0);
      expect(reg.remainingAllowanceKg).to.equal(3000);
      expect(reg.status).to.equal(0); // RegistrationStatus.ACTIVE
      expect(reg.exists).to.be.true;
    });

    it("should revert if an unauthorized caller attempts plot registration", async function () {
      await expect(
        registry.connect(unauthorizedUser).registerPlot(
          plotId,
          geometryCommitment,
          cropSoy,
          season2026,
          3000,
          allowanceEvidenceHash
        )
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("should revert if registering duplicate plot identifier and season", async function () {
      await registry.connect(registrar).registerPlot(
        plotId,
        geometryCommitment,
        cropSoy,
        season2026,
        3000,
        allowanceEvidenceHash
      );

      await expect(
        registry.connect(registrar).registerPlot(
          plotId,
          geometryCommitment,
          cropSoy,
          season2026,
          5000,
          allowanceEvidenceHash
        )
      ).to.be.revertedWithCustomError(registry, "PlotAlreadyExists");
    });

    it("should reject invalid/empty inputs during registration", async function () {
      await expect(
        registry.connect(registrar).registerPlot(
          ethers.ZeroHash,
          geometryCommitment,
          cropSoy,
          season2026,
          3000,
          allowanceEvidenceHash
        )
      ).to.be.revertedWithCustomError(registry, "EmptyIdentifier");

      await expect(
        registry.connect(registrar).registerPlot(
          plotId,
          geometryCommitment,
          cropSoy,
          season2026,
          0,
          allowanceEvidenceHash
        )
      ).to.be.revertedWithCustomError(registry, "ZeroQuantity");
    });
  });

  describe("2. Shipment Claims & Over-Allocation Invariant", function () {
    beforeEach(async function () {
      await registry.connect(registrar).registerPlot(
        plotId,
        geometryCommitment,
        cropSoy,
        season2026,
        3000,
        allowanceEvidenceHash
      );
    });

    it("enforces: Claim 1 (1800 kg) succeeds -> Remaining: 1200 kg -> Claim 2 (2000 kg) non-reverting rejection -> Balance unchanged", async function () {
      const claim1Id = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-BOL-001"));
      const evidenceHash1 = ethers.keccak256(ethers.toUtf8Bytes("EVIDENCE-BUNDLE-001"));

      // Step 1: Authorized exporter claims 1,800 kg
      const tx1 = await registry.connect(exporter).claimShipment(
        claim1Id,
        plotId,
        season2026,
        1800,
        evidenceHash1
      );

      await expect(tx1)
        .to.emit(registry, "ShipmentClaimAccepted")
        .withArgs(claim1Id, plotId, season2026, 1800, 1200, evidenceHash1, exporter.address);

      // Verify remaining balance is 1,200 kg
      let reg = await registry.getPlotRegistration(plotId, season2026);
      expect(reg.claimedKg).to.equal(1800);
      expect(reg.remainingAllowanceKg).to.equal(1200);

      // Step 2: Attempt claim for 2,000 kg (over-allocation)
      const claim2Id = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-BOL-002"));
      const evidenceHash2 = ethers.keccak256(ethers.toUtf8Bytes("EVIDENCE-BUNDLE-002"));

      const tx2 = await registry.connect(exporter).claimShipment(
        claim2Id,
        plotId,
        season2026,
        2000,
        evidenceHash2
      );

      // Verify non-reverting rejection event
      await expect(tx2)
        .to.emit(registry, "ShipmentClaimRejected")
        .withArgs(
          claim2Id,
          plotId,
          season2026,
          2000,
          1200,
          "Over-allocation: requested mass exceeds remaining capacity",
          exporter.address
        );

      // Step 3: State MUST remain strictly unchanged (still 1,200 kg remaining)
      reg = await registry.getPlotRegistration(plotId, season2026);
      expect(reg.claimedKg).to.equal(1800);
      expect(reg.remainingAllowanceKg).to.equal(1200);

      // Verify rejected claim does not occupy storage
      const claim2Record = await registry.getClaim(claim2Id);
      expect(claim2Record.exists).to.be.false;
    });

    it("should revert if an unauthorized caller attempts to claim", async function () {
      const claimId = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-UNAUTH"));
      await expect(
        registry.connect(unauthorizedUser).claimShipment(
          claimId,
          plotId,
          season2026,
          1000,
          allowanceEvidenceHash
        )
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("should revert on duplicate claim identifier", async function () {
      const claimId = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-DUP"));
      await registry.connect(exporter).claimShipment(claimId, plotId, season2026, 500, allowanceEvidenceHash);

      await expect(
        registry.connect(exporter).claimShipment(claimId, plotId, season2026, 300, allowanceEvidenceHash)
      ).to.be.revertedWithCustomError(registry, "ClaimAlreadyExists");
    });

    it("should allow claiming exact remaining allowance down to zero", async function () {
      const claim1 = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-EXACT-1"));
      await registry.connect(exporter).claimShipment(claim1, plotId, season2026, 3000, allowanceEvidenceHash);

      const reg = await registry.getPlotRegistration(plotId, season2026);
      expect(reg.remainingAllowanceKg).to.equal(0);

      // Subsequent 1 kg claim must be rejected
      const claim2 = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-EXACT-2"));
      const tx = await registry.connect(exporter).claimShipment(claim2, plotId, season2026, 1, allowanceEvidenceHash);
      await expect(tx).to.emit(registry, "ShipmentClaimRejected");
    });
  });

  describe("3. Claim Release Lifecycle", function () {
    beforeEach(async function () {
      await registry.connect(registrar).registerPlot(
        plotId,
        geometryCommitment,
        cropSoy,
        season2026,
        3000,
        allowanceEvidenceHash
      );
    });

    it("should allow authorized operator to release a claim and restore remaining allowance", async function () {
      const claimId = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-RELEASE"));
      await registry.connect(exporter).claimShipment(claimId, plotId, season2026, 1000, allowanceEvidenceHash);

      let reg = await registry.getPlotRegistration(plotId, season2026);
      expect(reg.remainingAllowanceKg).to.equal(2000);

      const releaseTx = await registry.connect(operator).releaseClaim(
        claimId,
        "Shipment rejected at customs entry point"
      );

      await expect(releaseTx)
        .to.emit(registry, "ShipmentClaimReleased")
        .withArgs(claimId, plotId, season2026, 1000, 3000, "Shipment rejected at customs entry point", operator.address);

      reg = await registry.getPlotRegistration(plotId, season2026);
      expect(reg.claimedKg).to.equal(1000);
      expect(reg.releasedKg).to.equal(1000);
      expect(reg.remainingAllowanceKg).to.equal(3000);

      const claimRec = await registry.getClaim(claimId);
      expect(claimRec.isReleased).to.be.true;

      // Double-release reverts
      await expect(
        registry.connect(operator).releaseClaim(claimId, "Double release attempt")
      ).to.be.revertedWithCustomError(registry, "ClaimAlreadyReleased");
    });

    it("should revert if unauthorized caller attempts to release", async function () {
      const claimId = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-RELEASE-UNAUTH"));
      await registry.connect(exporter).claimShipment(claimId, plotId, season2026, 500, allowanceEvidenceHash);

      await expect(
        registry.connect(unauthorizedUser).releaseClaim(claimId, "Unauthorized")
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("4. Allowance Adjustment and Revocation", function () {
    beforeEach(async function () {
      await registry.connect(registrar).registerPlot(
        plotId,
        geometryCommitment,
        cropSoy,
        season2026,
        3000,
        allowanceEvidenceHash
      );
      const claimId = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-ADJ-BASE"));
      await registry.connect(exporter).claimShipment(claimId, plotId, season2026, 1200, allowanceEvidenceHash);
    });

    it("should allow authorized registrar to adjust allowance upward", async function () {
      await registry.connect(registrar).adjustAllowance(
        plotId,
        season2026,
        4500,
        "Agronomist harvest yield upward revision"
      );

      const reg = await registry.getPlotRegistration(plotId, season2026);
      expect(reg.approvedAllowanceKg).to.equal(4500);
      expect(reg.remainingAllowanceKg).to.equal(3300); // 4500 - 1200
    });

    it("should revert if adjusting allowance below already active net claims", async function () {
      await expect(
        registry.connect(registrar).adjustAllowance(
          plotId,
          season2026,
          1000, // Below 1200 kg already claimed
          "Downward revision below claimed"
        )
      ).to.be.revertedWithCustomError(registry, "AdjustmentBelowNetClaimed");
    });

    it("should revoke plot and block any subsequent claims", async function () {
      await registry.connect(registrar).revokePlot(
        plotId,
        season2026,
        "Environmental audit flagged boundary dispute"
      );

      const reg = await registry.getPlotRegistration(plotId, season2026);
      expect(reg.status).to.equal(1); // RegistrationStatus.REVOKED

      const claimId = ethers.keccak256(ethers.toUtf8Bytes("CLAIM-POST-REVOKE"));
      await expect(
        registry.connect(exporter).claimShipment(claimId, plotId, season2026, 200, allowanceEvidenceHash)
      ).to.be.revertedWithCustomError(registry, "PlotRevokedError");
    });
  });

  describe("5. Randomized Sequence Invariant Property Test", function () {
    it("maintains the invariant (netClaimed <= approvedAllowanceKg) across 30 randomized operations", async function () {
      const randPlotId = ethers.keccak256(ethers.toUtf8Bytes("RANDOM-INVARIANT-TEST-PLOT"));
      const initialAllowance = 10000; // 10,000 kg

      await registry.connect(registrar).registerPlot(
        randPlotId,
        geometryCommitment,
        cropSoy,
        season2026,
        initialAllowance,
        allowanceEvidenceHash
      );

      const activeClaimIds: string[] = [];

      for (let op = 0; op < 30; op++) {
        // Random choice: 0 = claim, 1 = release
        const choice = Math.floor(Math.random() * 2);

        if (choice === 0 || activeClaimIds.length === 0) {
          // Submit random claim between 500 and 3,500 kg
          const claimKg = Math.floor(Math.random() * 3000) + 500;
          const cid = ethers.keccak256(ethers.toUtf8Bytes(`RAND-CLAIM-${op}-${Math.random()}`));

          const tx = await registry.connect(exporter).claimShipment(
            cid,
            randPlotId,
            season2026,
            claimKg,
            allowanceEvidenceHash
          );

          // If accepted, add to releaseable pool
          const receipt = await tx.wait();
          const acceptedEvent = receipt.logs.find((log: any) => {
            try {
              return registry.interface.parseLog(log)?.name === "ShipmentClaimAccepted";
            } catch {
              return false;
            }
          });

          if (acceptedEvent) {
            activeClaimIds.push(cid);
          }
        } else {
          // Release a random previously accepted claim
          const randomIndex = Math.floor(Math.random() * activeClaimIds.length);
          const cidToRelease = activeClaimIds.splice(randomIndex, 1)[0];

          await registry.connect(operator).releaseClaim(
            cidToRelease,
            "Random test cancellation"
          );
        }

        // --- CHECK INVARIANT AFTER EVERY OPERATION ---
        const reg = await registry.getPlotRegistration(randPlotId, season2026);
        const netClaimed = reg.claimedKg - reg.releasedKg;

        expect(netClaimed).to.be.at.most(
          reg.approvedAllowanceKg,
          `Invariant breached: netClaimed (${netClaimed}) > approved (${reg.approvedAllowanceKg})`
        );
        expect(reg.remainingAllowanceKg).to.equal(
          reg.approvedAllowanceKg - netClaimed,
          "Remaining capacity calculation inconsistency"
        );
      }
    });
  });
});
