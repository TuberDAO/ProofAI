/**
 * Smoke test for client-signed job submission (PVA::JOB format)
 * 
 * This script:
 * 1. Creates a test wallet
 * 2. Builds a payload { model, input }
 * 3. Computes payloadHash = keccak256(JSON.stringify(payload))
 * 4. Signs the PVA::JOB message with EIP-191
 * 5. POSTs to /jobs in client mode
 * 6. Prints results
 */

import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { keccak256, toBytes } from 'viem';
import { buildPvaMessage } from '../src/signature.js';
import { env } from '../src/config/env.js';

const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${env.port}`;
const CONTRACT_ADDRESS = (env.jobRegistryV2Address || '0x9E4fA3B7f61b4eb19cD501e5f05514dfc024fA1E') as `0x${string}`;
const CHAIN_ID = 6342;

async function runClientSmokeTest() {
  console.log('\n========================================');
  console.log('CLIENT-SIGNED JOB SMOKE TEST (PVA::JOB)');
  console.log('========================================\n');

  // 1. Generate test wallet
  console.log('1. Generating test wallet...');
  const testPrivateKey = generatePrivateKey();
  const testAccount = privateKeyToAccount(testPrivateKey);
  const submitter = testAccount.address;
  console.log(`   ✓ Test address: ${submitter}\n`);

  // 2. Build payload
  console.log('2. Building payload...');
  const payload = {
    model: 'llama3-instruct',
    input: 'Hello from smoke-client test! This is a PVA::JOB format test.',
  };
  console.log(`   ✓ Model: ${payload.model}`);
  console.log(`   ✓ Input: ${payload.input.substring(0, 50)}...\n`);

  // 3. Compute payloadHash
  console.log('3. Computing payloadHash...');
  const payloadJson = JSON.stringify(payload);
  const payloadHash = keccak256(toBytes(payloadJson));
  console.log(`   ✓ Payload JSON: ${payloadJson}`);
  console.log(`   ✓ PayloadHash: ${payloadHash}\n`);

  // 4. Build timestamp
  const timestamp = Math.floor(Date.now() / 1000);
  console.log(`4. Timestamp: ${timestamp}\n`);

  // 5. Build PVA::JOB message
  console.log('5. Building PVA::JOB message...');
  const message = buildPvaMessage({
    chainId: CHAIN_ID,
    contract: CONTRACT_ADDRESS,
    submitter,
    payloadHash,
    timestamp,
  });
  console.log('   ✓ Message format:');
  console.log('   ' + message.split('\n').join('\n   '));
  console.log();

  // 6. Sign with test wallet (EIP-191)
  console.log('6. Signing with test wallet (EIP-191)...');
  const signature = await testAccount.signMessage({ message });
  console.log(`   ✓ Signature: ${signature.substring(0, 20)}...${signature.substring(signature.length - 18)}\n`);

  // 7. POST to /jobs
  console.log('7. Submitting to server...');
  console.log(`   URL: ${API_BASE_URL}/jobs`);
  
  const requestBody = {
    mode: 'client',
    submitter,
    chainId: CHAIN_ID,
    contract: CONTRACT_ADDRESS,
    payload,
    payloadHash,
    timestamp,
    signature,
    domain: 'PVA::JOB',
  };

  console.log('   Request body keys:', Object.keys(requestBody).join(', '));
  console.log();

  try {
    const response = await fetch(`${API_BASE_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`   ✗ Failed: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${result.error || result.details || JSON.stringify(result)}\n`);
      process.exit(1);
    }

    console.log(`   ✓ Success! Status: ${response.status}\n`);
    console.log('========================================');
    console.log('RESULT');
    console.log('========================================\n');
    
    // Print all result fields
    console.log('Response JSON:');
    console.log(JSON.stringify(result, null, 2));
    console.log();
    
    // Highlight key fields
    if (result.jobId) {
      console.log(`Job ID: ${result.jobId}`);
    }
    if (result.attestationHash) {
      console.log(`Attestation Hash: ${result.attestationHash}`);
    }
    if (result.signer || result.submitter) {
      console.log(`Recovered Submitter: ${result.signer || result.submitter}`);
    }
    if (result.txHash) {
      console.log(`TX Hash: ${result.txHash}`);
      console.log(`\nExplorer: https://www.oklink.com/megaeth-testnet/tx/${result.txHash}`);
    }
    if (result.receiptHash) {
      console.log(`Receipt Hash: ${result.receiptHash}`);
    }
    
    console.log();
    console.log('========================================');
    console.log('VERIFICATION');
    console.log('========================================\n');
    console.log(`✓ PayloadHash sent: ${payloadHash}`);
    console.log(`✓ Submitter sent:   ${submitter}`);
    if (result.signer || result.submitter) {
      const recovered = result.signer || result.submitter;
      const match = recovered.toLowerCase() === submitter.toLowerCase();
      console.log(`✓ Submitter match:  ${match ? '✅ YES' : '❌ NO'}`);
      if (!match) {
        console.log(`  Expected: ${submitter}`);
        console.log(`  Got:      ${recovered}`);
      }
    }
    console.log();
    console.log('========================================\n');
    console.log('✅ CLIENT-SIGNED JOB SMOKE TEST PASSED\n');
  } catch (error) {
    console.error(`   ✗ Request failed: ${error instanceof Error ? error.message : error}\n`);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runClientSmokeTest().catch((error) => {
  console.error('\n❌ Smoke test failed:', error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
