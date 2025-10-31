#!/usr/bin/env tsx
/**
 * Smoke test for PVA::SESSION flow
 * 
 * This script:
 * 1. Creates a test account
 * 2. Builds a PVA::SESSION message
 * 3. Signs it with the test account
 * 4. Creates a session via POST /sessions
 * 5. Submits two jobs using the sessionId (no additional signatures needed)
 */

import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, toBytes } from 'viem';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const CONTRACT = process.env.JOB_REGISTRY_V2_ADDRESS || '0x9E4fA3B7f61b4eb19cD501e5f05514dfc024fA1E';
const CHAIN_ID = 6342;

// Test account (ephemeral)
const TEST_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

function buildSessionMessage(params: {
  chainId: number;
  contract: string;
  submitter: string;
  expiry: number;
  nonce: string;
}): string {
  return `PVA::SESSION
chainId:${params.chainId}
contract:${params.contract}
submitter:${params.submitter}
expiry:${params.expiry}
nonce:${params.nonce}`;
}

async function main() {
  console.log('\n🔐 Session Smoke Test');
  console.log('='.repeat(60));
  console.log(`API: ${API_BASE}`);
  console.log(`Test Account: ${account.address}`);
  console.log(`Contract: ${CONTRACT}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Build session message
    const expiry = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now
    const nonce = `0x${Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const message = buildSessionMessage({
      chainId: CHAIN_ID,
      contract: CONTRACT,
      submitter: account.address,
      expiry,
      nonce,
    });

    console.log('\n📝 Step 1: Build PVA::SESSION message');
    console.log('Message:');
    console.log(message);

    // Step 2: Sign message
    console.log('\n✍️  Step 2: Sign message with test account');
    const signature = await account.signMessage({ message });
    console.log(`Signature: ${signature}`);

    // Step 3: Create session
    console.log('\n🔑 Step 3: Create session via POST /sessions');
    const sessionResponse = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submitter: account.address,
        signature,
        message,
        chainId: CHAIN_ID,
        contract: CONTRACT,
        expiry,
        nonce,
        policy: {
          maxPrompts: 5,
          allowedModels: ['llama-3-8b-instruct', 'llama3-instruct'],
        },
      }),
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      throw new Error(`Session creation failed: ${sessionResponse.status} ${error}`);
    }

    const sessionData = await sessionResponse.json();
    console.log('✅ Session created:');
    console.log(JSON.stringify(sessionData, null, 2));

    const { sessionId } = sessionData;

    // Step 4: Verify session
    console.log('\n🔍 Step 4: Verify session via GET /sessions/:id');
    const verifyResponse = await fetch(`${API_BASE}/sessions/${sessionId}`);
    const verifyData = await verifyResponse.json();
    console.log('Session info:');
    console.log(JSON.stringify(verifyData, null, 2));

    if (!verifyData.valid) {
      throw new Error('Session is not valid!');
    }

    // Step 5: Submit two jobs using the session
    console.log('\n📤 Step 5: Submit job #1 with sessionId (no signature needed)');
    const job1Response = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify({
        model: 'llama-3-8b-instruct',
        input: 'Hello from session smoke test #1',
      }),
    });

    if (!job1Response.ok) {
      const error = await job1Response.text();
      throw new Error(`Job #1 failed: ${job1Response.status} ${error}`);
    }

    const job1Data = await job1Response.json();
    console.log('✅ Job #1 submitted:');
    console.log(JSON.stringify(job1Data, null, 2));

    // Step 6: Submit second job
    console.log('\n📤 Step 6: Submit job #2 with sessionId (no signature needed)');
    const job2Response = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify({
        model: 'llama-3-8b-instruct',
        input: 'Hello from session smoke test #2',
      }),
    });

    if (!job2Response.ok) {
      const error = await job2Response.text();
      throw new Error(`Job #2 failed: ${job2Response.status} ${error}`);
    }

    const job2Data = await job2Response.json();
    console.log('✅ Job #2 submitted:');
    console.log(JSON.stringify(job2Data, null, 2));

    // Step 7: Verify session usage
    console.log('\n🔍 Step 7: Verify session usage (promptsUsed should be 2)');
    const finalVerify = await fetch(`${API_BASE}/sessions/${sessionId}`);
    const finalData = await finalVerify.json();
    console.log('Final session info:');
    console.log(JSON.stringify(finalData, null, 2));

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SMOKE TEST PASSED');
    console.log('='.repeat(60));
    console.log(`Session ID: ${sessionId}`);
    console.log(`Submitter: ${account.address}`);
    console.log(`Job #1 ID: ${job1Data.jobId}`);
    console.log(`Job #1 TX: ${job1Data.txHash}`);
    console.log(`Job #2 ID: ${job2Data.jobId}`);
    console.log(`Job #2 TX: ${job2Data.txHash}`);
    console.log(`Prompts Used: ${finalData.promptsUsed} / ${finalData.policy?.maxPrompts || 'unlimited'}`);
    console.log(`Signing Mode: ${job1Data.signingMode}`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ SMOKE TEST FAILED');
    console.error(error);
    process.exit(1);
  }
}

main();








