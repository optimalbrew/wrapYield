'use client'

import { useState, useEffect } from 'react'
import { useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { BTC_COLLATERAL_LOAN_ABI, CONTRACTS } from '@/contracts'
import { ACCOUNTS, CONTRACT_CONFIG, BTC_PUBKEY_PLACEHOLDER, NETWORK_CONFIG } from '@/constants'
import Link from 'next/link'
import { useWalletValidation } from '@/hooks/useWalletValidation'
import { switchToAnvil } from '@/utils/networkUtils'
import SignatureVerification from '@/components/SignatureVerification'
import { SignatureData } from '@/utils/signatureVerification'

// Loan status enum mapping
const LOAN_STATUS_MAP = {
  0: 'Requested',
  1: 'Offered', 
  2: 'Active',
  3: 'RefundedToLender',
  4: 'RepaymentInProgress',
  5: 'Repaid',
  6: 'Defaulted'
} as const

// Helper function to get status display
const getLoanStatusDisplay = (status: number | bigint | undefined): string => {
  if (status === undefined || status === null) return 'N/A'
  const statusNum = typeof status === 'bigint' ? Number(status) : status
  return LOAN_STATUS_MAP[statusNum as keyof typeof LOAN_STATUS_MAP] || `Unknown (${statusNum})`
}

export default function BorrowerPage() {
  const { validateWalletAndContracts, account } = useWalletValidation()
  const { connectors, connect, status, error } = useConnect()
  const { disconnect } = useDisconnect()



  // Type annotations for contract data
  type TotalLoansResult = bigint | undefined

  // Contract interaction functions
  const { writeContract: requestLoan, isPending: requestLoanLoading, data: requestLoanHash } = useWriteContract()
  const { writeContract: acceptLoanOffer, isPending: acceptLoading, data: acceptLoanHash } = useWriteContract()
  const { writeContract: attemptRepayment, isPending: repaymentLoading, data: repaymentHash } = useWriteContract()
  const { writeContract: withdrawRepaymentAttempt, isPending: withdrawLoading, data: withdrawHash } = useWriteContract()

  // Transaction receipt tracking
  const { data: requestLoanReceipt, isSuccess: requestLoanSuccess, isError: requestLoanError } = useWaitForTransactionReceipt({
    hash: requestLoanHash,
    query: {
      enabled: !!requestLoanHash,
    },
  })

  const { data: acceptLoanReceipt, isSuccess: acceptLoanSuccess, isError: acceptLoanError } = useWaitForTransactionReceipt({
    hash: acceptLoanHash,
    query: {
      enabled: !!acceptLoanHash,
    },
  })

  const { data: repaymentReceipt, isSuccess: repaymentSuccess, isError: repaymentError } = useWaitForTransactionReceipt({
    hash: repaymentHash,
    query: {
      enabled: !!repaymentHash,
    },
  })

  const { data: withdrawReceipt, isSuccess: withdrawSuccess, isError: withdrawError } = useWaitForTransactionReceipt({
    hash: withdrawHash,
    query: {
      enabled: !!withdrawHash,
    },
  })

  // Contract data
  const { data: totalLoans, refetch: refetchLoans, error: loanError } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getTotalLoans',
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected',
    },
  }) as { data: TotalLoansResult, refetch: () => void, error: Error | null }

  // Test contract connection
  const { data: contractOwner, error: ownerError } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'owner',
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected',
    },
  })

  // Get loan details for the borrower
  const { data: borrowerLoanDetails, refetch: refetchBorrowerLoan } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getLoanIdByBorrower',
    args: [account.addresses?.[0] || '0x0000000000000000000000000000000000000000'],
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected' && !!account.addresses?.[0],
    },
  }) as { data: bigint | undefined, refetch: () => void, error: Error | null }

  // Get the actual loan details if borrower has a loan
  const { data: borrowerLoan, refetch: refetchBorrowerLoanDetails } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getLoan',
    args: [borrowerLoanDetails || BigInt(0)],
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected' && !!borrowerLoanDetails && borrowerLoanDetails > BigInt(0),
    },
  }) as { data: any, refetch: () => void, error: Error | null }

  // Get the loan parameters if borrower has a loan
  const { data: borrowerLoanParameters, refetch: refetchBorrowerLoanParameters } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getLoanParameters',
    args: [borrowerLoanDetails || BigInt(0)],
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected' && !!borrowerLoanDetails && borrowerLoanDetails > BigInt(0),
    },
  }) as { data: any, refetch: () => void, error: Error | null }

  // State for account transaction nonce
  const [accountNonce, setAccountNonce] = useState<number | null>(null)

  // Sync status state
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncTime: string | null
    lastSyncTimeFormatted: string
    isMonitoring: boolean
  } | null>(null)

  // Monitor transaction hashes
  useEffect(() => {
    if (requestLoanHash) {
      console.log('📝 Request loan transaction hash generated:', requestLoanHash)
    }
  }, [requestLoanHash])

  // Success and error message handling
  useEffect(() => {
    if (requestLoanSuccess && requestLoanReceipt) {
      console.log('🎉 Loan request successful!', requestLoanReceipt)
      // You could add a toast notification here if you have a toast library
      alert(`🎉 Loan Request Successful!\n\nYour loan request has been submitted and is pending lender approval.\n\nTransaction Hash: ${requestLoanReceipt.transactionHash}\nBlock Number: ${requestLoanReceipt.blockNumber}`)
      
      // Clear form and refresh data
      setLoanAmount('')
      setBtcAddress('')
      setBorrowerBtcPubkey('')
      setPreimageHashBorrower('')
      setTxidP2tr0('')
      setVoutP2tr0('')
      refetchLoans()
    }
  }, [requestLoanSuccess, requestLoanReceipt, refetchLoans])

  useEffect(() => {
    if (requestLoanError) {
      console.error('❌ Loan request failed:', requestLoanError)
      alert('❌ Loan Request Failed\n\nThe transaction was rejected or failed. Please check your inputs and try again.')
    }
  }, [requestLoanError])

  useEffect(() => {
    if (acceptLoanSuccess && acceptLoanReceipt) {
      console.log('✅ Loan accepted successfully!', acceptLoanReceipt)
      alert(`✅ Loan Accepted!\n\nYou have successfully accepted the loan offer. The funds will be available shortly.\n\nTransaction Hash: ${acceptLoanReceipt.transactionHash}`)
      refetchLoans()
    }
  }, [acceptLoanSuccess, acceptLoanReceipt, refetchLoans])

  useEffect(() => {
    if (acceptLoanError) {
      console.error('❌ Loan acceptance failed:', acceptLoanError)
      alert('❌ Loan Acceptance Failed\n\nFailed to accept the loan offer. Please try again.')
    }
  }, [acceptLoanError])

  useEffect(() => {
    if (repaymentSuccess && repaymentReceipt) {
      console.log('💰 Repayment successful!', repaymentReceipt)
      alert(`💰 Repayment Submitted!\n\nYour repayment has been submitted and is being processed.\n\nTransaction Hash: ${repaymentReceipt.transactionHash}`)
      refetchLoans()
    }
  }, [repaymentSuccess, repaymentReceipt, refetchLoans])

  useEffect(() => {
    if (repaymentError) {
      console.error('❌ Repayment failed:', repaymentError)
      alert('❌ Repayment Failed\n\nFailed to submit repayment. Please try again.')
    }
  }, [repaymentError])

  useEffect(() => {
    if (withdrawSuccess && withdrawReceipt) {
      console.log('💸 Withdrawal successful!', withdrawReceipt)
      alert(`💸 Withdrawal Successful!\n\nYour repayment attempt has been withdrawn.\n\nTransaction Hash: ${withdrawReceipt.transactionHash}`)
      refetchLoans()
    }
  }, [withdrawSuccess, withdrawReceipt, refetchLoans])

  useEffect(() => {
    if (withdrawError) {
      console.error('❌ Withdrawal failed:', withdrawError)
      alert('❌ Withdrawal Failed\n\nFailed to withdraw repayment attempt. Please try again.')
    }
  }, [withdrawError])

  // Function to check and sync nonce before sending transaction
  const checkAndSyncNonce = async () => {
    if (!account.addresses?.[0]) return false
    
    try {
      // Get current nonce from the blockchain
              const response = await fetch(NETWORK_CONFIG.ANVIL.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionCount',
          params: [account.addresses[0], 'latest'],
          id: 1
        })
      })
      
      const result = await response.json()
      if (result.result) {
        const blockchainNonce = parseInt(result.result, 16)
        console.log('🔍 Nonce Check:', {
          walletAddress: account.addresses[0],
          blockchainNonce,
          accountStatus: account.status,
          chainId: account.chainId
        })
        return blockchainNonce
      }
    } catch (error) {
      console.error('❌ Error checking nonce:', error)
    }
    return null
  }

  useEffect(() => {
    if (acceptLoanHash) {
      console.log('📝 Accept loan transaction hash generated:', acceptLoanHash)
    }
  }, [acceptLoanHash])

  useEffect(() => {
    if (repaymentHash) {
      console.log('📝 Repayment transaction hash generated:', repaymentHash)
    }
  }, [repaymentHash])

  useEffect(() => {
    if (withdrawHash) {
      console.log('📝 Withdraw transaction hash generated:', withdrawHash)
    }
  }, [withdrawHash])

  // Check for loans when component mounts or contract address changes
  useEffect(() => {
    if (CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected') {
      // The checkForLoans function is removed as totalLoans is now fetched directly.
      // If specific loan data is needed, it would require a different contract call.
    }
  }, [CONTRACTS.BTC_COLLATERAL_LOAN, account.status])

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/sync/status')
      const data = await response.json()
      if (data.success) {
        setSyncStatus(data)
      }
    } catch (error) {
      console.error('Error fetching sync status:', error)
    }
  }

  // Fetch sync status on component mount
  useEffect(() => {
    fetchSyncStatus()
    // Refresh sync status every 30 seconds
    const interval = setInterval(fetchSyncStatus, 30000)
    return () => clearInterval(interval)
  }, [])


  // Form state
  const [loanAmount, setLoanAmount] = useState('')
  const [selectedLoanId, setSelectedLoanId] = useState('0')
  
  // Auto-set loan ID when totalLoans changes
  useEffect(() => {
    if (totalLoans !== undefined && Number(totalLoans) > 0) {
      // Use the latest loan ID (totalLoans, since loan IDs are 1-indexed in the contract)
      const latestLoanId = Number(totalLoans).toString()
      setSelectedLoanId(latestLoanId)
    }
  }, [totalLoans])
  const [borrowerBtcPubkey, setBorrowerBtcPubkey] = useState('274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa')
  const [btcAddress, setBtcAddress] = useState('bcrt1p8zquc6fyga5uldc2j3k2wscpnw44xgjuf8tpqt3ekt85vw2gqtdqlkaujg')
  const [preimageHashBorrower, setPreimageHashBorrower] = useState<string>('0x114810e3c12909f2fb9cbf59c11ee5c9d107556476685f7e14205eab094d4927')
  const [preimageHashLender, setPreimageHashLender] = useState<`0x${string}`>('0x646e58c6fbea3ac4750a2279d4b711fed954e3cb48319c630570e3143e4553e3')
  const [preimageBorrower, setPreimageBorrower] = useState<`0x${string}`>('0x0e0ed04e19fa04ec6b29e6ccfd6f7384a22e1a92b81563064d8c74f354d41f05')
  const [txidP2tr0, setTxidP2tr0] = useState<string>('0xef71afe3b2f77a78c44843db2f0ab151b8fb0c298403e3634869ab65b8f677a4')
  const [voutP2tr0, setVoutP2tr0] = useState('0')
  
  // Signature verification state
  const [signatureData, setSignatureData] = useState<SignatureData | undefined>(undefined)
  const [showSignatureVerification, setShowSignatureVerification] = useState(false)

  // Prepare Collateral state
  const [prepareCollateralData, setPrepareCollateralData] = useState({
    loanAmount: '0.01',
    btcPubkey: '274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa',
    preimageHash: '0x114810e3c12909f2fb9cbf59c11ee5c9d107556476685f7e14205eab094d4927'
  })
  const [collateralResult, setCollateralResult] = useState<any>(null)
  const [isPreparingCollateral, setIsPreparingCollateral] = useState(false)

  // Signature upload/paste state
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [signatureJsonContent, setSignatureJsonContent] = useState('')
  const [processedSignature, setProcessedSignature] = useState<any>(null)

  // Validation functions
  const isValidHexString = (value: string): value is `0x${string}` => {
    return value.startsWith('0x') && /^0x[0-9a-fA-F]+$/.test(value)
  }

  const setValidHexString = (value: string, setter: (value: `0x${string}`) => void) => {
    if (isValidHexString(value)) {
      setter(value)
    }
  }

  // Comprehensive validation functions
  const validateBtcPubkey = (pubkey: string): { isValid: boolean; error: string } => {
    if (!pubkey) {
      return { isValid: false, error: 'BTC public key is required' }
    }
    if (pubkey.length !== 64) {
      return { isValid: false, error: 'BTC public key must be exactly 64 characters' }
    }
    if (!/^[0-9a-fA-F]+$/.test(pubkey)) {
      return { isValid: false, error: 'BTC public key must contain only hexadecimal characters' }
    }
    return { isValid: true, error: '' }
  }

  const validatePreimageHash = (hash: string): { isValid: boolean; error: string } => {
    if (!hash) {
      return { isValid: false, error: 'Preimage hash is required' }
    }
    if (!hash.startsWith('0x')) {
      return { isValid: false, error: 'Preimage hash must start with 0x' }
    }
    if (hash.length !== 66) {
      return { isValid: false, error: 'Preimage hash must be exactly 66 characters (0x + 64 hex chars)' }
    }
    if (!isValidHexString(hash)) {
      return { isValid: false, error: 'Preimage hash must contain only valid hexadecimal characters' }
    }
    return { isValid: true, error: '' }
  }

  const validateLoanAmount = (amount: string): { isValid: boolean; error: string } => {
    if (!amount) {
      return { isValid: false, error: 'Loan amount is required' }
    }
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount)) {
      return { isValid: false, error: 'Loan amount must be a valid number' }
    }
    if (numAmount <= 0) {
      return { isValid: false, error: 'Loan amount must be greater than 0' }
    }
    if (numAmount < 0.005) {
      return { isValid: false, error: 'Minimum loan amount is 0.005 rBTC' }
    }
    return { isValid: true, error: '' }
  }

  const validateBtcAddress = (address: string): { isValid: boolean; error: string } => {
    if (!address) {
      return { isValid: false, error: 'BTC address is required' }
    }
    // P2TR (Taproot) address validation - only bech32m format
    // Mainnet: bc1p... (62 characters)
    // Testnet/Regtest: bcrt1p... (64 characters)
    const p2trMainnetRegex = /^bc1p[a-z0-9]{58}$/
    const p2trTestnetRegex = /^bcrt1p[a-z0-9]{58}$/
    
    if (!p2trMainnetRegex.test(address) && !p2trTestnetRegex.test(address)) {
      return { isValid: false, error: 'Invalid P2TR address format. Must be bech32m (bc1p... for mainnet or bcrt1p... for testnet)' }
    }
    return { isValid: true, error: '' }
  }

  const validateTxid = (txid: string): { isValid: boolean; error: string } => {
    if (!txid) {
      return { isValid: false, error: 'Transaction ID is required' }
    }
    if (!txid.startsWith('0x')) {
      return { isValid: false, error: 'Transaction ID must start with 0x' }
    }
    if (txid.length !== 66) {
      return { isValid: false, error: 'Transaction ID must be exactly 66 characters (0x + 64 hex chars)' }
    }
    if (!isValidHexString(txid)) {
      return { isValid: false, error: 'Transaction ID must contain only valid hexadecimal characters' }
    }
    return { isValid: true, error: '' }
  }

  const validateVout = (vout: string): { isValid: boolean; error: string } => {
    if (!vout) {
      return { isValid: false, error: 'Output index is required' }
    }
    const numVout = parseInt(vout)
    if (isNaN(numVout)) {
      return { isValid: false, error: 'Output index must be a valid number' }
    }
    if (numVout < 0) {
      return { isValid: false, error: 'Output index must be 0 or greater' }
    }
    return { isValid: true, error: '' }
  }

  // Form validation state
  const [formErrors, setFormErrors] = useState<{
    loanAmount: string
    btcAddress: string
    borrowerBtcPubkey: string
    preimageHashBorrower: string
    txidP2tr0: string
    voutP2tr0: string
  }>({
    loanAmount: '',
    btcAddress: '',
    borrowerBtcPubkey: '',
    preimageHashBorrower: '',
    txidP2tr0: '',
    voutP2tr0: ''
  })

  // Check if form is valid
  const isFormValid = () => {
    const loanAmountValidation = validateLoanAmount(loanAmount)
    const btcAddressValidation = validateBtcAddress(btcAddress)
    const btcPubkeyValidation = validateBtcPubkey(borrowerBtcPubkey)
    const preimageHashValidation = validatePreimageHash(preimageHashBorrower)
    const txidValidation = validateTxid(txidP2tr0)
    const voutValidation = validateVout(voutP2tr0)

    return loanAmountValidation.isValid &&
           btcAddressValidation.isValid &&
           btcPubkeyValidation.isValid &&
           preimageHashValidation.isValid &&
           txidValidation.isValid &&
           voutValidation.isValid
  }

  // Update validation errors
  const updateValidationErrors = () => {
    setFormErrors({
      loanAmount: validateLoanAmount(loanAmount).error,
      btcAddress: validateBtcAddress(btcAddress).error,
      borrowerBtcPubkey: validateBtcPubkey(borrowerBtcPubkey).error,
      preimageHashBorrower: validatePreimageHash(preimageHashBorrower).error,
      txidP2tr0: validateTxid(txidP2tr0).error,
      voutP2tr0: validateVout(voutP2tr0).error
    })
  }

  // Update validation on form changes
  useEffect(() => {
    updateValidationErrors()
  }, [loanAmount, btcAddress, borrowerBtcPubkey, preimageHashBorrower, txidP2tr0, voutP2tr0])

  // Prepare Collateral handler
  const handlePrepareCollateral = async () => {
    if (!prepareCollateralData.loanAmount || !prepareCollateralData.btcPubkey || !prepareCollateralData.preimageHash) {
      alert('Please fill in all fields')
      return
    }

    setIsPreparingCollateral(true)
    try {
      const response = await fetch('http://localhost:3002/api/prepare-collateral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loanAmount: parseFloat(prepareCollateralData.loanAmount),
          borrowerBtcPubkey: prepareCollateralData.btcPubkey,
          preimageHashBorrower: prepareCollateralData.preimageHash
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setCollateralResult(data.data)
        // Auto-populate the loan request form with the prepared data
        setLoanAmount(data.data.loanRequestData.amount)
        setBtcAddress(data.data.loanRequestData.btcAddress)
        setBorrowerBtcPubkey(data.data.loanRequestData.btcPubkey)
        setPreimageHashBorrower(data.data.loanRequestData.preimageHashBorrower)
      } else {
        alert(`Error: ${data.message || 'Failed to prepare collateral'}`)
      }
    } catch (error) {
      console.error('Error preparing collateral:', error)
      alert('Failed to prepare collateral. Please check if the backend service is running.')
    } finally {
      setIsPreparingCollateral(false)
    }
  }

  // Handlers
  const handleRequestLoan = async () => {
    console.log('🚀 handleRequestLoan called')
    console.log('Account status:', account.status)
    console.log('Chain ID:', account.chainId)
    console.log('Contract address:', CONTRACTS.BTC_COLLATERAL_LOAN)
    
    if (!validateWalletAndContracts()) {
      return
    }

    if (!requestLoan) {
      console.log('❌ requestLoan function not available')
      return
    }

    // Check and sync nonce before sending transaction
    console.log('🔍 Checking nonce before sending transaction...')
    const blockchainNonce = await checkAndSyncNonce()
    if (blockchainNonce !== null) {
      console.log('✅ Nonce synced:', blockchainNonce)
    } else {
      console.log('⚠️ Could not verify nonce, proceeding anyway...')
    }

    console.log('✅ All checks passed, calling requestLoan')
    console.log('Args:', {
      amount: parseEther(loanAmount),
      btcAddress,
      borrowerBtcPubkey,
      preimageHashBorrower,
      txid_p2tr0: txidP2tr0,
      vout_p2tr0: voutP2tr0,
      value: BigInt('1000000000000000') // PROCESSING_FEE (0.001 rBTC in wei)
    })

    try {
      console.log('🔐 Initiating requestLoan transaction - waiting for wallet signature...')
      requestLoan({
        address: CONTRACTS.BTC_COLLATERAL_LOAN,
        abi: BTC_COLLATERAL_LOAN_ABI,
        functionName: 'requestLoan',
        args: [
          parseEther(loanAmount), // amount
          btcAddress, // btcAddress
          borrowerBtcPubkey, // btcPubkey
          preimageHashBorrower as `0x${string}`, // preimageHashBorrower
          txidP2tr0 as `0x${string}`, // txid_p2tr0
          parseInt(voutP2tr0), // vout_p2tr0
        ],
        value: BigInt('1000000000000000'), // PROCESSING_FEE (0.001 rBTC in wei)
      })
      console.log('✅ requestLoan transaction sent successfully')
    } catch (error) {
      console.error('❌ Error sending requestLoan transaction:', error)
      alert('Error sending transaction. Check console for details.')
    }
  }

  const handleAcceptLoanOffer = () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!acceptLoanOffer) return

    // Check account balance before proceeding
    if (!account.addresses?.[0]) {
      alert('No account address found')
      return
    }

    console.log('💰 Account Check:', {
      address: account.addresses[0],
      chainId: account.chainId
    })

    console.log('🔐 Initiating acceptLoanOffer transaction - waiting for wallet signature...')
    console.log('📋 Transaction Details:', {
      loanId: selectedLoanId,
      preimageBorrower,
      contractAddress: CONTRACTS.BTC_COLLATERAL_LOAN,
      accountAddress: account.addresses?.[0]
    })
    console.log('⛽ Gas Settings:', {
      gas: '500,000',
      gasPrice: '1 gwei (1,000,000,000 wei)',
      estimatedCost: '0.0005 rBTC (500,000 * 1 gwei)'
    })
    
    acceptLoanOffer({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'acceptLoanOffer',
      args: [
        BigInt(selectedLoanId), // loanId
        preimageBorrower, // preimageBorrower
      ],
      // Add explicit gas settings for Anvil
      gas: BigInt(500000), // Set reasonable gas limit
      gasPrice: BigInt(5000000000), // 5 gwei should be enough for Anvil
    })
  }

  const handleAttemptRepayment = () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!attemptRepayment) return

    // Get the actual loan amount from the contract data
    const actualLoanAmount = borrowerLoan?.amount || BigInt(0)
    
    if (actualLoanAmount === BigInt(0)) {
      alert('No loan data found. Please ensure you have an active loan.')
      return
    }

    console.log('🔐 Initiating attemptRepayment transaction - waiting for wallet signature...')
    console.log('💰 Repayment amount:', formatEther(actualLoanAmount), 'ETH')
    
    attemptRepayment({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'attemptRepayment',
      args: [
        BigInt(selectedLoanId), // loanId
        preimageHashLender, // preimageHashLender
      ],
      value: actualLoanAmount, // repayment amount from contract data
    })
  }

  const handleWithdrawRepaymentAttempt = () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!withdrawRepaymentAttempt) return

    console.log('🔐 Initiating withdrawRepaymentAttempt transaction - waiting for wallet signature...')
    
    withdrawRepaymentAttempt({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'withdrawRepaymentAttempt',
      args: [BigInt(selectedLoanId)], // loanId
    })
  }

  // Signature handling functions
  const handleSignatureFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSignatureFile(file)
      // Read file content and set it in the textarea
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setSignatureJsonContent(content)
      }
      reader.readAsText(file)
    }
  }

  const handleProcessSignature = async () => {
    console.log('handleProcessSignature called')
    console.log('signatureFile:', signatureFile)
    console.log('signatureJsonContent:', signatureJsonContent)
    
    try {
      let signatureData
      
      if (signatureFile) {
        console.log('Processing uploaded file')
        // Process uploaded file
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const content = e.target?.result as string
            signatureData = JSON.parse(content)
            await saveSignatureToBackend(signatureData)
          } catch (error) {
            alert('Error parsing signature file: ' + (error as Error).message)
          }
        }
        reader.readAsText(signatureFile)
      } else if (signatureJsonContent) {
        console.log('Processing pasted content')
        // Process pasted content
        signatureData = JSON.parse(signatureJsonContent)
        await saveSignatureToBackend(signatureData)
      } else {
        console.log('No content to process')
        alert('Please upload a file or paste signature content')
      }
    } catch (error) {
      console.error('Error processing signature:', error)
      alert('Error processing signature: ' + (error as Error).message)
    }
  }

  const saveSignatureToBackend = async (signatureData: any) => {
    try {
      const response = await fetch('http://localhost:3002/api/bitcoin/signatures/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loanId: selectedLoanId,
          signatureData: signatureData,
          borrowerAddress: account.address,
          transactionType: 'collateral'
        })
      })

      const result = await response.json()

      if (result.success) {
        setProcessedSignature(signatureData)
        alert('Signature processed and saved successfully!')
      } else {
        alert('Error saving signature: ' + result.error)
      }
    } catch (error) {
      console.error('Error saving signature to backend:', error)
      alert('Error saving signature to backend: ' + (error as Error).message)
    }
  }

  const handleClearSignature = () => {
    setSignatureFile(null)
    setSignatureJsonContent('')
    setProcessedSignature(null)
    // Clear file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Borrower Dashboard</h1>
          <p className="text-lg text-gray-600">Request and manage your Bitcoin-collateralized loans</p>
          <div className="mt-4 space-x-4">
            <Link href="/" className="text-green-600 hover:text-green-800 underline">
              ← Back to Home
            </Link>
            <Link href="/lender" className="text-blue-600 hover:text-blue-800 underline">
              Lender View →
            </Link>
          </div>
        </div>

        {/* Wallet Connection */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Wallet Connection</h2>
          
          <div className="mb-4">
            <div className="text-sm text-gray-700 mb-2">
              Status: <span className="font-medium text-green-600">{account.status}</span>
            </div>
            {account.addresses && (
              <div className="text-sm text-gray-700 mb-2">
                Address: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{account.addresses[0]}</span>
              </div>
            )}
            {account.chainId && (
              <div className="text-sm text-gray-700 mb-2">
                Chain ID: <span className="font-medium text-green-600">{account.chainId}</span>
              </div>
            )}
          </div>

          {account.status === 'connected' ? (
            <div className="space-y-3">
              {/* Network Status */}
              {account.chainId !== NETWORK_CONFIG.ANVIL.chainId && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="text-sm text-yellow-800 mb-2">
                    ⚠️ You are connected to the wrong network. Please switch to Anvil (Chain ID: {NETWORK_CONFIG.ANVIL.chainId})
                  </div>
                  <button
                    onClick={switchToAnvil}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    Add & Switch to Anvil
                  </button>
                </div>
              )}
              
              <button
                onClick={() => disconnect()}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Connect {connector.name}
                </button>
              ))}
            </div>
          )}
          
          {status && <div className="mt-2 text-sm text-gray-600">{status}</div>}
          {error && <div className="mt-2 text-sm text-red-600">{error.message}</div>}
        </div>

        {/* Sync Status */}
        {syncStatus && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">🔄 Data Sync Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="font-medium text-blue-800">Last Sync Time</div>
                <div className="text-blue-600">
                  {syncStatus.lastSyncTime ? (
                    <span className="text-blue-700">{syncStatus.lastSyncTimeFormatted}</span>
                  ) : (
                    <span className="text-yellow-600">Never synced</span>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="font-medium text-green-800">Event Monitoring</div>
                <div className="text-green-600">
                  {syncStatus.isMonitoring ? (
                    <span className="text-green-700">✅ Active</span>
                  ) : (
                    <span className="text-red-600">❌ Inactive</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-700">
                <div className="font-medium mb-2">ℹ️ About Data Sync</div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>• The system automatically syncs loan data from the blockchain</div>
                  <div>• Sync is triggered when new loan events are detected</div>
                  <div>• Last sync time shows when the database was last updated</div>
                  <div>• Event monitoring ensures real-time data accuracy</div>
                </div>
                <button
                  onClick={fetchSyncStatus}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                >
                  🔄 Refresh Status
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contract Status */}
        {account.status === 'connected' && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Contract Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="font-medium text-green-800">EtherSwap</div>
                <div className="text-green-600">
                  {CONTRACTS.ETHER_SWAP ? (
                    <span className="text-green-700">✅ Deployed</span>
                  ) : (
                    <span className="text-red-600">❌ Not Deployed</span>
                  )}
                </div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="font-medium text-purple-800">BtcCollateralLoan</div>
                <div className="text-purple-600">
                  {CONTRACTS.BTC_COLLATERAL_LOAN ? (
                    <span className="text-purple-700">✅ Deployed</span>
                  ) : (
                    <span className="text-red-600">❌ Not Deployed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Contract Addresses Display */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
              <h3 className="font-medium text-gray-800 mb-3">Deployed Contract Addresses</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">EtherSwap:</span>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-gray-900">
                    {CONTRACTS.ETHER_SWAP || 'Not deployed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">BtcCollateralLoan:</span>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-gray-900">
                    {CONTRACTS.BTC_COLLATERAL_LOAN || 'Not deployed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Loan Statistics */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-sm text-emerald-800">
                <div className="font-medium">Total Loans: {totalLoans !== undefined ? Number(totalLoans) : 0}</div>
                <div className="font-medium mt-1">Processing Fee: 0.001 rBTC</div>
                <div className="font-medium mt-1">Minimum Loan Amount: 0.005 rBTC</div>
                <button
                  onClick={() => refetchLoans()}
                  className="mt-2 px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition-colors"
                >
                  Refresh Loans
                </button>
              </div>
            </div>

            {/* Nonce Information */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <div className="font-medium">🔍 Nonce Information</div>
                <div className="text-xs text-yellow-700 mt-1">
                  <div>Wallet Address: <code className="bg-yellow-100 px-1 rounded">{account.addresses?.[0] || 'Not connected'}</code></div>
                  <div>Current Nonce: <code className="bg-yellow-100 px-1 rounded">{accountNonce !== null ? accountNonce : 'Click button to check'}</code></div>
                </div>
                <button
                  onClick={async () => {
                    const nonce = await checkAndSyncNonce()
                    if (nonce !== null && nonce !== false) {
                      setAccountNonce(nonce)
                      console.log('✅ Nonce refreshed:', nonce)
                    }
                  }}
                  className="mt-2 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
                >
                  🔄 Check Nonce
                </button>
              </div>
            </div>

            {/* Enhanced Transaction Status Display */}
            {(requestLoanHash || acceptLoanHash || repaymentHash || withdrawHash) && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-800 mb-3">📊 Transaction Status</h4>
                <div className="space-y-3">
                  {requestLoanHash && (
                    <div className={`p-3 rounded-lg border-l-4 ${
                      requestLoanSuccess ? 'bg-green-50 border-green-400' :
                      requestLoanError ? 'bg-red-50 border-red-400' :
                      'bg-blue-50 border-blue-400'
                    }`}>
                      <div className="flex items-center space-x-2">
                          {requestLoanLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
                          {requestLoanSuccess && <span className="text-green-600">✅</span>}
                          {requestLoanError && <span className="text-red-600">❌</span>}
                          <span className="font-medium text-sm">
                            {requestLoanLoading ? 'Requesting Loan...' : 
                             requestLoanSuccess ? 'Loan Request Successful!' : 
                             requestLoanError ? 'Loan Request Failed' : 'Processing...'}
                          </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 font-mono">
                        Hash: {requestLoanHash}
                      </div>
                    </div>
                  )}
                  
                  {acceptLoanHash && (
                    <div className={`p-3 rounded-lg border-l-4 ${
                      acceptLoanSuccess ? 'bg-green-50 border-green-400' :
                      acceptLoanError ? 'bg-red-50 border-red-400' :
                      'bg-blue-50 border-blue-400'
                    }`}>
                      <div className="flex items-center space-x-2">
                          {acceptLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
                          {acceptLoanSuccess && <span className="text-green-600">✅</span>}
                          {acceptLoanError && <span className="text-red-600">❌</span>}
                          <span className="font-medium text-sm">
                            {acceptLoading ? 'Accepting Loan...' : 
                             acceptLoanSuccess ? 'Loan Accepted!' : 
                             acceptLoanError ? 'Loan Acceptance Failed' : 'Processing...'}
                          </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 font-mono">
                        Hash: {acceptLoanHash}
                      </div>
                    </div>
                  )}
                  
                  {repaymentHash && (
                    <div className={`p-3 rounded-lg border-l-4 ${
                      repaymentSuccess ? 'bg-green-50 border-green-400' :
                      repaymentError ? 'bg-red-50 border-red-400' :
                      'bg-blue-50 border-blue-400'
                    }`}>
                      <div className="flex items-center space-x-2">
                          {repaymentLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
                          {repaymentSuccess && <span className="text-green-600">✅</span>}
                          {repaymentError && <span className="text-red-600">❌</span>}
                          <span className="font-medium text-sm">
                            {repaymentLoading ? 'Submitting Repayment...' : 
                             repaymentSuccess ? 'Repayment Submitted!' : 
                             repaymentError ? 'Repayment Failed' : 'Processing...'}
                          </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 font-mono">
                        Hash: {repaymentHash}
                      </div>
                    </div>
                  )}
                  
                  {withdrawHash && (
                    <div className={`p-3 rounded-lg border-l-4 ${
                      withdrawSuccess ? 'bg-green-50 border-green-400' :
                      withdrawError ? 'bg-red-50 border-red-400' :
                      'bg-blue-50 border-blue-400'
                    }`}>
                      <div className="flex items-center space-x-2">
                          {withdrawLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
                          {withdrawSuccess && <span className="text-green-600">✅</span>}
                          {withdrawError && <span className="text-red-600">❌</span>}
                          <span className="font-medium text-sm">
                            {withdrawLoading ? 'Withdrawing...' : 
                             withdrawSuccess ? 'Withdrawal Successful!' : 
                             withdrawError ? 'Withdrawal Failed' : 'Processing...'}
                          </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 font-mono">
                        Hash: {withdrawHash}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Debug Information */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-800 mb-2">🐛 Debug Information</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Wallet Status: {account.status}</div>
                <div>Network: {account.chainId} {account.chainId === 31337 ? '(Anvil)' : '(Wrong Network)'}</div>
                <div>Contract Address: {CONTRACTS.BTC_COLLATERAL_LOAN || 'Not set'}</div>
                <div>Account Address: {account.addresses?.[0] || 'Not connected'}</div>
                <div>Total Loans Data: {totalLoans !== undefined ? Number(totalLoans) : 'Loading...'}</div>
                <div>Contract Owner: {contractOwner || 'Loading...'}</div>
                <div>Owner Error: {ownerError ? ownerError.message : 'None'}</div>
                <div>Loan Error: {loanError ? loanError.message : 'None'}</div>
              </div>
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                💡 <strong>Debug Tip:</strong> Open browser console (F12) to see detailed transaction logs and any errors.
              </div>
              <div className="mt-2">
                <button
                  onClick={() => {
                    console.log('🔍 Testing contract connection...')
                    console.log('CONTRACTS:', CONTRACTS)
                    console.log('BTC_COLLATERAL_LOAN_ABI:', BTC_COLLATERAL_LOAN_ABI)
                    refetchLoans()
                  }}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                >
                  Test Contract Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Borrower's Loan Details */}
        {account.status === 'connected' && CONTRACTS.BTC_COLLATERAL_LOAN && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Your Loan Details</h3>
            
            {borrowerLoanDetails && borrowerLoanDetails > BigInt(0) ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <div className="font-medium">Your Loan ID: {borrowerLoanDetails.toString()}</div>
                    <button
                      onClick={() => {
                        refetchBorrowerLoanDetails()
                        refetchBorrowerLoanParameters()
                      }}
                      className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                    >
                      🔄 Refresh Details
                    </button>
                  </div>
                </div>

                {borrowerLoan && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-3">📋 Loan Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-green-700 mb-2">Basic Details</div>
                        <div className="space-y-1 text-xs text-green-600">
                          <div>Borrower: <code className="bg-green-100 px-1 rounded">{borrowerLoan.borrowerAddr || 'N/A'}</code></div>
                          <div>BTC Pubkey: <code className="bg-green-100 px-1 rounded">{borrowerLoan.borrowerBtcPubkey || 'N/A'}</code></div>
                          <div>Loan Amount: <code className="bg-green-100 px-1 rounded">{borrowerLoan.amount ? formatEther(BigInt(borrowerLoan.amount)) : 'N/A'} rBTC</code></div>
                          <div>Collateral: <code className="bg-green-100 px-1 rounded">N/A (Set when collateral provided)</code></div>
                          <div>Bond Amount: <code className="bg-green-100 px-1 rounded">{borrowerLoan.bondAmount ? formatEther(BigInt(borrowerLoan.bondAmount)) : 'N/A'} rBTC</code></div>
                          <div>Status: <code className="bg-green-100 px-1 rounded">{getLoanStatusDisplay(borrowerLoan.status)}</code></div>
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-green-700 mb-2">Timelock & Hashes</div>
                        <div className="space-y-1 text-xs text-green-600">
                          <div>Preimage Hash Borrower: <code className="bg-green-100 px-1 rounded">{borrowerLoan.preimageHashBorrower || 'N/A'}</code></div>
                          <div>Preimage Hash Lender: <code className="bg-green-100 px-1 rounded">{borrowerLoan.preimageHashLender || 'N/A'}</code></div>
                          <div>Offer Block: <code className="bg-green-100 px-1 rounded">{borrowerLoan.offerBlockheight || 'N/A'}</code></div>
                          <div>Activation Block: <code className="bg-green-100 px-1 rounded">{borrowerLoan.activationBlockheight || 'N/A'}</code></div>
                          <div>Repayment Block: <code className="bg-green-100 px-1 rounded">{borrowerLoan.repaymentBlockheight || 'N/A'}</code></div>
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-green-700 mb-2">Bitcoin Transaction</div>
                        <div className="space-y-1 text-xs text-green-600">
                          <div>Transaction ID: <code className="bg-green-100 px-1 rounded">{borrowerLoan.txid_p2tr0 || 'N/A'}</code></div>
                          <div>Output Index: <code className="bg-green-100 px-1 rounded">{borrowerLoan.vout_p2tr0 || 'N/A'}</code></div>
                        </div>
                      </div>
                    </div>

                    {/* Loan Parameters */}
                    {borrowerLoanParameters && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-3">⚙️ Fixed Loan Parameters</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-blue-700 mb-2">Fees & Rates</div>
                            <div className="space-y-1 text-xs text-blue-600">
                              <div>Interest Rate: <code className="bg-blue-100 px-1 rounded">{borrowerLoanParameters.int_rate ? Number(borrowerLoanParameters.int_rate) : 'N/A'}</code></div>
                              <div>Processing Fee: <code className="bg-blue-100 px-1 rounded">{borrowerLoanParameters.proc_fee ? formatEther(BigInt(borrowerLoanParameters.proc_fee)) : 'N/A'} rBTC</code></div>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-blue-700 mb-2">Timelocks</div>
                            <div className="space-y-1 text-xs text-blue-600">
                              <div>Duration: <code className="bg-blue-100 px-1 rounded">{borrowerLoanParameters.duration ? Number(borrowerLoanParameters.duration) : 'N/A'} blocks</code></div>
                              <div>Borrower Timelock: <code className="bg-blue-100 px-1 rounded">{borrowerLoanParameters.tl_borrower ? Number(borrowerLoanParameters.tl_borrower) : 'N/A'} blocks</code></div>
                              <div>Lender Timelock: <code className="bg-blue-100 px-1 rounded">{borrowerLoanParameters.tl_lender ? Number(borrowerLoanParameters.tl_lender) : 'N/A'} blocks</code></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Generate Borrower Signature Section */}
                    {borrowerLoan && borrowerLoan.status === 0 && borrowerLoan.preimageHashLender && borrowerLoan.preimageHashLender !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                      <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <h4 className="font-medium text-purple-800 mb-3">✍️ Generate Borrower Signature</h4>
                        <p className="text-sm text-purple-700 mb-4">
                          The lender has provided their preimage hash. You can now generate your signature for the collateral transaction.
                        </p>
                        <div className="space-y-3">
                          <div className="text-sm">
                            <span className="font-medium text-purple-800">Lender's Preimage Hash:</span>
                            <code className="ml-2 bg-purple-100 px-2 py-1 rounded text-xs font-mono">
                              {borrowerLoan.preimageHashLender}
                            </code>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-purple-800">Your Preimage Hash:</span>
                            <code className="ml-2 bg-purple-100 px-2 py-1 rounded text-xs font-mono">
                              {borrowerLoan.preimageHashBorrower}
                            </code>
                          </div>
                          
                          {/* Signature Upload/Paste Section */}
                          <div className="mt-4 p-4 bg-white border border-purple-200 rounded-lg">
                            <h5 className="font-medium text-purple-800 mb-3">📁 Upload or Paste Signature File</h5>
                            <p className="text-sm text-purple-600 mb-4">
                              After generating your signature using the Python API, upload the JSON file or paste its contents below:
                            </p>
                            
                            {/* Sample file download */}
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm text-blue-700 mb-2">
                                <strong>💡 Test with sample file:</strong> Download a sample signature file to test the functionality:
                              </p>
                              <a
                                href="/sample-borrower-signature.json"
                                download="sample-borrower-signature.json"
                                className="inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                              >
                                📥 Download Sample Signature
                              </a>
                            </div>
                            
                            {/* File Upload */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-purple-800 mb-2">
                                Upload Signature File
                              </label>
                              <input
                                type="file"
                                accept=".json"
                                onChange={handleSignatureFileUpload}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                              />
                            </div>
                            
                            {/* Text Area for Pasting */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-purple-800 mb-2">
                                Or Paste Signature JSON Content
                              </label>
                              <textarea
                                value={signatureJsonContent}
                                onChange={(e) => setSignatureJsonContent(e.target.value)}
                                placeholder="Paste the signature JSON content here..."
                                className="w-full h-32 px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono"
                              />
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={handleProcessSignature}
                                disabled={!signatureJsonContent && !signatureFile}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Process Signature
                              </button>
                              <button
                                onClick={handleClearSignature}
                                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Clear
                              </button>
                            </div>
                            
                            {/* Display Processed Signature Info */}
                            {processedSignature && (
                              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <h6 className="font-medium text-green-800 mb-2">✅ Signature Processed Successfully</h6>
                                <div className="text-sm text-green-700 space-y-1">
                                  <div><strong>Loan ID:</strong> {processedSignature.loan_id}</div>
                                  <div><strong>Transaction ID:</strong> <code className="bg-green-100 px-1 rounded text-xs">{processedSignature.txid}</code></div>
                                  <div><strong>Output Index:</strong> {processedSignature.vout}</div>
                                  <div><strong>Signature:</strong> <code className="bg-green-100 px-1 rounded text-xs">{processedSignature.sig_borrower?.substring(0, 20)}...</code></div>
                                </div>
                                <div className="mt-3 text-sm text-green-600">
                                  <strong>Next Step:</strong> The lender can now see your signature and extend a loan offer. Once you accept the loan offer and reveal your preimage, the lender can complete the witness.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-600">
                  <div>No active loan found for your address.</div>
                  <div className="text-xs text-gray-500 mt-1">Request a new loan to get started.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prepare Collateral Section */}
        {account.status === 'connected' && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">📋 Step 1: Prepare Collateral</h2>
            <p className="text-gray-600 mb-6">
              Enter your loan details to get the P2TR (Taproot) escrow address where you need to send BTC to be used as collateral.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount (rBTC)</label>
                <input
                  type="number"
                  step="0.001"
                  value={prepareCollateralData.loanAmount}
                  onChange={(e) => setPrepareCollateralData(prev => ({ ...prev, loanAmount: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    validateLoanAmount(prepareCollateralData.loanAmount).error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
                  }`}
                  placeholder="0.01"
                />
                {validateLoanAmount(prepareCollateralData.loanAmount).error && (
                  <p className="text-xs text-red-500 mt-1">{validateLoanAmount(prepareCollateralData.loanAmount).error}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your x-only BTC Public Key (64 chars)</label>
                <input
                  type="text"
                  value={prepareCollateralData.btcPubkey}
                  onChange={(e) => setPrepareCollateralData(prev => ({ ...prev, btcPubkey: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    validateBtcPubkey(prepareCollateralData.btcPubkey).error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
                  }`}
                  maxLength={64}
                />
                {validateBtcPubkey(prepareCollateralData.btcPubkey).error && (
                  <p className="text-xs text-red-500 mt-1">{validateBtcPubkey(prepareCollateralData.btcPubkey).error}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Preimage Hash (66 chars starting with 0x)</label>
                <input
                  type="text"
                  value={prepareCollateralData.preimageHash}
                  onChange={(e) => setPrepareCollateralData(prev => ({ ...prev, preimageHash: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    validatePreimageHash(prepareCollateralData.preimageHash).error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
                  }`}
                  placeholder="0x..."
                />
                {validatePreimageHash(prepareCollateralData.preimageHash).error && (
                  <p className="text-xs text-red-500 mt-1">{validatePreimageHash(prepareCollateralData.preimageHash).error}</p>
                )}
              </div>
            </div>
            
            <button
              onClick={handlePrepareCollateral}
              disabled={isPreparingCollateral || 
                !validateLoanAmount(prepareCollateralData.loanAmount).isValid ||
                !validateBtcPubkey(prepareCollateralData.btcPubkey).isValid ||
                !validatePreimageHash(prepareCollateralData.preimageHash).isValid}
              className={`px-6 py-3 rounded-lg transition-colors font-medium ${
                isPreparingCollateral || 
                !validateLoanAmount(prepareCollateralData.loanAmount).isValid ||
                !validateBtcPubkey(prepareCollateralData.btcPubkey).isValid ||
                !validatePreimageHash(prepareCollateralData.preimageHash).isValid
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isPreparingCollateral ? 'Preparing...' : 'Prepare Collateral'}
            </button>

            {/* Collateral Results */}
            {collateralResult && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800 mb-4">✅ Collateral Information Ready</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-green-700 mb-2">💰 Amount Breakdown</h4>
                    <div className="space-y-1 text-sm text-green-600">
                      <div>Loan Amount: <code className="bg-green-100 px-1 rounded">{collateralResult.loanAmount.eth} rBTC</code></div>
                      <div>Origination Fee ({collateralResult.originationFeePercentage}%): <code className="bg-green-100 px-1 rounded">{collateralResult.originationFee.eth} rBTC</code></div>
                      <div>Total Required: <code className="bg-green-100 px-1 rounded">{collateralResult.totalAmount.eth} rBTC</code></div>
                      <div className="font-medium">Suggested Total: <code className="bg-green-100 px-1 rounded">{collateralResult.suggestedTotal.btc} BTC</code> (+200 sats for fees)</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-green-700 mb-2">📍 P2TR Bitcoin Address (Escrow Output)</h4>
                    <div className="text-sm text-green-600">
                      <div className="font-mono break-all bg-green-100 p-2 rounded">
                        {collateralResult.bitcoinAddress}
                      </div>
                      <div className="mt-2 text-xs text-green-500">
                        Send at least <strong>{collateralResult.suggestedTotal.btc} BTC</strong> to this P2TR address
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <h4 className="font-medium text-blue-800 mb-2">📋 Next Steps</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <div>1. Send {collateralResult.suggestedTotal.btc} BTC to the address above</div>
                    <div>2. Wait for confirmation (6+ blocks recommended)</div>
                    <div>3. Note the transaction ID and output index</div>. Using the python-api locally, you can verify the address. 
                    You can also use it to fund the address and get the transaction ID and output index.
                    <div>4. Use the "Request Loan" form below with the prepared values</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Borrower Functions */}
        {account.status === 'connected' && CONTRACTS.BTC_COLLATERAL_LOAN && (
          <div className="space-y-8">
            {/* Request Loan */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Request New Loan</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount (rBTC)</label>
                <input
                  type="text"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.loanAmount ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
                  }`}
                  placeholder="0.01"
                />
                {formErrors.loanAmount ? (
                  <p className="text-xs text-red-500 mt-1">{formErrors.loanAmount}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Minimum: 0.005 rBTC</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">BTC Address (P2TR Escrow Output)</label>
                <input
                  type="text"
                  value={btcAddress}
                  onChange={(e) => setBtcAddress(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.btcAddress ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
                  }`}
                />
                {formErrors.btcAddress ? (
                  <p className="text-xs text-red-500 mt-1">{formErrors.btcAddress}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Your P2TR (Taproot) Bitcoin address for collateral (bech32m format)</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Your x-only BTC Public Key (64 characters)</label>
                <input
                  type="text"
                  value={borrowerBtcPubkey}
                  onChange={(e) => setBorrowerBtcPubkey(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.borrowerBtcPubkey ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
                  }`}
                  maxLength={64}
                />
                {formErrors.borrowerBtcPubkey ? (
                  <p className="text-xs text-red-500 mt-1">{formErrors.borrowerBtcPubkey}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Must be exactly 64 characters</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Preimage Hash (66 chars starting with 0x)</label>
                <input
                  type="text"
                  value={preimageHashBorrower}
                  onChange={(e) => {
                    const value = e.target.value
                    if (isValidHexString(value)) {
                      setPreimageHashBorrower(value)
                    } else {
                      setPreimageHashBorrower(value)
                    }
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.preimageHashBorrower ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
                  }`}
                />
                {formErrors.preimageHashBorrower ? (
                  <p className="text-xs text-red-500 mt-1">{formErrors.preimageHashBorrower}</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mt-1">Hash of your preimage for loan security</p>
                    <p className="text-xs text-gray-500 mt-1">Must be 0x + 64 characters</p>
                  </>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bitcoin Transaction ID (txid, 64 chars starting with 0x)</label>
                <input
                  type="text"
                  value={txidP2tr0}
                  onChange={(e) => {
                    const value = e.target.value
                    if (isValidHexString(value)) {
                      setTxidP2tr0(value)
                    } else {
                      setTxidP2tr0(value)
                    }
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.txidP2tr0 ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
                  }`}
                />
                {formErrors.txidP2tr0 ? (
                  <p className="text-xs text-red-500 mt-1">{formErrors.txidP2tr0}</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mt-1">Bitcoin transaction ID of the escrow UTXO</p>
                    <p className="text-xs text-gray-500 mt-1">Must be 0x + 64 characters</p>
                  </>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Output Index (vout, integer)</label>
                <input
                  type="number"
                  value={voutP2tr0}
                  onChange={(e) => setVoutP2tr0(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.voutP2tr0 ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
                  }`}
                  placeholder="0"
                  min="0"
                />
                {formErrors.voutP2tr0 ? (
                  <p className="text-xs text-red-500 mt-1">{formErrors.voutP2tr0}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Output index of the escrow UTXO in the bitcoin transaction</p>
                )}
              </div>

              <button
                onClick={handleRequestLoan}
                disabled={requestLoanLoading || !isFormValid()}
                className={`px-6 py-3 rounded-lg transition-colors font-medium ${
                  requestLoanLoading || !isFormValid()
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {requestLoanLoading ? 'Requesting...' : 'Request Loan'}
              </button>
              
              {!isFormValid() && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    ⚠️ Please fill in all required fields with valid values before requesting a loan.
                  </p>
                </div>
              )}
            </div>

            {/* Loan Management */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Loan Management</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Loan ID</label>
                <input
                  type="number"
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lender Preimage Hash (66 chars starting with 0x)</label>
                  <input
                    type="text"
                    value={preimageHashLender}
                    onChange={(e) => setValidHexString(e.target.value, setPreimageHashLender)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0x..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be 0x + 64 characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Preimage (66 chars starting with 0x)</label>
                  <input
                    type="text"
                    value={preimageBorrower}
                    onChange={(e) => setValidHexString(e.target.value, setPreimageBorrower)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be 0x + 64 characters</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleAcceptLoanOffer}
                  disabled={acceptLoading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {acceptLoading ? 'Accepting...' : 'Accept Loan Offer'}
                </button>
                <button
                  onClick={handleAttemptRepayment}
                  disabled={repaymentLoading}
                  className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {repaymentLoading ? 'Repaying...' : 'Attempt Repayment'}
                </button>
                <button
                  onClick={handleWithdrawRepaymentAttempt}
                  disabled={withdrawLoading}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {withdrawLoading ? 'Withdrawing...' : 'Withdraw Repayment'}
                </button>
              </div>
            </div>

            {/* Signature Verification */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Signature Verification</h3>
                <button
                  onClick={() => setShowSignatureVerification(!showSignatureVerification)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                >
                  {showSignatureVerification ? 'Hide' : 'Show'} Verification
                </button>
              </div>
              
              {showSignatureVerification && (
                <div className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={async () => {
                        // Load actual signature data from backend
                        if (!selectedLoanId || selectedLoanId === '0') {
                          alert('Please select a loan first')
                          return
                        }
                        
                        try {
                          const response = await fetch(`http://localhost:3002/api/bitcoin/signatures/loan/${selectedLoanId}/borrower`)
                          const result = await response.json()
                          
                          if (result.success && result.data) {
                            setSignatureData(result.data)
                            alert('✅ Signature loaded from backend!')
                          } else {
                            alert('⏳ No signature found in backend')
                          }
                        } catch (error) {
                          console.error('Error loading signature:', error)
                          alert('Error loading signature: ' + (error as Error).message)
                        }
                      }}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                      📋 Load My Signature
                    </button>
                    {processedSignature && (
                      <button
                        onClick={() => {
                          // Load processed signature data from current session
                          setSignatureData(processedSignature)
                        }}
                        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm"
                      >
                        🔄 Load Session Data
                      </button>
                    )}
                    <button
                      onClick={() => {
                        // Load sample signature data for testing
                        setSignatureData({
                          sig_borrower: "9ce3210b3b1b657a9d4f33ec0c3cd8f92155952ef6d6bae1c582df762c0298ad0d6c52d7d8efa8882906aef4c0c8e5c8e641f77ba0b09c20855b075bd26a56d6",
                          tx_hex: "02000000000101f3f45bc999ab6484d45798e1c8ba926a81a6323b5035b6088ccc46fa10c8e7ff0000000000fdffffff02a0860100000000001976a914021c4448dec19b0e498cc9f8631033ef512b606388ac40420f000000000022512011c3194cb67847eef5f83e7d4816b1b788e4e556a13e00cbe9e27a175f5543e600000000",
                          input_amount: 0.0111,
                          escrow_address_script: "51205011619088ddb5a08d38c2c0f5026ecc285cabb3ec9fdc623d1c5fdc380c638c",
                          tapleaf_script_hex: "a8203faa7c2aee84d26c241aa0f9a9718fde501a91c4a1f700ab37c1914f993242e3882064b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8ac20274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afaba529d51",
                          escrow_is_odd: false
                        })
                      }}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                      🧪 Load Test Data
                    </button>
                    <button
                      onClick={() => setSignatureData(undefined)}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                      🗑️ Clear Data
                    </button>
                  </div>
                  <SignatureVerification
                    signatureData={signatureData}
                    borrowerPubkey={borrowerBtcPubkey}
                    onVerificationResult={(isValid, result) => {
                      console.log('Signature verification result:', { isValid, result })
                    }}
                  />
                </div>
              )}
            </div>

            {/* Loan Information */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Loan Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Current Configuration</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>• Loan Duration: {CONTRACT_CONFIG.LOAN_DURATION} Rootstock blocks</div>
                    <div>• Timelock Loan Request: {CONTRACT_CONFIG.TIMELOCK_LOAN_REQ} Rootstock blocks</div>
                    <div>• Timelock BTC Escrow: {CONTRACT_CONFIG.TIMELOCK_BTC_ESCROW} Rootstock blocks</div>
                    <div>• Timelock Repayment Accept: {CONTRACT_CONFIG.TIMELOCK_REPAYMENT_ACCEPT} Rootstock blocks</div>
                    <div>• Timelock BTC Collateral: {CONTRACT_CONFIG.TIMELOCK_BTC_COLLATERAL} Rootstock blocks</div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Loan Process</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>1. Request loan with x-only BTC public key</div>
                    <div>2. Wait for lender offer</div>
                    <div>3. Accept offer to activate loan</div>
                    <div>4. Repay loan when due</div>
                    <div>5. Reclaim BTC collateral</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-green-50 rounded-xl p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4 text-green-900">Borrower Instructions</h2>
          <div className="text-green-800 space-y-2">
            <div>1. <strong>Request Loan</strong>: Submit a loan request with your x-only BTC public key and desired amounts</div>
            <div>2. <strong>Wait for Offer</strong>: Lenders will review and offer loans to your request</div>
            <div>3. <strong>Accept Offer</strong>: Accept a loan offer to activate the loan</div>
            <div>4. <strong>Manage Repayment</strong>: Attempt repayment when the loan is due</div>
            <div>5. <strong>Reclaim Collateral</strong>: Once repaid, reclaim your BTC collateral</div>
          </div>
        </div>
      </div>
    </div>
  )
}
