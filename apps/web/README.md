# Web

Next.js 14+ web application for PrivateGPT on MegaETH with App Router.

## Prerequisites

- Node.js >= 18
- pnpm >= 8

## Setup

1. Copy `env.local.example` to `.env.local`:
```bash
cp env.local.example .env.local
```

2. Configure environment variables:
   - `NEXT_PUBLIC_SERVER_BASE_URL`: Backend server URL (default: http://localhost:4000)
   - `NEXT_PUBLIC_EXPLORER_BASE_URL`: Block explorer base URL for MegaETH testnet

3. Install dependencies:
```bash
pnpm install
```

## Development

Run the development server:
```bash
pnpm dev
```

Open http://localhost:3000 in your browser.

## Build

Create a production build:
```bash
pnpm build
```

Start the production server:
```bash
pnpm start
```

## Features

- Modern, responsive UI with dark mode support
- Submit AI prompts with configurable ETH payment
- Real-time job submission feedback
- Display job ID, attestation hash, and transaction link
- Direct links to MegaETH testnet block explorer

## Tech Stack

- Next.js 14+ (App Router)
- React 18
- TypeScript (strict mode)
- Tailwind CSS
- Server-side rendering and client-side interactivity

## Usage

1. Enter your AI prompt in the textarea
2. Optionally adjust the ETH amount (default: 0.0001)
3. Click "Run Private AI"
4. View the results including job ID and transaction hash
5. Click the transaction link to view on the block explorer

