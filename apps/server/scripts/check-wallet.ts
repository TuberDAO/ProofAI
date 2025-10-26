#!/usr/bin/env tsx
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../src/config/env.js';

console.log('\n🔐 Wallet Address Verification\n');
console.log('─────────────────────────────────────────────────────────────────');

try {
  // Derive address from private key
  const account = privateKeyToAccount(env.serverWalletPrivateKey);
  const derivedAddress = account.address;

  console.log(`\nDerived address:  ${derivedAddress}`);
  console.log(`PROVIDER_ADDRESS: ${env.providerAddress}`);
  console.log('');

  // Compare addresses (case-insensitive)
  const isMatch =
    derivedAddress.toLowerCase() === env.providerAddress.toLowerCase();

  if (isMatch) {
    console.log('✅ Status: MATCH');
    console.log('');
    console.log('The addresses match! Your wallet is correctly configured.');
    console.log('');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('');
    console.log('👉 Next: Run `pnpm dev` to start the stack');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ Status: MISMATCH');
    console.log('');
    console.log('The PROVIDER_ADDRESS does not match the derived address.');
    console.log('');
    console.log('⚠️  ACTION REQUIRED:');
    console.log('');
    console.log('Update apps/server/.env with the correct address:');
    console.log('');
    console.log(`PROVIDER_ADDRESS=${derivedAddress}`);
    console.log('');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('');
    console.log('💡 Tip: PROVIDER_ADDRESS should be the public address that');
    console.log('    corresponds to your SERVER_WALLET_PRIVATE_KEY.');
    console.log('');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Wallet verification failed:');
  console.error('');
  console.error((error as Error).message);
  console.error('');
  console.log('─────────────────────────────────────────────────────────────────');
  console.error('');
  process.exit(1);
}

