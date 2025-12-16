import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.SERVER_WALLET_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("❌ No private key found in DEPLOYER_PRIVATE_KEY or SERVER_WALLET_PRIVATE_KEY");
    process.exit(1);
  }
  
  // Ensure 0x prefix
  const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  
  const wallet = new ethers.Wallet(key);
  
  console.log("Wallet Address:", wallet.address);
  console.log("");
  console.log("Use this address for PROVIDER_ADDRESS in your .env file");
  console.log("This wallet needs MegaETH testnet ETH to deploy and submit jobs");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



