// Deployment script for Monarch RWA contracts
// Run with: npx hardhat run scripts/deploy.js --network sepolia

import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("🚀 Starting Monarch Contract Deployment to Sepolia...\n");

  const { ethers, networkName } = await network.connect();

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("🌐 Network:", networkName);
  console.log("💰 Account balance:", (await ethers.provider.getBalance(deployer.address)).toString(), "\n");

  // 1. Deploy Mock USDC
  console.log("1️⃣  Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.connect(deployer).deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✅ MockUSDC deployed to:", usdcAddress, "\n");

  // 2. Deploy AssetRegistry
  console.log("2️⃣  Deploying AssetRegistry...");
  const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
  const registry = await AssetRegistry.connect(deployer).deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ AssetRegistry deployed to:", registryAddress, "\n");

  // 3. Deploy PayoutDistributor
  console.log("3️⃣  Deploying PayoutDistributor...");
  const PayoutDistributor = await ethers.getContractFactory("PayoutDistributor");
  const distributor = await PayoutDistributor.connect(deployer).deploy(usdcAddress);
  await distributor.waitForDeployment();
  const distributorAddress = await distributor.getAddress();
  console.log("✅ PayoutDistributor deployed to:", distributorAddress, "\n");

  // 4. Deploy a demo AssetToken (Austin Residential Complex)
  console.log("4️⃣  Deploying Demo AssetToken (Austin Residential Complex)...");
  const AssetToken = await ethers.getContractFactory("AssetToken");
  const demoToken = await AssetToken.connect(deployer).deploy(
    "Austin Residential Complex Token",  // name
    "ARC",                                 // symbol
    "austin-residential-01",              // assetId
    "REAL_ESTATE",                        // assetType
    "Austin, Texas",                      // location
    ethers.parseEther("1000000"),     // totalValue: $1M
    ethers.parseEther("50")           // tokenPrice: $50
  );
  await demoToken.waitForDeployment();
  const demoTokenAddress = await demoToken.getAddress();
  console.log("✅ Demo AssetToken deployed to:", demoTokenAddress, "\n");

  // 5. Register the demo asset in the registry
  console.log("5️⃣  Registering demo asset in AssetRegistry...");
  const registerTx = await registry.registerAsset(
    demoTokenAddress,
    "austin-residential-01",
    "REAL_ESTATE",
    "Austin Residential Complex"
  );
  await registerTx.wait();
  console.log("✅ Demo asset registered in registry\n");

  // 6. Mint some demo tokens
  console.log("6️⃣  Minting 1000 demo tokens to deployer...");
  const mintTx = await demoToken.mint(deployer.address, ethers.parseEther("1000"));
  await mintTx.wait();
  console.log("✅ Tokens minted\n");

  // Save deployment addresses
  const deploymentInfo = {
    network: networkName,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MockUSDC: usdcAddress,
      AssetRegistry: registryAddress,
      PayoutDistributor: distributorAddress,
      DemoAssetToken: demoTokenAddress,
    },
  };

  const deploymentPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved to:", deploymentPath, "\n");

  // Print summary
  console.log("=" . repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=" . repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("  MockUSDC:           ", usdcAddress);
  console.log("  AssetRegistry:      ", registryAddress);
  console.log("  PayoutDistributor:  ", distributorAddress);
  console.log("  Demo AssetToken:    ", demoTokenAddress);
  console.log("\n🔗 Next Steps:");
  console.log("  1. Copy these addresses to your .env file");
  console.log("  2. Copy addresses to backend/.env");
  console.log("  3. Verify contracts on Etherscan:");
  console.log("     npx hardhat verify --network sepolia", usdcAddress);
  console.log("     npx hardhat verify --network sepolia", registryAddress);
  console.log("     npx hardhat verify --network sepolia", distributorAddress, usdcAddress);
  console.log("\n💡 Get testnet USDC:");
  console.log("  Call usdc.faucet() to get 10,000 test USDC");
  console.log("  Or visit:", `https://sepolia.etherscan.io/address/${usdcAddress}#writeContract`);
  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
