// Network configuration
export const NETWORK_CONFIG = {
  ANVIL: {
    chainId: 31337,
    rpcUrl: process.env.ANVIL_RPC_URL || 'http://127.0.0.1:8545',
  },
} as const
