import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SmokeTest with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const SmokeTest = await ethers.getContractFactory("SmokeTest");

  // Remove manual gas limit override for MegaETH v2
  const smokeTest = await SmokeTest.deploy();

  console.log("SmokeTest deployment tx hash:", smokeTest.deploymentTransaction()?.hash);
  await smokeTest.waitForDeployment();
  console.log("SmokeTest deployed to:", await smokeTest.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });


