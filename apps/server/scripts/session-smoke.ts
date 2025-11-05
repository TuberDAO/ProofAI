#!/usr/bin/env tsx
/**
 * Session Smoke Test
 * 
 * Verifies end-to-end PVA::SESSION flow without the web app:
 * 1. Generate throwaway key and sign PVA::SESSION message
 * 2. POST /sessions to create session
 * 3. GET /sessions/:id to verify validity
 * 4. POST /jobs twice using x-session-id header (no additional signatures)
 */

import { randomBytes } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, toBytes } from 'viem';

// Configuration
const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const CHAIN_ID = Number(process.env.MEGAETH_CHAIN_ID || 6342);
const CONTRACT = process.env.JOB_REGISTRY_V2_ADDRESS || '0x9E4fA3B7f61b4eb19cD501e5f05514dfc024fA1E';

/**
 * Build strict PVA::SESSION message (6 lines, exact format)
 */
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

/**
 * Fetch with error handling
 */
async function fetchOrDie(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const body = await response.text();
    console.error(`\n❌ HTTP ${response.status} ${response.statusText}`);
    console.error('URL:', url);
    console.error('Body:', body);
    process.exit(1);
  }

  return response;
}

async function main() {
  console.log('\n🔐 Session Smoke Test');
  console.log('='.repeat(70));
  console.log(`API:        ${API_BASE}`);
  console.log(`Chain ID:   ${CHAIN_ID}`);
  console.log(`Contract:   ${CONTRACT}`);
  console.log('='.repeat(70));

  // Step 1: Generate throwaway key and build session message
  console.log('\n📝 Step 1: Generate throwaway key and build PVA::SESSION message');
  
  const privateKey = `0x${randomBytes(32).toString('hex')}` as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  
  console.log(`Test account: ${account.address}`);

  const expiry = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now
  const nonce = `0x${randomBytes(16).toString('hex')}`;

  const message = buildSessionMessage({
    chainId: CHAIN_ID,
    contract: CONTRACT,
    submitter: account.address,
    expiry,
    nonce,
  });

  console.log('Message to sign:');
  console.log('─'.repeat(70));
  console.log(message);
  console.log('─'.repeat(70));

  // Step 2: Sign the message
  console.log('\n✍️  Step 2: Sign PVA::SESSION message');
  const signature = await account.signMessage({ message });
  console.log(`Signature: ${signature}`);

  // Step 3: POST /sessions to create session
  console.log('\n🔑 Step 3: Create session via POST /sessions');
  
  const sessionPayload = {
    submitter: account.address,
    signature,
    message,
    chainId: CHAIN_ID,
    contract: CONTRACT,
    expiry,
    nonce,
    policy: {
      maxPrompts: 5,
      allowedModels: ['llama-3-8b-instruct'],
    },
  };

  console.log('Payload:', JSON.stringify(sessionPayload, null, 2));

  const sessionResponse = await fetchOrDie(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionPayload),
  });

  const sessionData = await sessionResponse.json();
  console.log('\n✅ Session created:');
  console.log(JSON.stringify(sessionData, null, 2));

  const { sessionId } = sessionData;

  if (!sessionId) {
    console.error('❌ No sessionId in response!');
    process.exit(1);
  }

  // Step 4: GET /sessions/:id to verify
  console.log(`\n🔍 Step 4: Verify session via GET /sessions/${sessionId}`);
  
  const verifyResponse = await fetchOrDie(`${API_BASE}/sessions/${sessionId}`);
  const verifyData = await verifyResponse.json();
  
  console.log('Session details:');
  console.log(JSON.stringify(verifyData, null, 2));

  if (!verifyData.valid) {
    console.error('❌ Session is not valid!');
    process.exit(1);
  }

  // Step 5: POST /jobs twice with x-session-id header
  console.log('\n📤 Step 5: Submit job #1 with x-session-id header (no signature)');
  
  const job1Response = await fetchOrDie(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      model: 'llama-3-8b-instruct',
      input: 'hello 1',
    }),
  });

  const job1Data = await job1Response.json();
  console.log('\n✅ Job #1 submitted:');
  console.log(JSON.stringify(job1Data, null, 2));

  if (job1Data.signingMode !== 'session') {
    console.error(`❌ Expected signingMode: "session", got: "${job1Data.signingMode}"`);
    process.exit(1);
  }

  console.log('\n📤 Step 6: Submit job #2 with x-session-id header (no signature)');
  
  const job2Response = await fetchOrDie(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      model: 'llama-3-8b-instruct',
      input: 'hello 2',
    }),
  });

  const job2Data = await job2Response.json();
  console.log('\n✅ Job #2 submitted:');
  console.log(JSON.stringify(job2Data, null, 2));

  if (job2Data.signingMode !== 'session') {
    console.error(`❌ Expected signingMode: "session", got: "${job2Data.signingMode}"`);
    process.exit(1);
  }

  // Step 7: Verify session usage
  console.log('\n🔍 Step 7: Verify session usage (promptsUsed should be 2)');
  
  const finalVerify = await fetchOrDie(`${API_BASE}/sessions/${sessionId}`);
  const finalData = await finalVerify.json();
  
  console.log('Final session info:');
  console.log(JSON.stringify(finalData, null, 2));

  if (finalData.promptsUsed !== 2) {
    console.error(`❌ Expected promptsUsed: 2, got: ${finalData.promptsUsed}`);
    process.exit(1);
  }

  // Success summary
  console.log('\n' + '='.repeat(70));
  console.log('✅ SESSION SMOKE TEST PASSED');
  console.log('='.repeat(70));
  console.log(`Session ID:       ${sessionId}`);
  console.log(`Submitter:        ${account.address}`);
  console.log(`Expiry:           ${expiry} (${new Date(expiry * 1000).toISOString()})`);
  console.log(`Job #1 ID:        ${job1Data.jobId}`);
  console.log(`Job #1 TX:        ${job1Data.txHash}`);
  console.log(`Job #2 ID:        ${job2Data.jobId}`);
  console.log(`Job #2 TX:        ${job2Data.txHash}`);
  console.log(`Prompts Used:     ${finalData.promptsUsed} / ${finalData.policy?.maxPrompts || 'unlimited'}`);
  console.log(`Signing Mode:     ${job1Data.signingMode}`);
  console.log('='.repeat(70));
  console.log('');

  process.exit(0);
}

// Run with error handling
main().catch((error) => {
  console.error('\n❌ SMOKE TEST FAILED');
  console.error(error);
  process.exit(1);
});












