# TypeScript Config Refactor - Quick Start

## ✅ What Changed

### Files Created:
1. `tsconfig.base.json` - Shared base config (safe options only)
2. `packages/contracts/tsconfig.json` - Minimal contracts config

### Files Modified:
3. `tsconfig.json` - Root wrapper (project references)
4. `apps/server/tsconfig.json` - Node/CommonJS config (fixed conflicts)
5. `apps/web/tsconfig.json` - Standalone Next.js config
6. All `package.json` files - Added typecheck scripts

### Dependencies Added:
- `@types/node` to root devDependencies

## 🐛 Errors Fixed

✅ **Module system conflicts** - Server now uses CommonJS properly, web uses ESNext  
✅ **Module resolution conflicts** - Server uses "node", web uses "bundler"  
✅ **JSX conflicts** - Web config is standalone, no leakage  
✅ **Output directory conflicts** - Each workspace has its own rootDir/outDir  

## 🚀 Verification Commands

### Quick Check (from root):
```bash
# Typecheck all workspaces
pnpm typecheck

# Build all workspaces
pnpm build

# Run dev servers
pnpm dev
```

### Individual Workspace Checks:

#### Server (Node.js/CommonJS)
```bash
cd apps/server
pnpm typecheck  # ✅ Should pass with no errors
pnpm build      # ✅ Should create dist/ folder
pnpm dev        # ✅ Should start on port 4000
```

#### Web (Next.js/ESNext)
```bash
cd apps/web
pnpm typecheck  # ✅ Should pass with no errors
pnpm build      # ✅ Should build Next.js app
pnpm dev        # ✅ Should start on port 3000
```

#### Contracts (Solidity)
```bash
cd packages/contracts
pnpm compile    # ✅ Should compile contracts with Forge
pnpm test       # ✅ Should run Solidity tests
```

## 📋 If You See Errors

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Clean Build Artifacts
```bash
# Server
rm -rf apps/server/dist

# Web
rm -rf apps/web/.next
```

### Step 3: Restart TypeScript Server
In VS Code/Cursor:
- Press `Cmd/Ctrl + Shift + P`
- Type "TypeScript: Restart TS Server"
- Press Enter

### Step 4: Check Config Files
```bash
# Verify all configs exist
ls -la tsconfig.base.json
ls -la apps/server/tsconfig.json
ls -la apps/web/tsconfig.json
ls -la packages/contracts/tsconfig.json
```

## 📝 What Each Config Does

### `tsconfig.base.json` (root)
- Shared, safe compiler options
- No module/runtime-specific settings
- Extended by all workspaces

### `apps/server/tsconfig.json`
- **Module:** CommonJS (Node.js compatible)
- **Resolution:** Node.js style
- **Output:** Compiles to `dist/`
- **Types:** Node.js types included

### `apps/web/tsconfig.json`
- **Module:** ESNext (Next.js handles bundling)
- **Resolution:** Bundler (Next.js resolver)
- **Output:** No emit (Next.js compiles)
- **Types:** DOM + React types

### `packages/contracts/tsconfig.json`
- Minimal config for editor DX
- Not used for Solidity compilation

## ✨ Benefits

1. ✅ No more TypeScript config conflicts
2. ✅ Each workspace aligned with its runtime
3. ✅ Proper type checking per environment
4. ✅ Clean builds without errors
5. ✅ Better editor integration

## 🎯 Success Criteria

All of these should work without TypeScript errors:

- [ ] `pnpm typecheck` (from root)
- [ ] `pnpm server:typecheck`
- [ ] `pnpm web:typecheck`
- [ ] `pnpm build` (all workspaces)
- [ ] `pnpm dev` (both servers start)
- [ ] No red squiggles in editor for `.ts` and `.tsx` files

## 📚 More Details

See `TSCONFIG_REFACTOR_SUMMARY.md` for full technical details.
See `TYPESCRIPT_VERIFICATION.md` for comprehensive troubleshooting.

