import { ethers } from 'ethers'
import { eq } from 'drizzle-orm'
import databaseService from './databaseService'
import { loans, users } from '../db/schema'

// Complete ABI for all BtcCollateralLoan events
const BTC_COLLATERAL_LOAN_ABI = [
  "event LenderUpdated(address indexed lender, string btcPubkey)",
  "event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, string btcAddress)",
  "event LoanOffered(uint256 indexed loanId, address indexed lender, uint256 amount, uint256 bondAmount)",
  "event LoanActivated(uint256 indexed loanId, address indexed borrower)",
  "event LoanRefundedToLender(uint256 indexed loanId, address indexed lender)",
  "event RepaymentAttempted(uint256 indexed loanId, address indexed borrower, uint256 amount)",
  "event RepaymentAccepted(uint256 indexed loanId, address indexed lender)",
  "event RepaymentRefundedToBorrowerWithBond(uint256 indexed loanId, address indexed borrower, uint256 bondAmount)",
  "event ParametersUpdated(uint256 timelockLoanReq, uint256 timelockBtcEscrow, uint256 timelockRepaymentAccept, uint256 timelockBtcCollateral)",
  "event LoanDefaulted(uint256 indexed loanId, address indexed lender, uint256 bondAmount)",
  "event LoanDeleted(uint256 indexed loanId, address indexed borrower)",
  "event EtherSwapAddressSet(address indexed etherSwapAddress)"
]

class EVMEventMonitor {
  private provider: ethers.Provider
  private contract: ethers.Contract
  private isMonitoring: boolean = false
  private lastProcessedBlock: number = 0
  private processedEvents: Set<string> = new Set() // Track processed events by txHash+logIndex

  constructor() {
    const rpcUrl = process.env.EVM_RPC_URL || 'http://host.docker.internal:8545'
    this.provider = new ethers.JsonRpcProvider(rpcUrl)
    
    // Contract address from our deployment
    const contractAddress = process.env.BTC_COLLATERAL_LOAN_ADDRESS || '0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605'
    this.contract = new ethers.Contract(contractAddress, BTC_COLLATERAL_LOAN_ABI, this.provider)
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

  private async handleEvent(event: any) {
    try {
      const eventName = event.fragment?.name || 'Unknown'
      console.log(`📋 Processing ${eventName} event...`)

      switch (eventName) {
        case 'LenderUpdated':
          await this.handleLenderUpdated(event)
          break
        case 'LoanRequested':
          await this.handleLoanRequested(event)
          break
        case 'LoanOffered':
          await this.handleLoanOffered(event)
          break
        case 'LoanActivated':
          await this.handleLoanActivated(event)
          break
        case 'LoanRefundedToLender':
          await this.handleLoanRefundedToLender(event)
          break
        case 'RepaymentAttempted':
          await this.handleRepaymentAttempted(event)
          break
        case 'RepaymentAccepted':
          await this.handleRepaymentAccepted(event)
          break
        case 'RepaymentRefundedToBorrowerWithBond':
          await this.handleRepaymentRefundedToBorrowerWithBond(event)
          break
        case 'ParametersUpdated':
          await this.handleParametersUpdated(event)
          break
        case 'LoanDefaulted':
          await this.handleLoanDefaulted(event)
          break
        case 'LoanDeleted':
          await this.handleLoanDeleted(event)
          break
        case 'EtherSwapAddressSet':
          await this.handleEtherSwapAddressSet(event)
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
            .set({ role: 'lender', updatedAt: new Date() })
            .where(eq(users.id, existingUser[0].id))
        } else {
          // Create new lender user
          await db.insert(users).values({
            evmAddress: lenderAddress,
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

      console.log(`📋 Loan Details:`)
      console.log(`   ID: ${loanId}`)
      console.log(`   Borrower: ${borrowerAddress}`)
      console.log(`   Amount: ${amount} wei`)
      console.log(`   BTC Address: ${btcAddress}`)

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

        // Insert loan record
        await db.insert(loans).values({
          evmContractId: BigInt(loanId),
          borrowerId: borrowerUser.id,
          amount: amount,
          durationBlocks: 100, // Default duration
          status: 'requested',
          borrowerBtcPubkey: '', // Will be filled later
          timelockLoanReq: 100,
          timelockBtcEscrow: 100,
          timelockRepaymentAccept: 100,
          timelockBtcCollateral: 100,
          requestBlockHeight: BigInt(event.blockNumber),
          createdAt: new Date(),
          updatedAt: new Date()
        })

        console.log(`✅ Loan ${loanId} stored in database`)
      }

    } catch (error) {
      console.error('❌ Error handling LoanRequested event:', error)
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
        const existingLoans = await db.select().from(loans).where(eq(loans.evmContractId, BigInt(loanId))).limit(1)
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
              offerBlockHeight: BigInt(event.blockNumber),
              updatedAt: new Date()
            })
            .where(eq(loans.evmContractId, BigInt(loanId)))
          
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
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Borrower: ${borrowerAddress}`)
    
    // Update loan status
    const db = databaseService.getDatabase()
    if (db) {
      try {
        await db.update(loans)
          .set({
            status: 'active',
            activationBlockHeight: BigInt(event.blockNumber),
            updatedAt: new Date()
          })
          .where(eq(loans.evmContractId, BigInt(loanId)))
        
        console.log(`✅ Loan ${loanId} activated`)
      } catch (error) {
        console.error('❌ Error activating loan:', error)
      }
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
          .where(eq(loans.evmContractId, BigInt(loanId)))
        
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
          .where(eq(loans.evmContractId, BigInt(loanId)))
        
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
    
    console.log(`   Loan ID: ${loanId}`)
    console.log(`   Lender: ${lenderAddress}`)
    
    // Update loan status
    const db = databaseService.getDatabase()
    if (db) {
      try {
        await db.update(loans)
          .set({
            status: 'repayment_accepted',
            repaymentBlockHeight: BigInt(event.blockNumber),
            updatedAt: new Date()
          })
          .where(eq(loans.evmContractId, BigInt(loanId)))
        
        console.log(`✅ Loan ${loanId} repayment accepted`)
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
          .where(eq(loans.evmContractId, BigInt(loanId)))
        
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
          .where(eq(loans.evmContractId, BigInt(loanId)))
        
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
          .where(eq(loans.evmContractId, BigInt(loanId)))
        
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
