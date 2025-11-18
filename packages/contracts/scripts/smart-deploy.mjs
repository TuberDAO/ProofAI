#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contractsRoot = join(__dirname, '..');
const serverEnvPath = join(contractsRoot, '..', '..', 'apps', 'server', '.env');

// Load environment variables
const envPath = join(contractsRoot, '.env');
if (!existsSync(envPath)) {
  console.error('❌ Missing packages/contracts/.env file!');
  console.error('');
  console.error('Please create it with:');
  console.error('  cp packages/contracts/env.example packages/contracts/.env');
  console.error('');
  console.error('And fill in:');
  console.error('  MEGAETH_RPC_URL=https://timothy.megaeth.com/rpc');
  console.error('  DEPLOYER_PRIVATE_KEY=your_private_key_here');
  process.exit(1);
}

dotenv.config({ path: envPath });

// Check required environment variables
if (!process.env.MEGAETH_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY) {
  console.error('❌ Missing required environment variables in packages/contracts/.env:');
  if (!process.env.MEGAETH_RPC_URL) console.error('  - MEGAETH_RPC_URL');
  if (!process.env.DEPLOYER_PRIVATE_KEY) console.error('  - DEPLOYER_PRIVATE_KEY');
  console.error('');
  console.error('Please fill these in before deploying.');
  process.exit(1);
}

// Helper to run a command and capture output
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔄 Running: ${command} ${args.join(' ')}\n`);
    
    const proc = spawn(command, args, {
      cwd: cwd || contractsRoot,
      stdio: 'pipe',
      shell: true,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}\n${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Update or append JOB_REGISTRY_ADDRESS in apps/server/.env
function updateServerEnv(address) {
  let envContent = '';
  
  if (existsSync(serverEnvPath)) {
    envContent = readFileSync(serverEnvPath, 'utf8');
  }

  const key = 'JOB_REGISTRY_ADDRESS';
  const newLine = `${key}=${address}`;
  
  // Check if the key exists
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(envContent)) {
    // Replace existing line
    envContent = envContent.replace(regex, newLine);
  } else {
    // Append new line
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `${newLine}\n`;
  }

  writeFileSync(serverEnvPath, envContent, 'utf8');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Smart Deploy: Compile → Deploy → Configure            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    // Step 1: Compile contracts
    console.log('\n📦 Step 1/3: Compiling contracts...\n');
    await runCommand('pnpm', ['run', 'hh:compile']);
    console.log('\n✅ Compilation successful!\n');

    // Step 2: Deploy to MegaETH
    console.log('\n🚀 Step 2/3: Deploying to MegaETH testnet...\n');
    const deployOutput = await runCommand('pnpm', ['run', 'hh:deploy:megaeth']);

    // Step 3: Parse the deployed address
    console.log('\n🔍 Step 3/3: Extracting deployed address...\n');
    const addressMatch = deployOutput.match(/JobRegistry deployed at: (0x[a-fA-F0-9]{40})/);
    
    if (!addressMatch) {
      throw new Error('Could not find deployed contract address in output');
    }

    const deployedAddress = addressMatch[1];
    console.log(`✅ Found contract address: ${deployedAddress}\n`);

    // Step 4: Update apps/server/.env
    console.log('📝 Updating apps/server/.env...\n');
    updateServerEnv(deployedAddress);
    console.log(`✅ Updated ${serverEnvPath}\n`);

    // Success summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    🎉 DEPLOYMENT SUCCESSFUL!                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ JobRegistry deployed at: ${deployedAddress}`);
    console.log(`✅ apps/server/.env updated with JOB_REGISTRY_ADDRESS`);
    console.log('');
    console.log('👉 Next steps:');
    console.log('   1. Review apps/server/.env and ensure all variables are set');
    console.log('   2. Run: pnpm dev');
    console.log('   3. Open: http://localhost:3000');
    console.log('   4. Submit a test prompt to verify the end-to-end flow');
    console.log('');
    console.log(`🔗 View contract on explorer:`);
    console.log(`   https://www.oklink.com/megaeth-testnet/address/${deployedAddress}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();

