import { Router } from 'express'
import { createPublicClient, http, parseEther, formatEther } from 'viem'
import { CONTRACTS, BTC_COLLATERAL_LOAN_ABI } from '../contracts'
import { NETWORK_CONFIG } from '../config'

const router = Router()

// Create EVM client for contract interaction
const client = createPublicClient({
  transport: http(NETWORK_CONFIG.ANVIL.rpcUrl),
  chain: {
    id: NETWORK_CONFIG.ANVIL.chainId,
    name: 'Anvil Local',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [NETWORK_CONFIG.ANVIL.rpcUrl] },
      public: { http: [NETWORK_CONFIG.ANVIL.rpcUrl] }
    }
  }
})

/**
 * Prepare collateral information for borrower
 * POST /api/prepare-collateral
 */
router.post('/', async (req, res) => {
  try {
    const { loanAmount, borrowerBtcPubkey, preimageHashBorrower } = req.body

    // Validate input
    if (!loanAmount || !borrowerBtcPubkey || !preimageHashBorrower) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'loanAmount, borrowerBtcPubkey, and preimageHashBorrower are required'
      })
    }

    // Validate BTC public key format (64 characters)
    if (borrowerBtcPubkey.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid BTC public key',
        message: 'BTC public key must be exactly 64 characters'
      })
    }

    // Validate preimage hash format (0x + 64 characters)
    if (!preimageHashBorrower.startsWith('0x') || preimageHashBorrower.length !== 66) {
      return res.status(400).json({
        success: false,
        error: 'Invalid preimage hash',
        message: 'Preimage hash must be 0x + 64 hex characters'
      })
    }

    // Get contract parameters
    const contractAddress = CONTRACTS.BTC_COLLATERAL_LOAN
    if (!contractAddress) {
      return res.status(500).json({
        success: false,
        error: 'Contract not deployed',
        message: 'BTC Collateral Loan contract is not deployed'
      })
    }

    // Read contract parameters
    const [originationFeePercentage, timelockBtcEscrow, lenderBtcPubkey] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: BTC_COLLATERAL_LOAN_ABI,
        functionName: 'ORIGIN_FEE_PERCENTAGE'
      }),
      client.readContract({
        address: contractAddress,
        abi: BTC_COLLATERAL_LOAN_ABI,
        functionName: 'timelockBtcEscrow'
      }),
      client.readContract({
        address: contractAddress,
        abi: BTC_COLLATERAL_LOAN_ABI,
        functionName: 'lenderBtcPubkey'
      })
    ])

    // Calculate origination fee: parsing as ETH, but in Rootstock, this is rBTC
    const loanAmountWei = parseEther(loanAmount.toString())
    const originationFeeWei = (loanAmountWei * BigInt(originationFeePercentage)) / BigInt(100)
    const totalAmountWei = loanAmountWei + originationFeeWei

    // Convert to readable format
    const loanAmountEth = formatEther(loanAmountWei)
    const originationFeeEth = formatEther(originationFeeWei)
    const totalAmountEth = formatEther(totalAmountWei)

    // Call python-api to generate Bitcoin address
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://python-api:8001'
    
    try {
      const pythonResponse = await fetch(`${pythonApiUrl}/vaultero/nums-p2tr-addr-0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          borrower_pubkey: borrowerBtcPubkey,
          lender_pubkey: lenderBtcPubkey,
          preimage_hash_borrower: preimageHashBorrower.startsWith('0x') ? preimageHashBorrower.slice(2) : preimageHashBorrower,
          borrower_timelock: Math.floor(Number(timelockBtcEscrow) / 20)
        })
      })

      if (!pythonResponse.ok) {
        throw new Error(`Python API error: ${pythonResponse.status}`)
      }

      const pythonData = await pythonResponse.json() as any

      // Calculate suggested total with 500 sats buffer
      const suggestedTotalSats = Math.ceil(parseFloat(totalAmountEth) * 100000000) + 500 // Convert to sats + 500 buffer
      const suggestedTotalBtc = suggestedTotalSats / 100000000 // Convert to BTC and round to 8 decimal places
      const suggestedTotalBtcRounded = Number(suggestedTotalBtc.toFixed(8))

      return res.json({
        success: true,
        data: {
          // Contract parameters
          originationFeePercentage: Number(originationFeePercentage),
          timelockBtcEscrow: Number(timelockBtcEscrow),
          
          // Amount calculations
          loanAmount: {
            wei: loanAmountWei.toString(),
            eth: loanAmountEth,
            sats: Math.ceil(parseFloat(loanAmountEth) * 100000000)
          },
          originationFee: {
            wei: originationFeeWei.toString(),
            eth: originationFeeEth,
            sats: Math.ceil(parseFloat(originationFeeEth) * 100000000)
          },
          totalAmount: {
            wei: totalAmountWei.toString(),
            eth: totalAmountEth,
            sats: Math.ceil(parseFloat(totalAmountEth) * 100000000)
          },
          suggestedTotal: {
            sats: suggestedTotalSats,
            btc: suggestedTotalBtcRounded,
            note: 'Includes 500 sats buffer for Bitcoin fees'
          },
          
          // Bitcoin address from python-api
          bitcoinAddress: pythonData.nums_p2tr_addr,
          
          // Input values for loan request
          loanRequestData: {
            amount: loanAmountEth,
            btcAddress: pythonData.nums_p2tr_addr,
            btcPubkey: borrowerBtcPubkey,
            preimageHashBorrower: preimageHashBorrower,
            txid_p2tr0: 'TBD', // To be filled by borrower after sending BTC
            vout_p2tr0: 0 // To be filled by borrower after sending BTC
          }
        }
      })

    } catch (pythonError) {
      console.error('Python API error:', pythonError)
      return res.status(500).json({
        success: false,
        error: 'Failed to generate Bitcoin address',
        message: 'Could not connect to Python API for address generation',
        details: pythonError instanceof Error ? pythonError.message : 'Unknown error'
      })
    }

  } catch (error) {
    console.error('Error preparing collateral:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to prepare collateral',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

export default router
