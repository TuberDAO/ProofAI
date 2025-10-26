import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("\n🚀 Deploying JobRegistryV2 to MegaETH testnet...\n");

  const JobRegistryV2 = await ethers.getContractFactory("JobRegistryV2");
  const jobRegistryV2 = await JobRegistryV2.deploy();

  await jobRegistryV2.waitForDeployment();

  const address = await jobRegistryV2.getAddress();

  console.log(`✅ JobRegistryV2 deployed at: ${address}`);
  console.log("");
  console.log("─────────────────────────────────────────────────────────────────");
  console.log("");
  console.log("📋 Next steps:");
  console.log("");
  console.log("1. Update apps/server/.env with:");
  console.log("");
  console.log(`   JOB_REGISTRY_V2_ADDRESS=${address}`);
  console.log("");
  console.log("2. View on Explorer:");
  console.log(`   https://www.oklink.com/megaeth-testnet/address/${address}`);
  console.log("");
  console.log("─────────────────────────────────────────────────────────────────");
  console.log("");

  // Optionally update the server .env file automatically
  const serverEnvPath = path.join(__dirname, "../../../apps/server/.env");
  if (fs.existsSync(serverEnvPath)) {
    let envContent = fs.readFileSync(serverEnvPath, "utf8");
    
    const regex = /^JOB_REGISTRY_V2_ADDRESS=.*$/m;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `JOB_REGISTRY_V2_ADDRESS=${address}`);
    } else {
      // Append new line
      if (!envContent.endsWith("\n")) {
        envContent += "\n";
      }
      envContent += `JOB_REGISTRY_V2_ADDRESS=${address}\n`;
    }
    
    fs.writeFileSync(serverEnvPath, envContent);
    console.log(`✅ Updated ${serverEnvPath}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

