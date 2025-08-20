import { NETWORK_CONFIG } from '@/constants'

// Shared utility for network switching
export const switchToAnvil = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: NETWORK_CONFIG.ANVIL.chainIdHex,
          chainName: NETWORK_CONFIG.ANVIL.name,
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
          rpcUrls: [NETWORK_CONFIG.ANVIL.rpcUrl],
          blockExplorerUrls: [NETWORK_CONFIG.ANVIL.blockExplorerUrl],
        }],
      })
    } catch (error) {
      console.error('Failed to add Anvil network:', error)
      alert('Failed to add Anvil network. Please add it manually.')
    }
  } else {
    alert('Please install MetaMask or another Web3 wallet.')
  }
}
