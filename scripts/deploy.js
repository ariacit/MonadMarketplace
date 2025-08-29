const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment to Monad Testnet...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  // Check deployer balance
  const balance = await deployer.getBalance();
  console.log("💰 Account balance:", ethers.utils.formatEther(balance), "ETH");
  
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    console.warn("⚠️  Warning: Account balance is low. Make sure you have enough ETH for deployment.");
  }
  
  console.log("\n📋 Deployment Steps:");
  console.log("1. Deploy NFT Contract");
  console.log("2. Deploy Marketplace Contract");
  console.log("3. Setup approvals and permissions");
  
  try {
    // Deploy NFT Contract
    console.log("\n🎨 Deploying NFT Contract...");
    const NFT = await ethers.getContractFactory("NFT");
    const nft = await NFT.deploy();
    await nft.deployed();
    console.log("✅ NFT Contract deployed to:", nft.address);
    
    // Deploy Marketplace Contract
    console.log("\n🏪 Deploying Marketplace Contract...");
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy();
    await marketplace.deployed();
    console.log("✅ Marketplace Contract deployed to:", marketplace.address);
    
    // Setup approvals
    console.log("\n🔧 Setting up contract permissions...");
    
    // Approve marketplace as minter for NFT contract
    console.log("📝 Approving marketplace as NFT minter...");
    const approveTx = await nft.approveMinter(marketplace.address);
    await approveTx.wait();
    console.log("✅ Marketplace approved as NFT minter");
    
    // Verify deployments
    console.log("\n🔍 Verifying deployments...");
    
    // Check NFT contract
    const nftName = await nft.name();
    const nftSymbol = await nft.symbol();
    const nftOwner = await nft.owner();
    console.log(`✅ NFT Contract verified: ${nftName} (${nftSymbol}), Owner: ${nftOwner}`);
    
    // Check Marketplace contract
    const marketplaceFee = await marketplace.MARKETPLACE_FEE();
    const marketplaceOwner = await marketplace.owner();
    console.log(`✅ Marketplace Contract verified: Fee: ${marketplaceFee/100}%, Owner: ${marketplaceOwner}`);
    
    // Generate deployment summary
    console.log("\n📊 DEPLOYMENT SUMMARY");
    console.log("=".repeat(50));
    console.log(`📅 Deployment Date: ${new Date().toISOString()}`);
    console.log(`🌐 Network: Monad Testnet`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Gas Used: ${ethers.utils.formatEther(balance.sub(await deployer.getBalance()))} ETH`);
    console.log("");
    console.log("📋 Contract Addresses:");
    console.log(`🎨 NFT Contract: ${nft.address}`);
    console.log(`🏪 Marketplace Contract: ${marketplace.address}`);
    console.log("");
    console.log("🔗 Contract Details:");
    console.log(`NFT Name: ${nftName}`);
    console.log(`NFT Symbol: ${nftSymbol}`);
    console.log(`Marketplace Fee: ${marketplaceFee/100}%`);
    console.log("");
    console.log("📝 Next Steps:");
    console.log("1. Update frontend/app.js with the deployed contract addresses");
    console.log("2. Ensure Metamask is connected to Monad Testnet");
    console.log("3. Test minting and marketplace functionality");
    console.log("4. Deploy frontend to Vercel");
    
    // Save deployment info to file
    const deploymentInfo = {
      network: "monad-testnet",
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: {
        nft: {
          address: nft.address,
          name: nftName,
          symbol: nftSymbol
        },
        marketplace: {
          address: marketplace.address,
          fee: marketplaceFee.toString()
        }
      }
    };
    
    const fs = require('fs');
    const path = require('path');
    
    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir);
    }
    
    // Save deployment info
    const deploymentFile = path.join(deploymentsDir, `monad-testnet-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);
    
    console.log("\n🎉 Deployment completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment script failed:", error);
    process.exit(1);
  });
