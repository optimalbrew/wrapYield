import { ethers } from 'ethers'
import { eq } from 'drizzle-orm'
import databaseService from './databaseService'
import { loans, users, borrowerSignatures } from '../db/schema'
import fs from 'fs'
import path from 'path'

// Load full ABI from generated contract file
const ABI_PATH = path.join(__dirname, '../../contracts/BtcCollateralLoan.json')
const BTC_COLLATERAL_LOAN_ABI = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8')).abi

// Fallback hardcoded ABI (commented out - using full ABI instead)
/*
  {
    "type": "event",
    "name": "LoanRequested",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "borrower", "type": "address", "indexed": true },
      { "name": "amount", "type": "uint256", "indexed": false },
      { "name": "btcAddress", "type": "string", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LenderPreimageHashAssociated",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "lender", "type": "address", "indexed": true },
      { "name": "preimageHashLender", "type": "bytes32", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LoanOffered",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "lender", "type": "address", "indexed": true },
      { "name": "amount", "type": "uint256", "indexed": false },
      { "name": "bondAmount", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LoanActivated",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "borrower", "type": "address", "indexed": true },
      { "name": "preimageBorrower", "type": "bytes32", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LoanRefundedToLender",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "lender", "type": "address", "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RepaymentAttempted",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "borrower", "type": "address", "indexed": true },
      { "name": "amount", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RepaymentAccepted",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "lender", "type": "address", "indexed": true },
      { "name": "preimageLender", "type": "bytes32", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RepaymentRefundedToBorrowerWithBond",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "borrower", "type": "address", "indexed": true },
      { "name": "bondAmount", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ParametersUpdated",
    "inputs": [
      { "name": "loanDuration", "type": "uint256", "indexed": false },
      { "name": "timelockLoanReq", "type": "uint256", "indexed": false },
      { "name": "timelockBtcEscrow", "type": "uint256", "indexed": false },
      { "name": "timelockRepaymentAccept", "type": "uint256", "indexed": false },
      { "name": "timelockBtcCollateral", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LoanDefaulted",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "lender", "type": "address", "indexed": true },
      { "name": "bondAmount", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LoanDeleted",
    "inputs": [
      { "name": "loanId", "type": "uint256", "indexed": true },
      { "name": "borrower", "type": "address", "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EtherSwapAddressSet",
    "inputs": [
      { "name": "etherSwapAddress", "type": "address", "indexed": true }
    ],
    "anonymous": false
  }
]

*/

console.log(`📋 Using full ABI with ${BTC_COLLATERAL_LOAN_ABI.length} events and functions`)

class EVMEventMonitor {
  private provider: ethers.Provider
  private contract: ethers.Contract
  private isMonitoring: boolean = false
  private lastProcessedBlock: number = 0
  private processedEvents: Set<string> = new Set() // Track processed events by txHash+logIndex
  private lastSyncTime: Date | null = null // Track when last sync occurred

  constructor() {
    const rpcUrl = process.env.ANVIL_RPC_URL || process.env.EVM_RPC_URL || 'http://host.docker.internal:8545'
    this.provider = new ethers.JsonRpcProvider(rpcUrl)
    
    // Contract address from our deployment
    const contractAddress = process.env.BTC_COLLATERAL_LOAN_ADDRESS || '0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605'
    
    console.log(`📋 Loading ABI with ${BTC_COLLATERAL_LOAN_ABI.length} items`)
    console.log(`📋 Contract address: ${contractAddress}`)
    
    this.contract = new ethers.Contract(contractAddress, BTC_COLLATERAL_LOAN_ABI, this.provider)
    
    // Log available events
    const eventNames = this.contract.interface.fragments
      .filter(f => f.type === 'event')
      .map(f => (f as any).name)
    console.log(`📋 Available events: ${eventNames.join(', ')}`)
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Event monitoring already running')
      return
    }

    console.log('🚀 Starting EVM event monitoring...')
    this.isMonitoring = true

    // Get current block number
    const currentBlock = await this.provider.getBlockNumber()
    this.lastProcessedBlock = currentBlock - 1 // Start from previous block

    console.log(`📊 Starting from block: ${this.lastProcessedBlock}`)

