# Smart Contracts

This package contains the Solidity smart contracts for PrivateGPT on MegaETH.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed

## Setup

1. Install Foundry dependencies:
```bash
forge install foundry-rs/forge-std
```

2. Copy `env.example` to `.env` and fill in your values:
```bash
cp env.example .env
```

**⚠️ SECURITY:** Use a BURNER wallet for testnet deployment ONLY. Never use production keys!

Required values:
- `MEGAETH_RPC_URL`: https://carrot.megaeth.com/rpc (MegaETH testnet, Chain ID 6342)
- `DEPLOYER_PRIVATE_KEY`: Your burner wallet private key (without `0x` prefix)

## Commands

### Compile contracts
```bash
pnpm compile
# or
forge build
```

### Run tests
```bash
pnpm test
# or
forge test -vvv
```

### Deploy to MegaETH testnet
```bash
pnpm deploy:testnet
# or
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $MEGAETH_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
```

After deployment, copy the `JOB_REGISTRY_ADDRESS` from the output to `apps/server/.env`.

The deploy script will print:
- Contract address
- Chain ID (should be 6342 for MegaETH testnet)
- Explorer link to view the contract
- Next steps for configuring the server

## Contract: JobRegistry

### Functions

- `submitJob(bytes32 attestationHash, address provider) payable returns (uint256 jobId)`
  - Submit a new job with attestation hash
  - Requires payment (msg.value > 0)
  - Returns the new job ID

- `getJob(uint256 jobId) view returns (address payer, address provider, bytes32 attestationHash, uint256 amount, uint256 timestamp)`
  - Retrieve job details by ID

### Events

- `JobSubmitted(uint256 indexed jobId, address indexed payer, address indexed provider, bytes32 attestationHash, uint256 amount, uint256 timestamp)`
  - Emitted when a new job is submitted

