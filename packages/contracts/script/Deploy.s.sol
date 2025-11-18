// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/JobRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        JobRegistry registry = new JobRegistry();
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("========================================");
        console.log("JobRegistry deployed successfully!");
        console.log("========================================");
        console.log("Contract address:", address(registry));
        console.log("Chain ID: 6343 (MegaETH Testnet v2)");
        console.log("");
        console.log("View on Explorer:");
        console.log("https://megaeth-testnet-v2.blockscout.com/address/%s", address(registry));
        console.log("");
        console.log("========================================");
        console.log("Next steps:");
        console.log("========================================");
        console.log("1. Copy this line to apps/server/.env:");
        console.log("");
        console.log("JOB_REGISTRY_ADDRESS=%s", address(registry));
        console.log("");
        console.log("2. Make sure your server wallet has testnet ETH");
        console.log("3. Run: pnpm dev");
        console.log("========================================");
    }
}

