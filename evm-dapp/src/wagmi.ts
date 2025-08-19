import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { baseAccount, injected, walletConnect } from 'wagmi/connectors'

// Create anvil chain configuration
const anvilChain = {
  id: 31337,
  name: 'Anvil Local',
  network: 'anvil',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ANVIL_RPC_URL || 'http://127.0.0.1:8545'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_ANVIL_RPC_URL || 'http://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Anvil Explorer',
      url: 'http://localhost:8545',
    },
  },
} as const

export function getConfig() {
  return createConfig({
    chains: [anvilChain], // Only include Anvil for local development
    connectors: [
      injected(),
      baseAccount(),
      walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [anvilChain.id]: http(),
    },
  })
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
