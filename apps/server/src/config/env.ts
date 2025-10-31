import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Default MegaETH testnet RPC
const DEFAULT_MEGAETH_RPC = 'https://carrot.megaeth.com/rpc';

// Allowed signing modes
const SIGNING_MODES = ['server', 'client'] as const;
type SigningMode = typeof SIGNING_MODES[number];

/**
 * Normalize a private key: trim, remove quotes, prepend 0x if missing
 */
function normalizePrivateKey(raw: string | undefined): string {
  if (!raw) return '';

  // Trim whitespace and remove surrounding quotes
  let normalized = raw.trim().replace(/^["']|["']$/g, '');

  // If it's 64 hex characters without 0x, prepend 0x
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    normalized = `0x${normalized}`;
  }

  return normalized;
}

/**
 * Normalize an Ethereum address: trim, remove quotes, ensure 0x prefix
 */
function normalizeAddress(raw: string | undefined): string {
  if (!raw) return '';

  // Trim whitespace and remove surrounding quotes
  let normalized = raw.trim().replace(/^["']|["']$/g, '');

  // If it's 40 hex characters without 0x, prepend 0x
  if (/^[0-9a-fA-F]{40}$/.test(normalized)) {
    normalized = `0x${normalized}`;
  }

  return normalized;
}

/**
 * Validation regex patterns
 */
const PATTERNS = {
  PRIVATE_KEY: /^0x[0-9a-fA-F]{64}$/,
  ADDRESS: /^0x[0-9a-fA-F]{40}$/,
  RPC_URL: /^https?:\/\/.+/,
};

/**
 * Validate environment variables and throw clear errors
 */
function validateEnv() {
  const errors: string[] = [];

  // Normalize keys and addresses
  const privateKey = normalizePrivateKey(process.env.SERVER_WALLET_PRIVATE_KEY);
  const providerAddress = normalizeAddress(process.env.PROVIDER_ADDRESS);
  const registryAddress = normalizeAddress(process.env.JOB_REGISTRY_ADDRESS);
  const registryV2Address = normalizeAddress(process.env.JOB_REGISTRY_V2_ADDRESS || '');
  const rpcUrl = process.env.MEGAETH_RPC_URL?.trim() || DEFAULT_MEGAETH_RPC;
  
  // Validate signing mode
  const signingMode = (process.env.SIGNING_MODE?.trim() || 'server') as SigningMode;
  if (!SIGNING_MODES.includes(signingMode)) {
    errors.push(
      `SIGNING_MODE must be one of: ${SIGNING_MODES.join(', ')} (got: ${signingMode})`
    );
  }

  // Validate SERVER_WALLET_PRIVATE_KEY (only required in server mode)
  if (signingMode === 'server') {
    if (!privateKey) {
      errors.push('SERVER_WALLET_PRIVATE_KEY is required in server signing mode');
    } else if (!PATTERNS.PRIVATE_KEY.test(privateKey)) {
      errors.push(
        'SERVER_WALLET_PRIVATE_KEY must be a valid private key (0x + 64 hex characters)'
      );
    }

    // Validate PROVIDER_ADDRESS (only required in server mode)
    if (!providerAddress) {
      errors.push('PROVIDER_ADDRESS is required in server signing mode');
    } else if (!PATTERNS.ADDRESS.test(providerAddress)) {
      errors.push(
        'PROVIDER_ADDRESS must be a valid Ethereum address (0x + 40 hex characters)'
      );
    }
  }

  // Validate JOB_REGISTRY_ADDRESS
  if (!registryAddress) {
    errors.push('JOB_REGISTRY_ADDRESS is required');
  } else if (!PATTERNS.ADDRESS.test(registryAddress)) {
    errors.push(
      'JOB_REGISTRY_ADDRESS must be a valid Ethereum address (0x + 40 hex characters)'
    );
  }

  // Validate MEGAETH_RPC_URL
  if (!PATTERNS.RPC_URL.test(rpcUrl)) {
    errors.push('MEGAETH_RPC_URL must be a valid HTTP(S) URL');
  }

  // If there are validation errors, throw with helpful message
  if (errors.length > 0) {
    const errorMessage = [
      '',
      '❌ Environment validation failed:',
      '',
      ...errors.map((err) => `   • ${err}`),
      '',
      '📝 Please check apps/server/.env and ensure:',
      '   • Private keys are 64 hex characters (with or without 0x prefix)',
      '   • Addresses are 40 hex characters (with or without 0x prefix)',
      '   • No quotes or extra whitespace around values',
      '   • RPC URL starts with http:// or https://',
      '',
      '💡 MetaMask exports private keys without 0x prefix - that\'s OK!',
      '   The system will auto-add it.',
      '',
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Validate V2 address if provided
  if (registryV2Address && !PATTERNS.ADDRESS.test(registryV2Address)) {
    errors.push(
      'JOB_REGISTRY_V2_ADDRESS must be a valid Ethereum address (0x + 40 hex characters)'
    );
  }

  // Return normalized values (update process.env for consistency)
  process.env.SERVER_WALLET_PRIVATE_KEY = privateKey;
  process.env.PROVIDER_ADDRESS = providerAddress;
  process.env.JOB_REGISTRY_ADDRESS = registryAddress;
  process.env.JOB_REGISTRY_V2_ADDRESS = registryV2Address;
  process.env.MEGAETH_RPC_URL = rpcUrl;
  process.env.SIGNING_MODE = signingMode;

  return {
    privateKey,
    providerAddress,
    registryAddress,
    registryV2Address,
    rpcUrl,
    signingMode,
  };
}

// Run validation on import
const validated = validateEnv();

/**
 * Typed and validated environment configuration
 */
export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  megaethRpcUrl: validated.rpcUrl,
  jobRegistryAddress: validated.registryAddress as `0x${string}`,
  jobRegistryV2Address: validated.registryV2Address as `0x${string}` | '',
  serverWalletPrivateKey: validated.privateKey as `0x${string}`,
  providerAddress: validated.providerAddress as `0x${string}`,
  signingMode: validated.signingMode as 'server' | 'client',
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  minJobEth: process.env.MIN_JOB_ETH || '0.00001',
  maxJobEth: process.env.MAX_JOB_ETH || '0.01',
  rateLimitWindowMs: parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || '60000',
    10
  ),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  sessionMaxMinutes: parseInt(process.env.SESSION_MAX_MINUTES || '30', 10),
  sessionDefaultMinutes: parseInt(process.env.SESSION_DEFAULT_MINUTES || '15', 10),
  rateLimitBurst: parseInt(process.env.RATE_LIMIT_BURST || '10', 10),
  redisUrl: process.env.REDIS_URL?.trim() || '',
  
  // Security hardening (Phase 1)
  maxPromptChars: parseInt(process.env.MAX_PROMPT_CHARS || '10000', 10),
  maxReqsPerMinute: parseInt(process.env.MAX_REQS_PER_MINUTE || '120', 10),
  maxJobsPerMinute: parseInt(process.env.MAX_JOBS_PER_MINUTE || '30', 10),
  originAllowlist: (process.env.ORIGIN_ALLOWLIST || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  allowedModels: (process.env.ALLOWED_MODELS || 'llama-3-8b-instruct')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  allowedChainIds: (process.env.ALLOWED_CHAIN_IDS || '6342')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n)),
  allowedContracts: (
    process.env.ALLOWED_CONTRACTS ||
    validated.registryV2Address ||
    validated.registryAddress
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};

/**
 * Validate numeric configuration
 */
const minEth = parseFloat(env.minJobEth);
const maxEth = parseFloat(env.maxJobEth);
if (isNaN(minEth) || isNaN(maxEth) || minEth <= 0 || maxEth <= minEth) {
  throw new Error(
    'Invalid MIN_JOB_ETH or MAX_JOB_ETH configuration: must be positive numbers with MAX > MIN'
  );
}

/**
 * Helper: check if chainId is allowed
 */
export function isAllowedChainId(chainId: number): boolean {
  return env.allowedChainIds.includes(chainId);
}

/**
 * Helper: check if contract is allowed
 */
export function isAllowedContract(contract: string): boolean {
  return env.allowedContracts.includes(contract.toLowerCase());
}

// Log success (no secrets)
console.log('✅ Environment validated successfully');
console.log(`   RPC: ${env.megaethRpcUrl}`);
console.log(`   Signing Mode: ${env.signingMode}`);
console.log(`   Contract V1: ${env.jobRegistryAddress}`);
if (env.jobRegistryV2Address) {
  console.log(`   Contract V2: ${env.jobRegistryV2Address}`);
}
if (env.signingMode === 'server') {
  console.log(`   Provider: ${env.providerAddress}`);
}
console.log(`   Security: ${env.allowedChainIds.length} chain(s), ${env.allowedContracts.length} contract(s), ${env.allowedModels.length} model(s)`);

