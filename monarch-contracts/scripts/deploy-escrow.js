/**
 * Deploy MilestoneEscrow against existing MockUSDC from deployed-addresses.json.
 * Run: npx hardhat run scripts/deploy-escrow.js --network sepolia
 *
 * After deploy, set monarch-api .env MILESTONE_ESCROW_ADDRESS and configure on-chain
 * configureAsset(demoToken, beneficiary, [2000,3000,2000,3000]) as owner.
 */
import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const deployedPath = path.join(__dirname, "../deployed-addresses.json");
  const info = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const usdc = info.contracts.MockUSDC;
  if (!usdc) throw new Error("MockUSDC missing in deployed-addresses.json");

  const MilestoneEscrow = await ethers.getContractFactory("MilestoneEscrow");
  const escrow = await MilestoneEscrow.connect(deployer).deploy(usdc, deployer.address);
  await escrow.waitForDeployment();
  const addr = await escrow.getAddress();
  console.log("MilestoneEscrow:", addr);

  info.contracts.MilestoneEscrow = addr;
  fs.writeFileSync(deployedPath, JSON.stringify(info, null, 2));
  console.log("Updated deployed-addresses.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
