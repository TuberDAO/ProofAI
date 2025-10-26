import { getDefaultConfig } from 'connectkit';
import { createConfig, http } from 'wagmi';

// MegaETH Testnet Chain Configuration
export const megaethTestnet = {
  id: 6342,
  name: 'MegaETH Testnet',
  network: 'megaeth-testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MEGAETH_RPC || 'https://carrot.megaeth.com/rpc'],
    },
    public: {
      http: ['https://carrot.megaeth.com/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MegaETH Explorer',
      url: 'https://www.oklink.com/megaeth-testnet',
    },
  },
  testnet: true,
} as const;

export const config = getDefaultConfig({
  chains: [megaethTestnet],
  transports: {
    [megaethTestnet.id]: http(),
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  appName: 'PrivateGPT on MegaETH',
  appDescription: 'Submit AI prompts with on-chain attestation',
  appUrl: 'http://localhost:3000',
  appIcon: 'https://family.co/logo.png', // Optional: add your logo URL
});


