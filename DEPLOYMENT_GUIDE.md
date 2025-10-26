# MegaETH Deployment Guide - Hardhat

## ✅ Setup Complete

Hardhat is now configured and ready to deploy JobRegistry to MegaETH testnet (Chain ID: 6342).

---

## 📋 Prerequisites

Before deployment, you need:

1. **MegaETH testnet RPC URL** - Default: `https://carrot.megaeth.com/rpc`
2. **Deployer private key** - A BURNER wallet with testnet ETH
3. **Server wallet private key** - Another BURNER wallet with testnet ETH (can be same as deployer)

**⚠️ CRITICAL: Use BURNER wallets ONLY. Never use production keys!**

---

## 🔧 Step 1: Configure Environment

### A. Contracts Environment (`packages/contracts/.env`)

Create or update `packages/contracts/.env`:

```bash
MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x_prefix
```

### B. Server Environment (`apps/server/.env`)

Create or update `apps/server/.env`:

```bash
PORT=4000
MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc
JOB_REGISTRY_ADDRESS=           # Will be filled after deployment
SERVER_WALLET_PRIVATE_KEY=0x... # With 0x prefix
PROVIDER_ADDRESS=0x...          # Your wallet address with 0x
ALLOWED_ORIGIN=http://localhost:3000
MIN_JOB_ETH=0.00001
MAX_JOB_ETH=0.01
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

---

## 🚀 Step 2: Deploy to MegaETH Testnet

### Option A: Deploy from Root

```bash
# Compile contracts
pnpm contracts:compile

# Deploy to MegaETH
pnpm contracts:deploy:megaeth
```

### Option B: Deploy from Contracts Directory

```bash
cd packages/contracts

# Compile
pnpm hh:compile

# Deploy
pnpm hh:deploy:megaeth
```

---

## 📤 Step 3: Capture Deployed Address

The deploy script will print:

```
JobRegistry deployed at: 0x1234567890abcdef...
```

**Copy this address!**

---

## ✏️ Step 4: Update Server .env

Add the deployed address to `apps/server/.env`:

```bash
JOB_REGISTRY_ADDRESS=0x1234567890abcdef...
```

---

## ▶️ Step 5: Run the Stack

```bash
# From root directory
pnpm dev
```

This starts:
- Server on **http://localhost:4000**
- Web on **http://localhost:3000**

---

## 🧪 Step 6: Test End-to-End

1. Open **http://localhost:3000** in your browser
2. Enter a test prompt (e.g., "What is quantum computing?")
3. Click "🚀 Run Private AI"
4. Verify:
   - Job ID is returned
   - Attestation hash is shown
   - Transaction link works
   - Security details show artifact preview

---

## 📊 Available Commands

### From Root:
- `pnpm contracts:compile` - Compile with Hardhat
- `pnpm contracts:deploy:megaeth` - Deploy to MegaETH
- `pnpm dev` - Run server + web

### From `packages/contracts`:
- `pnpm hh:compile` - Compile contracts
- `pnpm hh:deploy:megaeth` - Deploy to MegaETH
- `pnpm compile` - Compile with Foundry (still works)
- `pnpm test` - Run Foundry tests

---

## 🔍 Troubleshooting

### "Error: missing required environment variable"
- Check that `MEGAETH_RPC_URL` and `DEPLOYER_PRIVATE_KEY` are set in `packages/contracts/.env`

### "Error: insufficient funds"
- Ensure your deployer wallet has testnet ETH
- Get testnet ETH from MegaETH faucet (check docs.megaeth.com)

### "Error: network does not exist"
- Verify `MEGAETH_RPC_URL` is correct
- Try: `https://carrot.megaeth.com/rpc`

### "Nothing to compile"
- Run `pnpm hh:compile` first to ensure contracts are compiled

### Deployment succeeds but server can't find contract
- Verify `JOB_REGISTRY_ADDRESS` in `apps/server/.env` matches deployed address
- Ensure address includes `0x` prefix

---

## 📁 Project Structure

```
packages/contracts/
├── src/
│   └── JobRegistry.sol         # Source contract
├── scripts/
│   └── deploy.ts               # Hardhat deployment script
├── hardhat.config.ts           # Hardhat configuration
├── .env                        # Environment variables (gitignored)
└── package.json                # Scripts: hh:compile, hh:deploy:megaeth

apps/server/
└── .env                        # JOB_REGISTRY_ADDRESS goes here
```

---

## 🎯 What's Configured

✅ Hardhat v2.26.3 (stable, full toolbox support)  
✅ Hardhat Toolbox (ethers v6, testing, verification)  
✅ JobRegistry compilation from `src/` directory  
✅ MegaETH testnet configuration (Chain ID: 6342)  
✅ TypeScript deployment script  
✅ Root convenience commands  
✅ CommonJS module system (Hardhat v2 compatible)  

---

## 🔗 Resources

- **MegaETH Docs:** https://docs.megaeth.com
- **Block Explorer:** https://www.oklink.com/megaeth-testnet
- **Hardhat Docs:** https://hardhat.org

---

## 📝 Next Steps After Deployment

1. ✅ Copy deployed address to `apps/server/.env`
2. ✅ Run `pnpm dev` from root
3. ✅ Open http://localhost:3000
4. ✅ Submit a test job
5. ✅ Verify transaction on explorer

**You're ready to deploy!** 🚀

