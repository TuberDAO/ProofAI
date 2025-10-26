# 🎉 Hardhat Deployment - READY

## ✅ What's Been Set Up

1. **Hardhat v2.26.3** installed with full toolbox support
2. **JobRegistry** compiled successfully
3. **Deploy script** created at `packages/contracts/scripts/deploy.ts`
4. **MegaETH network** configured (Chain ID: 6342)
5. **Root commands** added: `contracts:compile`, `contracts:deploy:megaeth`
6. **TypeScript** properly configured for Hardhat

---

## ⚠️ BEFORE YOU DEPLOY

You must set up environment variables (I cannot create .env files due to security):

### 1. Create `packages/contracts/.env`:

```bash
MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x_prefix
```

### 2. Create `apps/server/.env`:

```bash
PORT=4000
MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc
JOB_REGISTRY_ADDRESS=
SERVER_WALLET_PRIVATE_KEY=0x...
PROVIDER_ADDRESS=0x...
ALLOWED_ORIGIN=http://localhost:3000
MIN_JOB_ETH=0.00001
MAX_JOB_ETH=0.01
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

**⚠️ Use BURNER wallets with testnet ETH!**

---

## 🚀 NEXT: Deploy to MegaETH

### Step 1: Set Environment Variables (see above)

### Step 2: Deploy

```bash
# From root directory
pnpm contracts:deploy:megaeth
```

**Or from contracts directory:**

```bash
cd packages/contracts
pnpm hh:deploy:megaeth
```

### Step 3: Copy Deployed Address

The script will print:

```
JobRegistry deployed at: 0xYourAddressHere
```

### Step 4: Update Server Config

Add the address to `apps/server/.env`:

```bash
JOB_REGISTRY_ADDRESS=0xYourAddressHere
```

### Step 5: Run the Stack

```bash
pnpm dev
```

### Step 6: Test

Open http://localhost:3000 and submit a job!

---

## 📊 Configuration Summary

| Component | Value |
|-----------|-------|
| Hardhat Version | 2.26.3 |
| Solidity Version | 0.8.23 |
| Network | MegaETH Testnet |
| Chain ID | 6342 |
| RPC URL | https://carrot.megaeth.com/rpc |
| Contract | JobRegistry |
| Deploy Script | packages/contracts/scripts/deploy.ts |

---

## 🎯 Success Criteria

After following the steps above, you should see:

✅ `pnpm contracts:compile` succeeds  
✅ `pnpm contracts:deploy:megaeth` prints deployment address  
✅ `apps/server/.env` has `JOB_REGISTRY_ADDRESS`  
✅ `pnpm dev` starts both servers  
✅ Web UI at http://localhost:3000 works  
✅ Job submission returns attestation + tx hash  

---

## 📖 Full Documentation

See `DEPLOYMENT_GUIDE.md` for complete step-by-step instructions and troubleshooting.

**You're ready! Set up your .env files and deploy!** 🚀

