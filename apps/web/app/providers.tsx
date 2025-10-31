'use client';

import { createConfig, http } from 'wagmi';
import { injected } from '@wagmi/connectors';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// MegaETH Testnet configuration
const chainId = 6342;
const rpc = 'https://carrot.megaeth.com/rpc';

const megaeth = {
  id: chainId,
  name: 'MegaETH Testnet',
  network: 'megaeth-testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [rpc] },
    public: { http: [rpc] },
  },
  blockExplorers: {
    default: {
      name: 'MegaETH Explorer',
      url: 'https://www.oklink.com/megaeth-testnet',
    },
  },
  testnet: true,
} as const;

// Create wagmi config - client-only, injected connector only
const config = createConfig({
  chains: [megaeth],
  ssr: false,
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [megaeth.id]: http(rpc),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
