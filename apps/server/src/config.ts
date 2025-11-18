import dotenv from 'dotenv';

dotenv.config();

// Default to MegaETH testnet v2 RPC if not provided
const DEFAULT_MEGAETH_RPC = 'https://timothy.megaeth.com/rpc';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  megaethRpcUrl: process.env.MEGAETH_RPC_URL || DEFAULT_MEGAETH_RPC,
  jobRegistryAddress: (process.env.JOB_REGISTRY_ADDRESS || '') as `0x${string}`,
  serverWalletPrivateKey: (process.env.SERVER_WALLET_PRIVATE_KEY ||
    '') as `0x${string}`,
  providerAddress: (process.env.PROVIDER_ADDRESS || '') as `0x${string}`,
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  minJobEth: process.env.MIN_JOB_ETH || '0.00001',
  maxJobEth: process.env.MAX_JOB_ETH || '0.01',
  rateLimitWindowMs: parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || '60000',
    10
  ),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
};

export function validateConfig() {
  const required = [
    'JOB_REGISTRY_ADDRESS',
    'SERVER_WALLET_PRIVATE_KEY',
    'PROVIDER_ADDRESS',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env file');
    process.exit(1);
  }

  // Warn if using default RPC
  if (!process.env.MEGAETH_RPC_URL) {
    console.warn(
      `⚠️  MEGAETH_RPC_URL not set, using default: ${DEFAULT_MEGAETH_RPC}`
    );
    console.warn(
      '   MegaETH testnet endpoints may be rate-limited. Check docs.megaeth.com for updates.'
    );
  }

  // Validate min/max ETH values
  const minEth = parseFloat(config.minJobEth);
  const maxEth = parseFloat(config.maxJobEth);
  if (isNaN(minEth) || isNaN(maxEth) || minEth <= 0 || maxEth <= minEth) {
    console.error('Invalid MIN_JOB_ETH or MAX_JOB_ETH configuration');
    process.exit(1);
  }
}

