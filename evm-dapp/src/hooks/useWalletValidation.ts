import { useAccount } from 'wagmi'
import { CONTRACTS } from '@/contracts'
import { NETWORK_CONFIG } from '@/constants'

export const useWalletValidation = () => {
  const account = useAccount()
  
  const validateWalletAndContracts = () => {
    // Check if wallet is connected
    if (account.status !== 'connected') {
      alert('Please connect your wallet first')
      return false
    }

    // Check if user is on the correct network (Anvil)
    if (account.chainId !== NETWORK_CONFIG.ANVIL.chainId) {
      alert(`Please switch to Anvil network (Chain ID: ${NETWORK_CONFIG.ANVIL.chainId})`)
      return false
    }

    // Check if contracts are ready
    if (!CONTRACTS.BTC_COLLATERAL_LOAN) {
      alert('Contracts not ready. Please check configuration.')
      return false
    }

    return true
  }

  return {
    validateWalletAndContracts,
    isConnected: account.status === 'connected',
    isCorrectNetwork: account.chainId === NETWORK_CONFIG.ANVIL.chainId,
    areContractsReady: !!CONTRACTS.BTC_COLLATERAL_LOAN,
    account
  }
}
