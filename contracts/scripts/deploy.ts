import { ethers } from "hardhat";

async function main() {
  console.log("--------------------------------------------------");
  console.log("Deploying SilvaPassRegistry smart contract...");
  console.log("--------------------------------------------------");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const SilvaPassRegistryFactory = await ethers.getContractFactory("SilvaPassRegistry");
  const registry = await SilvaPassRegistryFactory.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log("SilvaPassRegistry deployed successfully to:", contractAddress);

  // Check roles
  const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
  const REGISTRAR_ROLE = await registry.REGISTRAR_ROLE();
  const EXPORTER_ROLE = await registry.EXPORTER_ROLE();
  const CLAIM_OPERATOR_ROLE = await registry.CLAIM_OPERATOR_ROLE();

  console.log("Admin role assigned to deployer:", await registry.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
  console.log("Registrar role assigned to deployer:", await registry.hasRole(REGISTRAR_ROLE, deployer.address));
  console.log("Exporter role assigned to deployer:", await registry.hasRole(EXPORTER_ROLE, deployer.address));
  console.log("Claim operator role assigned to deployer:", await registry.hasRole(CLAIM_OPERATOR_ROLE, deployer.address));
  console.log("Ping response:", await registry.ping());
  console.log("--------------------------------------------------");
  console.log("Deployment complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