    // Start monitoring loop
    this.monitorLoop()
  }

  private async monitorLoop() {
    while (this.isMonitoring) {
      try {
        const currentBlock = await this.provider.getBlockNumber()
        
        if (currentBlock > this.lastProcessedBlock) {
          console.log(`🔍 Processing blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`)
          
          // Get all events from the contract
          const allEvents = await this.contract.queryFilter("*", this.lastProcessedBlock + 1, currentBlock)
          
          for (const event of allEvents) {
            // Create unique event identifier using transaction hash and block number
            const eventId = `${event.transactionHash}-${event.blockNumber}`
            
            // Skip if already processed
            if (this.processedEvents.has(eventId)) {
              console.log(`⏭️ Skipping already processed event: ${eventId}`)
              continue
            }
            
            // Process the event
            await this.handleEvent(event)
            
            // Mark as processed
            this.processedEvents.add(eventId)
          }
          
          this.lastProcessedBlock = currentBlock
          
          // Clean up old processed events periodically
          this.clearOldProcessedEvents()
        }

        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000))
        
      } catch (error) {
        console.error('❌ Error in monitoring loop:', error)
        await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds on error
      }
    }
  }

  private manualParseEvent(event: any): any {
    const eventSignature = event.topics[0]
    console.log(`🔍 Manual parsing event with signature: ${eventSignature}`)
    
    // LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, string btcAddress)
    if (eventSignature === '0xfbba0893dd1f941cb4a7bb791aed3ce1ad2a008c20ef3254b2a2cf7752b199f1') {
      console.log(`📋 Manually parsing LoanRequested event`)
      const loanId = BigInt(event.topics[1])
      const borrower = '0x' + event.topics[2].slice(26) // Remove padding
      
      // Parse the data field for amount and btcAddress
      const data = event.data.slice(2) // Remove 0x prefix
      const amount = BigInt('0x' + data.slice(0, 64))
      
      // For the string (btcAddress), we need to decode it from the data
      // The string is at offset 0x40 (64 bytes) in the data
      const stringOffset = parseInt(data.slice(64, 128), 16) * 2 // Convert to hex offset
      const stringLength = parseInt(data.slice(stringOffset, stringOffset + 64), 16) * 2
      const btcAddressHex = data.slice(stringOffset + 64, stringOffset + 64 + stringLength)
      const btcAddress = Buffer.from(btcAddressHex, 'hex').toString('utf8')
      
      console.log(`📋 Parsed LoanRequested: loanId=${loanId}, borrower=${borrower}, amount=${amount}, btcAddress=${btcAddress}`)
      
      return {
        fragment: { name: 'LoanRequested' },
        args: {
          loanId,
          borrower,
          amount,
          btcAddress
        }
      }
    }
    
    // LenderPreimageHashAssociated(uint256 indexed loanId, address indexed lender, bytes32 preimageHashLender)
    if (eventSignature === '0xba765ac80d70c6ea721691828df85ccb151235037e23926de29f6a436ed1d79c') {
      const loanId = BigInt(event.topics[1])
      const lender = '0x' + event.topics[2].slice(26) // Remove padding
      const preimageHashLender = event.data
      
      return {
        fragment: { name: 'LenderPreimageHashAssociated' },
        args: {
          loanId,
          lender,
          preimageHashLender
        }
      }
    }
    
    // Add other event signatures as needed
    return null
  }

  private async handleEvent(event: any) {
    try {
      console.log(`📋 Full event object:`, JSON.stringify(event, null, 2))
      
      // If this is a raw event log, try to parse it with the contract
      let parsedEvent = event
      if (event.topics && !event.fragment) {
        console.log(`📋 Parsing raw event log with contract ABI...`)
        try {
          // Parse the raw event using the contract interface
          parsedEvent = this.contract.interface.parseLog(event)
          console.log(`📋 Parsed event:`, parsedEvent)
          
          // If ABI parsing returned null, try manual parsing
          if (!parsedEvent) {
            console.log(`❌ ABI parsing returned null, trying manual parsing...`)
            parsedEvent = this.manualParseEvent(event)
            if (!parsedEvent) {
              console.log(`❌ Manual parsing also failed`)
              return
            }
          }
        } catch (parseError) {
          console.log(`❌ Failed to parse event with ABI, trying manual parsing...`)
          // Manual parsing for known events
          parsedEvent = this.manualParseEvent(event)
          if (!parsedEvent) {
            console.log(`❌ Manual parsing also failed`)
            return
          }
        }
      }
      
      // Check if parsedEvent is null after all parsing attempts
      if (!parsedEvent) {
        console.log(`❌ All parsing attempts failed`)
        return
      }
      
      const eventName = parsedEvent.fragment?.name || 'Unknown'
      console.log(`📋 Processing ${eventName} event...`)
      console.log(`   Event fragment:`, parsedEvent.fragment)
      console.log(`   Event args:`, parsedEvent.args)

      switch (eventName) {
        case 'LenderUpdated':
          await this.handleLenderUpdated(parsedEvent)
          break
        case 'LoanRequested':
          await this.handleLoanRequested(parsedEvent)
          break
        case 'LenderPreimageHashAssociated':
          await this.handleLenderPreimageHashAssociated(parsedEvent)
          break
        case 'LoanOffered':
          await this.handleLoanOffered(parsedEvent)
          break
        case 'LoanActivated':
          await this.handleLoanActivated(parsedEvent)
          break
        case 'LoanRefundedToLender':
          await this.handleLoanRefundedToLender(parsedEvent)
          break
        case 'RepaymentAttempted':
          await this.handleRepaymentAttempted(parsedEvent)
          break
        case 'RepaymentAccepted':
          await this.handleRepaymentAccepted(parsedEvent)
          break
        case 'RepaymentRefundedToBorrowerWithBond':
          await this.handleRepaymentRefundedToBorrowerWithBond(parsedEvent)
          break
        case 'ParametersUpdated':
          await this.handleParametersUpdated(parsedEvent)
          break
        case 'LoanDefaulted':
          await this.handleLoanDefaulted(parsedEvent)
          break
        case 'LoanDeleted':
          await this.handleLoanDeleted(parsedEvent)
          break
        case 'EtherSwapAddressSet':
          await this.handleEtherSwapAddressSet(parsedEvent)
          break
        default:
          console.log(`⚠️ Unknown event type: ${eventName}`)
      }
    } catch (error) {
      console.error(`❌ Error handling event:`, error)
    }
  }

  private async handleLenderUpdated(event: any) {
    console.log('👤 Processing LenderUpdated event...')
    const lenderAddress = event.args.lender
    const btcPubkey = event.args.btcPubkey
    
    console.log(`   Lender: ${lenderAddress}`)
    console.log(`   BTC Pubkey: ${btcPubkey}`)
    
    // Create or update lender user
    const db = databaseService.getDatabase()
    if (db) {
      try {
        const existingUser = await db.select().from(users).where(eq(users.evmAddress, lenderAddress)).limit(1)
        if (existingUser.length > 0) {
          // Update existing user to lender role
          await db.update(users)
            .set({ 
              role: 'lender', 
              btcPubkey: btcPubkey,
              updatedAt: new Date() 
            })
            .where(eq(users.id, existingUser[0].id))
        } else {
          // Create new lender user
          await db.insert(users).values({
            evmAddress: lenderAddress,
            btcPubkey: btcPubkey,
            role: 'lender',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
        console.log(`✅ Lender ${lenderAddress} updated in database`)
      } catch (error) {
        console.error('❌ Error updating lender:', error)
      }
    }
  }

  private async handleLoanRequested(event: any) {
    try {
      console.log('📋 Processing LoanRequested event...')
      
      // Extract event data using ethers' decoded format
      const loanId = event.args.loanId.toString()
      const borrowerAddress = event.args.borrower
      const amount = event.args.amount.toString()
      const btcAddress = event.args.btcAddress

      console.log(`📋 Loan Details from event:`)
      console.log(`   ID: ${loanId}`)
      console.log(`   Borrower: ${borrowerAddress}`)
      console.log(`   Amount: ${amount} wei`)
      console.log(`   BTC Address: ${btcAddress}`)

      // Query contract for complete loan details
      console.log(`🔍 Querying contract for complete loan details...`)
      const contract = new ethers.Contract(
        process.env.CONTRACT_ADDRESS || '0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605',
        BTC_COLLATERAL_LOAN_ABI,
        this.provider
      )
      
      const loanData = await contract.getLoan(loanId)
      console.log(`📋 Complete loan data from contract:`)
      console.log(`   Borrower Address: ${loanData[0]}`)
      console.log(`   Borrower BTC Pubkey: ${loanData[1]}`)
      console.log(`   Amount: ${loanData[2]}`)
      console.log(`   Bond Amount: ${loanData[3]}`)
      console.log(`   Status: ${loanData[4]}`)
      console.log(`   Preimage Hash Borrower: ${loanData[5]}`)
      console.log(`   Preimage Hash Lender: ${loanData[6]}`)
      console.log(`   TXID P2TR0: ${loanData[7]}`)
      console.log(`   VOUT P2TR0: ${loanData[8]}`)
      console.log(`   Offer Block Height: ${loanData[9]}`)
      console.log(`   Activation Block Height: ${loanData[10]}`)
      console.log(`   Repayment Block Height: ${loanData[11]}`)

      // Store in database
      const db = databaseService.getDatabase()
      if (db) {
        // First, create or get the borrower user
        let borrowerUser
        try {
          // Try to find existing user
          const existingUser = await db.select().from(users).where(eq(users.evmAddress, borrowerAddress)).limit(1)
          if (existingUser.length > 0) {
            borrowerUser = existingUser[0]
          } else {
            // Create new user
            const newUser = await db.insert(users).values({
              evmAddress: borrowerAddress,
              btcPubkey: loanData[1], // borrowerBtcPubkey
              role: 'borrower',
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning()
            borrowerUser = newUser[0]
          }
        } catch (error) {
          console.error('❌ Error creating/finding user:', error)
          return
        }

        // Check if loan already exists to prevent duplicates
        const existingLoan = await db.select().from(loans).where(eq(loans.loanReqId, loanId.toString())).limit(1)
        
        if (existingLoan.length > 0) {
          console.log(`⚠️  Loan ${loanId} already exists, skipping insertion`)
          return
        }

        // Get contract parameters
        const contractParams = await this.getContractParameters()
        console.log(`📋 Contract parameters:`, contractParams)

        // Insert loan record with complete data from contract
        await db.insert(loans).values({
          loanReqId: loanId.toString(),
          borrowerId: borrowerUser.id,
          amount: amount,
          durationBlocks: contractParams.loanDuration,
          status: 'requested',
          borrowerBtcPubkey: loanData[1], // borrowerBtcPubkey
          preimageHashBorrower: loanData[5], // preimageHashBorrower
          btcTxid: loanData[7], // txid_p2tr0
          btcVout: Number(loanData[8]), // vout_p2tr0
          btcAddress: btcAddress,
          preimageHashLender: loanData[6], // preimageHashLender
          timelockLoanReq: contractParams.timelockLoanReq,
          timelockBtcEscrow: contractParams.timelockBtcEscrow,
          timelockRepaymentAccept: contractParams.timelockRepaymentAccept,
          timelockBtcCollateral: contractParams.timelockBtcCollateral,
          requestBlockHeight: event.blockNumber,
          offerBlockHeight: loanData[9] ? Number(loanData[9]) : null, // offerBlockheight
          activationBlockHeight: loanData[10] ? Number(loanData[10]) : null, // activationBlockheight
          repaymentBlockHeight: loanData[11] ? Number(loanData[11]) : null, // repaymentBlockheight
          createdAt: new Date(),
          updatedAt: new Date()
        })

        console.log(`✅ Loan ${loanId} stored in database`)
        
        // Trigger sync after processing loan request
        setTimeout(() => {
          this.syncExistingLoans()
        }, 5000) // Wait 5 seconds for transaction to be mined
      }

    } catch (error) {
      console.error('❌ Error handling LoanRequested event:', error)
    }
  }

  private async handleLenderPreimageHashAssociated(event: any) {
    console.log('🔗 Processing LenderPreimageHashAssociated event...')
    const loanId = event.args.loanId.toString()
    const lenderAddress = event.args.lender
    const preimageHashLender = event.args.preimageHashLender
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Lender: ${lenderAddress}`)
    console.log(`   Preimage Hash: ${preimageHashLender}`)
    
    // Update loan with lender preimage hash and BTC pubkey
    const db = databaseService.getDatabase()
    if (db) {
      try {
        // Get lender's BTC pubkey from the contract
        console.log(`🔍 Querying contract for lender BTC pubkey...`)
        const contract = new ethers.Contract(
          process.env.CONTRACT_ADDRESS || '0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605',
          BTC_COLLATERAL_LOAN_ABI,
          this.provider
        )
        
        const lenderBtcPubkey = await contract.lenderBtcPubkey()
        console.log(`   Lender BTC Pubkey from contract: ${lenderBtcPubkey}`)
        
        await db.update(loans)
          .set({
            preimageHashLender: preimageHashLender,
            lenderBtcPubkey: lenderBtcPubkey,
            updatedAt: new Date()
          })
          .where(eq(loans.loanReqId, loanId.toString()))
        
        console.log(`✅ Loan ${loanId} updated with lender preimage hash and BTC pubkey from contract`)
        
        // Now calculate and store the escrow and collateral addresses
        console.log(`🏠 Calculating addresses for loan ${loanId}...`)
        const addresses = await this.calculateLoanAddresses(loanId, db)
        if (addresses.escrowAddress || addresses.collateralAddress) {
          await db.update(loans)
            .set({
              escrowAddress: addresses.escrowAddress,
              collateralAddress: addresses.collateralAddress,
              updatedAt: new Date()
            })
            .where(eq(loans.loanReqId, loanId.toString()))
          
          console.log(`✅ Loan ${loanId} addresses updated:`, {
            escrowAddress: addresses.escrowAddress,
            collateralAddress: addresses.collateralAddress
          })
        } else {
          console.log(`⚠️ Could not calculate addresses for loan ${loanId} - missing required data`)
        }
      } catch (error) {
        console.error('❌ Error updating lender preimage hash:', error)
      }
    }
  }

  private async handleLoanOffered(event: any) {
    console.log('💰 Processing LoanOffered event...')
    const loanId = event.args.loanId.toString()
    const lenderAddress = event.args.lender
    const amount = event.args.amount.toString()
    const bondAmount = event.args.bondAmount.toString()
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Lender: ${lenderAddress}`)
    console.log(`   Amount: ${amount} wei`)
    console.log(`   Bond: ${bondAmount} wei`)
    
    // Update loan with lender info
    const db = databaseService.getDatabase()
    if (db) {
      try {
        // Find the loan
        const existingLoans = await db.select().from(loans).where(eq(loans.loanReqId, loanId.toString())).limit(1)
        if (existingLoans.length > 0) {
          // Get or create lender user
          let lenderUser
          const existingLender = await db.select().from(users).where(eq(users.evmAddress, lenderAddress)).limit(1)
          if (existingLender.length > 0) {
            lenderUser = existingLender[0]
          } else {
            const newLender = await db.insert(users).values({
              evmAddress: lenderAddress,
              role: 'lender',
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning()
            lenderUser = newLender[0]
          }
          
          // Update loan
          await db.update(loans)
            .set({
              lenderId: lenderUser.id,
              bondAmount: bondAmount,
              status: 'offered',
              offerBlockHeight: event.blockNumber,
              updatedAt: new Date()
            })
            .where(eq(loans.loanReqId, loanId.toString()))
          
          console.log(`✅ Loan ${loanId} updated with offer`)
        }
      } catch (error) {
        console.error('❌ Error updating loan offer:', error)
      }
    }
  }

  private async handleLoanActivated(event: any) {
    console.log('🚀 Processing LoanActivated event...')
    const loanId = event.args.loanId.toString()
    const borrowerAddress = event.args.borrower
    const preimageBorrower = event.args.preimageBorrower
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Borrower: ${borrowerAddress}`)
    console.log(`   Preimage: ${preimageBorrower}`)
    
    // Update loan status and store preimage
    const db = databaseService.getDatabase()
    if (db) {
      try {
        // First, update the basic loan status and preimage
        await db.update(loans)
          .set({
            status: 'active',
            activationBlockHeight: event.blockNumber,
            preimageBorrower: preimageBorrower,
            updatedAt: new Date()
          })
          .where(eq(loans.loanReqId, loanId.toString()))
        
        console.log(`✅ Loan ${loanId} activated with preimage stored`)
        
        // Note: Addresses should already be calculated and stored when lender associated preimage hash
        // Now complete the witness transaction
        await this.completeWitnessTransaction(loanId, preimageBorrower, db)
        
      } catch (error) {
        console.error('❌ Error activating loan:', error)
      }
    }
  }

  private async calculateLoanAddresses(loanId: string, db: any): Promise<{escrowAddress?: string | undefined, collateralAddress?: string | undefined}> {
    try {
      console.log(`🏠 Calculating addresses for loan ${loanId}...`)

      // Get loan details from database
      const loanRecord = await db.select()
        .from(loans)
        .where(eq(loans.loanReqId, loanId))
        .limit(1)

      console.log(`🔍 Debug - Database query result for loan ${loanId}:`, {
        recordCount: loanRecord.length,
        records: loanRecord
      })

      if (loanRecord.length === 0) {
        console.log(`⚠️ No loan record found for loan ${loanId}`)
        return {}
      }

      const loan = loanRecord[0]
      console.log(`🔍 Debug - Raw loan data from DB:`, {
        borrowerBtcPubkey: loan.borrowerBtcPubkey,
        lenderBtcPubkey: loan.lenderBtcPubkey,
        preimageHashBorrower: loan.preimageHashBorrower,
        preimageHashLender: loan.preimageHashLender,
        timelockBtcEscrow: loan.timelockBtcEscrow,
        timelockBtcCollateral: loan.timelockBtcCollateral
      })

      // Check if we have all required data
      if (!loan.borrowerBtcPubkey || !loan.lenderBtcPubkey || !loan.preimageHashBorrower || !loan.preimageHashLender) {
        console.log(`⚠️ Missing required data for address calculation:`, {
          borrowerBtcPubkey: !!loan.borrowerBtcPubkey,
          lenderBtcPubkey: !!loan.lenderBtcPubkey,
          preimageHashBorrower: !!loan.preimageHashBorrower,
          preimageHashLender: !!loan.preimageHashLender
        })
        return {}
      }
      
      const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8001'
      
      // Debug: Log the preimage hashes before sending
      console.log(`🔍 Debug - Preimage hashes before processing:`, {
        preimageHashBorrower: loan.preimageHashBorrower,
        preimageHashLender: loan.preimageHashLender,
        borrowerBtcPubkey: loan.borrowerBtcPubkey,
        lenderBtcPubkey: loan.lenderBtcPubkey
      })
      
      // Calculate escrow address (nums_p2tr_addr_0)
      const escrowResponse = await fetch(`${pythonApiUrl}/vaultero/nums-p2tr-addr-0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          borrower_pubkey: loan.borrowerBtcPubkey,
          lender_pubkey: loan.lenderBtcPubkey,
          preimage_hash_borrower: loan.preimageHashBorrower?.replace('0x', ''),
          borrower_timelock: Math.floor(loan.timelockBtcEscrow / 20)
        }),
      })
      
      let escrowAddress: string | undefined
      if (escrowResponse.ok) {
        const escrowResult = await escrowResponse.json() as { nums_p2tr_addr: string }
        escrowAddress = escrowResult.nums_p2tr_addr
        console.log(`✅ Escrow address calculated: ${escrowAddress}`)
      } else {
        console.error(`❌ Failed to calculate escrow address: ${escrowResponse.status}`)
      }
      
      // Calculate collateral address (nums_p2tr_addr_1)
      const collateralResponse = await fetch(`${pythonApiUrl}/vaultero/nums-p2tr-addr-1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          borrower_pubkey: loan.borrowerBtcPubkey,
          lender_pubkey: loan.lenderBtcPubkey,
          preimage_hash_lender: loan.preimageHashLender?.replace('0x', ''),
          lender_timelock: Math.floor(loan.timelockBtcCollateral / 20)
        }),
      })
      
      let collateralAddress: string | undefined
      if (collateralResponse.ok) {
        const collateralResult = await collateralResponse.json() as { nums_p2tr_addr: string }
        collateralAddress = collateralResult.nums_p2tr_addr
        console.log(`✅ Collateral address calculated: ${collateralAddress}`)
      } else {
        console.error(`❌ Failed to calculate collateral address: ${collateralResponse.status}`)
      }
      
      return { escrowAddress, collateralAddress }
      
    } catch (error) {
      console.error('❌ Error calculating loan addresses:', error)
      return {}
    }
  }

  private async completeWitnessTransaction(loanId: string, preimageBorrower: string, db: any) {
    try {
      console.log(`🔄 Completing witness transaction for loan ${loanId}...`)
      
      // Get the borrower signature from the database
      const borrowerSignatureRecord = await db.select()
        .from(borrowerSignatures)
        .where(eq(borrowerSignatures.loanId, loanId))
        .limit(1)
      
      if (borrowerSignatureRecord.length === 0) {
        console.log(`⚠️ No borrower signature found for loan ${loanId}`)
        return
      }
      
      const signatureData = borrowerSignatureRecord[0].signatureData
      
      // Get loan details for additional context
      const loanRecord = await db.select()
        .from(loans)
        .where(eq(loans.loanReqId, loanId))
        .limit(1)
      
      if (loanRecord.length === 0) {
        console.log(`⚠️ No loan record found for loan ${loanId}`)
        return
      }
      
      const loan = loanRecord[0]
      
      // Call the complete_witness endpoint
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002'
      const response = await fetch(`${backendUrl}/api/signature-verification/complete-witness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loanId: loanId,
          borrowerSignature: signatureData,
          borrowerPreimage: preimageBorrower
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Complete witness failed: ${response.status}`)
      }
      
      const result = await response.json() as any
      
      if (result.success && result.data && result.data.txid) {
        // Update the loan with the Bitcoin transaction ID
        await db.update(loans)
          .set({
            collateralCommitTx: result.data.txid,
            updatedAt: new Date()
          })
          .where(eq(loans.loanReqId, loanId))
        
        console.log(`✅ Witness transaction completed for loan ${loanId}, TXID: ${result.data.txid}`)
      } else {
        console.log(`⚠️ Complete witness failed for loan ${loanId}:`, result.message)
      }
      
    } catch (error) {
      console.error(`❌ Error completing witness transaction for loan ${loanId}:`, error)
    }
  }

  private async handleLoanRefundedToLender(event: any) {
    console.log('💸 Processing LoanRefundedToLender event...')
    const loanId = event.args.loanId.toString()
    const lenderAddress = event.args.lender
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Lender: ${lenderAddress}`)
    
    // Update loan status
    const db = databaseService.getDatabase()
    if (db) {
      try {
        await db.update(loans)
          .set({
            status: 'refunded_to_lender',
            updatedAt: new Date()
          })
          .where(eq(loans.loanReqId, loanId.toString()))
        
        console.log(`✅ Loan ${loanId} refunded to lender`)
      } catch (error) {
        console.error('❌ Error updating loan refund:', error)
      }
    }
  }

  private async handleRepaymentAttempted(event: any) {
    console.log('💳 Processing RepaymentAttempted event...')
    const loanId = event.args.loanId.toString()
    const borrowerAddress = event.args.borrower
    const amount = event.args.amount.toString()
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Borrower: ${borrowerAddress}`)
    console.log(`   Amount: ${amount} wei`)
    
    // Update loan status
    const db = databaseService.getDatabase()
    if (db) {
      try {
        await db.update(loans)
          .set({
            status: 'repayment_attempted',
            updatedAt: new Date()
          })
          .where(eq(loans.loanReqId, loanId.toString()))
        
        console.log(`✅ Loan ${loanId} repayment attempted`)
      } catch (error) {
        console.error('❌ Error updating repayment attempt:', error)
      }
    }
  }

  private async handleRepaymentAccepted(event: any) {
    console.log('✅ Processing RepaymentAccepted event...')
    const loanId = event.args.loanId.toString()
    const lenderAddress = event.args.lender
    const preimageLender = event.args.preimageLender
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Lender: ${lenderAddress}`)
    console.log(`   Preimage: ${preimageLender}`)
    
    // Update loan status and store preimage
    const db = databaseService.getDatabase()
    if (db) {
      try {
        await db.update(loans)
          .set({
            status: 'repayment_accepted',
            repaymentBlockHeight: event.blockNumber,
            preimageLender: preimageLender,
            updatedAt: new Date()
          })
          .where(eq(loans.loanReqId, loanId.toString()))
        
        console.log(`✅ Loan ${loanId} repayment accepted with preimage stored`)
      } catch (error) {
        console.error('❌ Error updating repayment acceptance:', error)
      }
    }
  }

  private async handleRepaymentRefundedToBorrowerWithBond(event: any) {
    console.log('💰 Processing RepaymentRefundedToBorrowerWithBond event...')
    const loanId = event.args.loanId.toString()
    const borrowerAddress = event.args.borrower
    const bondAmount = event.args.bondAmount.toString()
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Borrower: ${borrowerAddress}`)
    console.log(`   Bond Amount: ${bondAmount} wei`)
    
    // Update loan status
    const db = databaseService.getDatabase()
    if (db) {
      try {
        await db.update(loans)
          .set({
            status: 'repayment_refunded_with_bond',
            updatedAt: new Date()
          })
          .where(eq(loans.loanReqId, loanId.toString()))
        
        console.log(`✅ Loan ${loanId} repayment refunded with bond`)
      } catch (error) {
        console.error('❌ Error updating repayment refund:', error)
      }
    }
  }

  private async handleParametersUpdated(event: any) {
    console.log('⚙️ Processing ParametersUpdated event...')
    const timelockLoanReq = event.args.timelockLoanReq.toString()
    const timelockBtcEscrow = event.args.timelockBtcEscrow.toString()
    const timelockRepaymentAccept = event.args.timelockRepaymentAccept.toString()
    const timelockBtcCollateral = event.args.timelockBtcCollateral.toString()
    
    console.log(`   Timelock Loan Req: ${timelockLoanReq}`)
    console.log(`   Timelock BTC Escrow: ${timelockBtcEscrow}`)
    console.log(`   Timelock Repayment Accept: ${timelockRepaymentAccept}`)
    console.log(`   Timelock BTC Collateral: ${timelockBtcCollateral}`)
    
    // This is a system-wide parameter update, we could store it in a config table
    console.log(`✅ Parameters updated`)
  }

  private async handleLoanDefaulted(event: any) {
    console.log('❌ Processing LoanDefaulted event...')
    const loanId = event.args.loanId.toString()
    const lenderAddress = event.args.lender
    const bondAmount = event.args.bondAmount.toString()
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Lender: ${lenderAddress}`)
    console.log(`   Bond Amount: ${bondAmount} wei`)
    
    // Update loan status
    const db = databaseService.getDatabase()
    if (db) {
      try {
        await db.update(loans)
          .set({
            status: 'defaulted',
            updatedAt: new Date()
          })
          .where(eq(loans.loanReqId, loanId.toString()))
        
        console.log(`✅ Loan ${loanId} defaulted`)
      } catch (error) {
        console.error('❌ Error updating loan default:', error)
      }
    }
  }

  private async handleLoanDeleted(event: any) {
    console.log('🗑️ Processing LoanDeleted event...')
    const loanId = event.args.loanId.toString()
    const borrowerAddress = event.args.borrower
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Borrower: ${borrowerAddress}`)
    
    // Update loan status
    const db = databaseService.getDatabase()
    if (db) {
      try {
        await db.update(loans)
          .set({
            status: 'deleted',
            updatedAt: new Date()
          })
          .where(eq(loans.loanReqId, loanId.toString()))
        
        console.log(`✅ Loan ${loanId} deleted`)
      } catch (error) {
        console.error('❌ Error updating loan deletion:', error)
      }
    }
  }

  private async handleEtherSwapAddressSet(event: any) {
    console.log('🔄 Processing EtherSwapAddressSet event...')
    const etherSwapAddress = event.args.etherSwapAddress
    
    console.log(`   EtherSwap Address: ${etherSwapAddress}`)
    
    // This is a system configuration update
    console.log(`✅ EtherSwap address updated`)
  }


  stopMonitoring() {
    console.log('🛑 Stopping EVM event monitoring...')
    this.isMonitoring = false
  }

  // Get last sync time for UI display
  getLastSyncTime(): Date | null {
    return this.lastSyncTime
  }

  // Sync existing loans with contract data
  private async syncExistingLoans() {
    try {
      console.log('🔄 Starting event-triggered sync of existing loans...')
      
      const db = databaseService.getDatabase()
      if (!db) {
        console.error('❌ Database not available for sync')
        return
      }

      // Get total number of loans from contract
      const totalLoans = await this.contract.getTotalLoans()
      console.log(`📊 Total loans on contract: ${totalLoans}`)
      
      // Query each loan and update database
      for (let i = 1; i <= Number(totalLoans); i++) {
        try {
          const loanData = await this.contract.getLoan(i)
          
          // Update database with complete loan data
          await db.update(loans)
            .set({
              borrowerBtcPubkey: loanData[1], // borrowerBtcPubkey
              preimageHashBorrower: loanData[5], // preimageHashBorrower
              btcTxid: loanData[7], // txid_p2tr0
              btcVout: Number(loanData[8]), // vout_p2tr0
              preimageHashLender: loanData[6], // preimageHashLender
              offerBlockHeight: loanData[9] ? Number(loanData[9]) : null, // offerBlockheight
              activationBlockHeight: loanData[10] ? Number(loanData[10]) : null, // activationBlockheight
              repaymentBlockHeight: loanData[11] ? Number(loanData[11]) : null, // repaymentBlockheight
              updatedAt: new Date()
            })
            .where(eq(loans.loanReqId, i.toString()))
          
          console.log(`✅ Synced loan ${i}`)
        } catch (error) {
          console.error(`❌ Error syncing loan ${i}:`, error instanceof Error ? error.message : 'Unknown error')
        }
      }
      
      // Update last sync time
      this.lastSyncTime = new Date()
      console.log(`✅ Event-triggered sync completed at ${this.lastSyncTime.toISOString()}`)
      
    } catch (error) {
      console.error('❌ Error during event-triggered sync:', error)
    }
  }

  /**
   * Read contract parameters from the blockchain
   */
  private async getContractParameters() {
    try {
      const [
        loanDuration,
        timelockLoanReq,
        timelockBtcEscrow,
        timelockRepaymentAccept,
        timelockBtcCollateral
      ] = await Promise.all([
        this.contract.loanDuration(),
        this.contract.timelockLoanReq(),
        this.contract.timelockBtcEscrow(),
        this.contract.timelockRepaymentAccept(),
        this.contract.timelockBtcCollateral()
      ])

      return {
        loanDuration: Number(loanDuration),
        timelockLoanReq: Number(timelockLoanReq),
        timelockBtcEscrow: Number(timelockBtcEscrow),
        timelockRepaymentAccept: Number(timelockRepaymentAccept),
        timelockBtcCollateral: Number(timelockBtcCollateral)
      }
    } catch (error) {
      console.error('❌ Error reading contract parameters:', error)
      // Return default values if contract read fails
      return {
        loanDuration: 100,
        timelockLoanReq: 100,
        timelockBtcEscrow: 100,
        timelockRepaymentAccept: 100,
        timelockBtcCollateral: 100
      }
    }
  }

  private clearOldProcessedEvents() {
    // Keep only the last 1000 processed events to prevent memory buildup
    if (this.processedEvents.size > 1000) {
      const eventsArray = Array.from(this.processedEvents)
      this.processedEvents.clear()
      // Keep the most recent 500 events
      eventsArray.slice(-500).forEach(eventId => this.processedEvents.add(eventId))
      console.log(`🧹 Cleaned up old processed events, keeping ${this.processedEvents.size} recent events`)
    }
  }
}

export default new EVMEventMonitor()
