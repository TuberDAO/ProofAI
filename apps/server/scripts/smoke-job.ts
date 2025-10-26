#!/usr/bin/env tsx
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const EXPLORER_BASE = 'https://www.oklink.com/megaeth-testnet';

interface JobResponse {
  jobId: string;
  attestationHash: string;
  txHash: string;
  artifactPreview?: unknown;
}

async function submitSmokeJob(): Promise<void> {
  console.log('\n🧪 Running smoke test...\n');
  console.log(`Server: ${SERVER_URL}`);
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('');

  const payload = {
    prompt: 'Test private job',
    amountEth: '0.0001',
  };

  try {
    console.log('📤 Submitting test job...');
    console.log(`   Prompt: "${payload.prompt}"`);
    console.log(`   Amount: ${payload.amountEth} ETH`);
    console.log('');

    const response = await fetch(`${SERVER_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data: JobResponse = await response.json();

    console.log('✅ SMOKE TEST PASSED');
    console.log('');
    console.log('Job submitted successfully:');
    console.log(`   Job ID: ${data.jobId}`);
    console.log(`   Attestation Hash: ${data.attestationHash}`);
    console.log(`   Transaction Hash: ${data.txHash}`);
    console.log('');
    console.log('🔗 View on Explorer:');
    console.log(`   ${EXPLORER_BASE}/tx/${data.txHash}`);
    console.log('');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('');
    console.log('👉 Next: Open http://localhost:3000 and submit a job in the UI.');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ SMOKE TEST FAILED');
    console.error('');
    console.error('Error:', (error as Error).message);
    console.error('');

    // Provide helpful debugging info
    if ((error as Error).message.includes('ECONNREFUSED')) {
      console.error('Troubleshooting:');
      console.error('   • Is the server running? Try: pnpm dev');
      console.error('   • Check that PORT=4000 in apps/server/.env');
      console.error('');
    } else if ((error as Error).message.includes('HTTP 400')) {
      console.error('Troubleshooting:');
      console.error('   • Check input validation rules');
      console.error('   • Ensure prompt is 1-8000 characters');
      console.error('   • Ensure amountEth is between MIN_JOB_ETH and MAX_JOB_ETH');
      console.error('');
    } else if ((error as Error).message.includes('HTTP 500')) {
      console.error('Troubleshooting:');
      console.error('   • Check server logs for detailed error');
      console.error('   • Verify all environment variables are set');
      console.error('   • Ensure SERVER_WALLET_PRIVATE_KEY has testnet ETH');
      console.error('');
    }

    console.error('─────────────────────────────────────────────────────────────────');
    console.error('');

    process.exit(1);
  }
}

// Check if server is required but not provided
if (!process.env.SERVER_WALLET_PRIVATE_KEY && !process.argv.includes('--skip-check')) {
  console.warn('⚠️  Warning: SERVER_WALLET_PRIVATE_KEY not set in apps/server/.env');
  console.warn('   The smoke test will likely fail without a funded wallet.');
  console.warn('');
  console.warn('   To skip this check, run with: --skip-check');
  console.warn('');
}

submitSmokeJob();

