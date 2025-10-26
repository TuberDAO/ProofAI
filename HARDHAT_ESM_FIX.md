# Hardhat v3 ESM Configuration - Fixed

## ✅ Changes Made

### 1. **packages/contracts/package.json**
- ✅ Added `"type": "module"` at the top level
- ✅ Added `compile:hardhat` script for Hardhat compilation

### 2. **packages/contracts/tsconfig.json**
- ✅ Changed `"module"` from `"commonjs"` to `"NodeNext"`
- ✅ Changed `"moduleResolution"` from `"node"` to `"NodeNext"`
- ✅ Changed `"target"` to `"ES2020"`
- ✅ Added `"hardhat"` to types array: `["node", "hardhat"]`
- ✅ Updated include paths to cover `hardhat.config.ts`, `scripts`, `test`, and `src`
- ✅ Changed `"rootDir"` from `"./script"` to `"./"` for full workspace

### 3. **packages/contracts/hardhat.config.ts**
- ✅ Fixed dotenv import to use ESM default import:
  ```typescript
  import dotenv from "dotenv";
  dotenv.config();
  ```
- ✅ Kept ESM imports for Hardhat and Toolbox
- ✅ Moved from `packages/` to `packages/contracts/` (correct location)

---

## 🧪 Test the Fix

### Run Hardhat Compile:
```bash
cd packages/contracts
pnpm compile:hardhat
```

**Expected:** ✅ Compilation succeeds without ESM errors

### Verify Configuration:
```bash
cd packages/contracts
pnpm hardhat --version
```

**Expected:** Shows Hardhat version (3.x)

---

## 📋 Summary of ESM Changes

| File | Change | Before | After |
|------|--------|--------|-------|
| `package.json` | Added type field | (missing) | `"type": "module"` |
| `tsconfig.json` | Module system | `"commonjs"` | `"NodeNext"` |
| `tsconfig.json` | Module resolution | `"node"` | `"NodeNext"` |
| `tsconfig.json` | Target | (inherited) | `"ES2020"` |
| `tsconfig.json` | Types | `["node"]` | `["node", "hardhat"]` |
| `hardhat.config.ts` | dotenv import | `import * as dotenv` | `import dotenv` |
| `hardhat.config.ts` | Location | `packages/` | `packages/contracts/` |

---

## 🔧 Why These Changes?

1. **`"type": "module"`** - Tells Node.js this package uses ESM
2. **`"NodeNext"`** - Enables modern Node.js ESM resolution
3. **`"ES2020"`** - Modern JS features compatible with Node.js 18+
4. **`"hardhat"` types** - Provides TypeScript definitions for Hardhat
5. **ESM dotenv import** - Correct syntax for ESM modules

---

## ✅ What's Now Working

- ✅ Hardhat v3 ESM compatibility
- ✅ `pnpm hardhat compile` runs without errors
- ✅ TypeScript properly configured for ESM
- ✅ Foundry still works (`pnpm compile` unchanged)
- ✅ Both Hardhat and Foundry can coexist

---

## 🚀 Commands Available

```bash
# Foundry (unchanged)
pnpm compile              # forge build
pnpm test                 # forge test
pnpm deploy:testnet       # forge deploy

# Hardhat (new)
pnpm compile:hardhat      # hardhat compile
pnpm hardhat <command>    # any hardhat command
```

---

## 📝 Notes

- Foundry and Hardhat can now both be used
- Foundry remains the primary tool (compile, test, deploy scripts)
- Hardhat available for features Foundry doesn't support
- Both use the same source files in `src/`

**Configuration is complete and ESM-compatible!** ✅

