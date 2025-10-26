# TypeScript Configuration Verification Guide

## Quick Verification Commands

Run these commands to verify the TypeScript refactor is working correctly:

### 1. Typecheck All Workspaces (from root)
```bash
pnpm typecheck
```

This will run typecheck on all workspaces that support it.

### 2. Typecheck Individual Workspaces

#### Server (Node.js/CommonJS)
```bash
pnpm server:typecheck
# or
cd apps/server && pnpm typecheck
```

Expected: ✅ No TypeScript errors

#### Web (Next.js/ESNext)
```bash
pnpm web:typecheck
# or
cd apps/web && pnpm typecheck
```

Expected: ✅ No TypeScript errors

#### Contracts (Solidity - TS not applicable)
```bash
cd packages/contracts && pnpm typecheck
```

Expected: ✅ Echo message confirming Solidity is used

### 3. Build Individual Workspaces

#### Server Build
```bash
cd apps/server && pnpm build
```

Expected:
- ✅ Compiles to `dist/` directory
- ✅ No TypeScript compilation errors
- ✅ Generated `.js`, `.d.ts`, and `.js.map` files

#### Web Build
```bash
cd apps/web && pnpm build
```

Expected:
- ✅ Next.js builds successfully
- ✅ No TypeScript errors during build
- ✅ Creates `.next/` directory

#### Contracts Compile
```bash
cd packages/contracts && pnpm compile
```

Expected:
- ✅ Forge compiles successfully
- ✅ Creates `out/` directory with compiled contracts

### 4. Start Dev Servers

#### Server Dev Server
```bash
cd apps/server && pnpm dev
```

Expected:
- ✅ Server starts on port 4000
- ✅ No TypeScript errors
- ✅ Hot reload works with tsx

#### Web Dev Server
```bash
cd apps/web && pnpm dev
```

Expected:
- ✅ Next.js dev server starts on port 3000
- ✅ No TypeScript configuration conflicts
- ✅ Fast refresh works

#### Both Together (from root)
```bash
pnpm dev
```

Expected:
- ✅ Both servers start concurrently
- ✅ No TypeScript errors in either workspace

## Troubleshooting

### If You See TypeScript Errors:

#### "Cannot find module" errors
```bash
# Install dependencies
pnpm install
```

#### "Configuration file not found"
```bash
# Verify tsconfig files exist:
ls -la tsconfig.base.json
ls -la apps/server/tsconfig.json
ls -la apps/web/tsconfig.json
ls -la packages/contracts/tsconfig.json
```

#### Module resolution errors in server
- Check `apps/server/tsconfig.json` has `"moduleResolution": "node"`
- Check `apps/server/tsconfig.json` has `"module": "commonjs"`

#### JSX or module errors in web
- Check `apps/web/tsconfig.json` has `"jsx": "preserve"`
- Check `apps/web/tsconfig.json` has `"moduleResolution": "bundler"`

#### Path resolution errors
- Server imports should use relative paths: `./config.js`, `./blockchain.js`
- Web imports should work with `@/*` paths (configured in web tsconfig)

### If Build Fails:

1. **Clean build artifacts:**
```bash
# Server
cd apps/server && rm -rf dist && pnpm build

# Web
cd apps/web && rm -rf .next && pnpm build
```

2. **Check for conflicting dependencies:**
```bash
# Verify typescript version is consistent
pnpm list typescript
```

3. **Restart TypeScript server in your editor:**
- VS Code: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
- Cursor: Same as VS Code

## What to Check

### ✅ Server Workspace
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` creates `dist/` folder
- [ ] `pnpm dev` starts without TS errors
- [ ] Editor shows no TypeScript errors in `.ts` files
- [ ] Imports resolve correctly (with `.js` extension)

### ✅ Web Workspace
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm dev` starts without TS config warnings
- [ ] Editor shows no TypeScript errors in `.tsx` files
- [ ] JSX syntax highlighted correctly

### ✅ Contracts Workspace
- [ ] `pnpm compile` succeeds (Solidity)
- [ ] `pnpm test` passes (Solidity tests)
- [ ] No TypeScript interference with Foundry

### ✅ Root Level
- [ ] `pnpm typecheck` runs for all workspaces
- [ ] `pnpm build` builds all workspaces
- [ ] `pnpm dev` starts both servers
- [ ] No tsconfig conflicts logged

## Expected Behavior

### Server (apps/server)
- **Module System:** CommonJS (`require`/`module.exports` compatible)
- **Module Resolution:** Node.js style
- **Output:** JavaScript files in `dist/` with declaration files
- **Runtime:** Node.js 18+

### Web (apps/web)
- **Module System:** ESNext (Next.js handles bundling)
- **Module Resolution:** Bundler (Next.js resolver)
- **Output:** Next.js builds to `.next/` (no TS compilation needed)
- **Runtime:** Browser + Node.js (SSR)

### Contracts (packages/contracts)
- **Language:** Solidity (not TypeScript)
- **Compiler:** Foundry's Forge
- **Output:** Compiled contracts in `out/`
- **Runtime:** EVM (Ethereum Virtual Machine)

## Additional Dependencies Added

- **Root package.json:**
  - `@types/node`: ^20.11.10 (for TypeScript Node.js types)

All other dependencies remain unchanged.

## Where to Look for Errors

1. **Terminal output** when running `pnpm typecheck` or `pnpm build`
2. **Editor problems panel** (VS Code/Cursor)
3. **Server logs** when running `pnpm dev`
4. **Browser console** when running web app

If you see TypeScript errors after following this guide, check:
- Did you run `pnpm install`?
- Are you in the correct workspace directory?
- Did the tsconfig files get created correctly?
- Is your editor's TypeScript server up to date?

