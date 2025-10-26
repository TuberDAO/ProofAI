#!/usr/bin/env tsx
import dotenv from 'dotenv';
import { createPublicClient, http } from 'viem';

// Load environment variables
dotenv.config();

const MEGAETH_CHAIN_ID = 6342;
const DEFAULT_RPC = 'https://carrot.megaeth.com/rpc';

interface PreflightResult {
  ok: boolean;
  checks: {
    envLoaded: boolean;
    rpcConnected: boolean;
    chainIdValid: boolean;
    contractExists: boolean;
  };
  details: {
    rpcUrl: string;
    chainId?: number;
    contractAddress?: string;
    contractCodeSize?: number;
  };
  errors: string[];
}

async function runPreflight(): Promise<PreflightResult> {
  const result: PreflightResult = {
    ok: false,
    checks: {
      envLoaded: false,
      rpcConnected: false,
      chainIdValid: false,
      contractExists: false,
    },
    details: {
      rpcUrl: process.env.MEGAETH_RPC_URL || DEFAULT_RPC,
    },
    errors: [],
  };

  // Check 1: Environment variables loaded
  console.log('\n🔍 Running preflight checks...\n');

  const requiredVars = ['JOB_REGISTRY_ADDRESS'];
  const missingVars = requiredVars.filter((v) => !process.env[v]);

  if (missingVars.length === 0) {
    result.checks.envLoaded = true;
    result.details.contractAddress = process.env.JOB_REGISTRY_ADDRESS;
  } else {
    result.errors.push(`Missing env vars: ${missingVars.join(', ')}`);
    return result;
  }

  // Check 2: Connect to RPC and get chain ID
  try {
    const client = createPublicClient({
      transport: http(result.details.rpcUrl, {
        timeout: 10_000,
      }),
    });

    const chainId = await client.getChainId();
    result.details.chainId = chainId;
    result.checks.rpcConnected = true;

    // Check 3: Validate chain ID
    if (chainId === MEGAETH_CHAIN_ID) {
      result.checks.chainIdValid = true;
    } else {
      result.errors.push(
        `Wrong chain ID: expected ${MEGAETH_CHAIN_ID}, got ${chainId}`
      );
    }
  } catch (error) {
    result.errors.push(`RPC connection failed: ${(error as Error).message}`);
    return result;
  }

  // Check 4: Verify contract exists
  try {
    const client = createPublicClient({
      transport: http(result.details.rpcUrl),
    });

    const bytecode = await client.getBytecode({
      address: result.details.contractAddress as `0x${string}`,
    });

    if (bytecode && bytecode !== '0x' && bytecode.length > 2) {
      result.details.contractCodeSize = (bytecode.length - 2) / 2; // Convert hex to bytes
      result.checks.contractExists = true;
    } else {
      result.errors.push('No contract bytecode found at address');
    }
  } catch (error) {
    result.errors.push(`Contract check failed: ${(error as Error).message}`);
    return result;
  }

  // Overall status
  result.ok =
    result.checks.envLoaded &&
    result.checks.rpcConnected &&
    result.checks.chainIdValid &&
    result.checks.contractExists;

  return result;
}

function printResults(result: PreflightResult) {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    PREFLIGHT CHECK RESULTS                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Print checks
  const checkMark = (passed: boolean) => (passed ? '✅' : '❌');

  console.log(`${checkMark(result.checks.envLoaded)}  Environment loaded`);
  console.log(
    `${checkMark(result.checks.rpcConnected)}  RPC connection (${result.details.rpcUrl})`
  );
  console.log(
    `${checkMark(result.checks.chainIdValid)}  Chain ID: ${result.details.chainId || 'N/A'} ${
      result.checks.chainIdValid ? '(MegaETH Testnet)' : ''
    }`
  );
  console.log(
    `${checkMark(result.checks.contractExists)}  Contract deployed: ${
      result.details.contractAddress || 'N/A'
    }`
  );
  if (result.details.contractCodeSize) {
    console.log(`   └─ Code size: ${result.details.contractCodeSize} bytes`);
  }

  console.log('');
  console.log('─────────────────────────────────────────────────────────────────');

  if (result.ok) {
    console.log('');
    console.log('🎉 PREFLIGHT PASSED');
    console.log('');
    console.log('Summary:');
    console.log(`   Chain ID: ${result.details.chainId}`);
    console.log(`   Contract: ${result.details.contractAddress}`);
    console.log(`   Code Size: ${result.details.contractCodeSize} bytes`);
    console.log('');
    console.log('👉 Next: Run `pnpm dev` to start the stack');
    console.log('');
  } else {
    console.log('');
    console.log('❌ PREFLIGHT FAILED');
    console.log('');
    console.log('Errors:');
    result.errors.forEach((err) => console.log(`   • ${err}`));
    console.log('');

    // Print actionable checklist
    if (!result.checks.envLoaded) {
      console.log('Action required:');
      console.log('   1. Ensure apps/server/.env exists');
      console.log('   2. Set JOB_REGISTRY_ADDRESS=0xA2189Fc270BaaF85d57C04Bf8e00Cd6580aF0e07');
      console.log('');
    }

    if (result.checks.envLoaded && !result.checks.rpcConnected) {
      console.log('Action required:');
      console.log('   1. Check your internet connection');
      console.log('   2. Verify MEGAETH_RPC_URL is correct');
      console.log('   3. Try again in a few moments (RPC may be rate-limited)');
      console.log('');
    }

    if (result.checks.rpcConnected && !result.checks.chainIdValid) {
      console.log('Action required:');
      console.log('   1. Ensure you are connecting to MegaETH Testnet');
      console.log(`   2. Set MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc`);
      console.log('');
    }

    if (result.checks.chainIdValid && !result.checks.contractExists) {
      console.log('Action required:');
      console.log('   1. Verify the contract address is correct');
      console.log('   2. Run `pnpm smart-deploy` to deploy the contract');
      console.log('');
    }
  }

  console.log('═════════════════════════════════════════════════════════════════');
  console.log('');
}

// Main execution
async function main() {
  try {
    const result = await runPreflight();
    printResults(result);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error('❌ Preflight check crashed:', (error as Error).message);
    process.exit(1);
  }
}

main();

