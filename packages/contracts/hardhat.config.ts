import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.23",
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    megaeth: {
      url: process.env.MEGAETH_RPC_URL || "https://timothy.megaeth.com/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 6343,
      // Let the deploy script's explicit gasLimit control the transaction
      // Network-level gas setting removed to avoid conflicts
    },
  },
};

export default config;

