import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy JobRegistry
  const JobRegistry = await ethers.getContractFactory("JobRegistry");
  
  // Log bytecode size for debugging
  const bytecode = JobRegistry.bytecode;
  console.log("JobRegistry bytecode length:", bytecode.length, "bytes");
  
  // Use a much higher gas limit to avoid out-of-gas during deployment
  const gasLimit = 25_000_000n;
  console.log("Using gasLimit override:", gasLimit.toString());
  
  const jobRegistry = await JobRegistry.deploy({
    gasLimit,
  });
  
  await jobRegistry.waitForDeployment();
  
  const address = await jobRegistry.getAddress();
  
  // Print exactly one line in the required format for parsing
  console.log(`JobRegistry deployed at: ${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

