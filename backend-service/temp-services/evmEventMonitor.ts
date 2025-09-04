/**
 * EVM Contract Event Monitor Service
 * 
 * This service monitors EVM smart contracts for loan-related events and
 * coordinates with the loan orchestration engine to maintain state consistency.
 */

import { foundryEVMService } from './foundryEVMService'
import { db } from '../db/connection'
import { evmEvents, loans, loanEvents } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

// Event log interface for Foundry Cast logs
export interface EventLog {
  address: string
  topics: string[]
  data: string
  blockNumber: number
  transactionHash: string
  logIndex: number
}

// Contract ABIs and addresses
const BTC_COLLATERAL_LOAN_ABI = [
  "event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, string borrowerBtcPubkey, bytes32 preimageHashBorrower, bytes32 txidP2tr0, uint32 voutP2tr0)",
  "event LoanOffered(uint256 indexed loanId, address indexed lender, uint256 bondAmount, string lenderBtcPubkey, bytes32 preimageHashLender)",
  "event LoanActivated(uint256 indexed loanId, address indexed borrower)",
  "event RepaymentInProgress(uint256 indexed loanId, address indexed borrower)",
  "event LoanRepaid(uint256 indexed loanId, address indexed lender)",
  "event LoanRefundedToLender(uint256 indexed loanId, address indexed lender)",
  "event LoanRefundedToBorrower(uint256 indexed loanId, address indexed borrower)",
  "event LoanDefaulted(uint256 indexed loanId, address indexed lender)"
]

const ETHER_SWAP_ABI = [
  "event SwapClaimed(bytes32 indexed preimageHash, address indexed claimer, uint256 amount)",
  "event SwapRefunded(bytes32 indexed preimageHash, address indexed refunder, uint256 amount)"
]

interface ContractConfig {
  address: string
  abi: string[]
  name: string
}

interface EventProcessingResult {
  success: boolean
  error?: string
  processedEvents: number
}

export class EVMEventMonitorService {
  private contracts: Map<string, { address: string; abi: string }>
  private isMonitoring: boolean = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private lastProcessedBlock: number = 0

  constructor(
    private rpcUrl: string,
    private contractConfigs: ContractConfig[]
  ) {
    this.contracts = new Map()
    this.initializeContracts()
  }

  /**
   * Initialize contract instances for monitoring
   */
  private initializeContracts(): void {
    for (const config of this.contractConfigs) {
      this.contracts.set(config.name, {
        address: config.address,
        abi: config.abi
      })
    }
  }

  /**
   * Start monitoring EVM contracts for events
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ EVM Event Monitor is already running')
      return
    }

    console.log('🚀 Starting EVM Event Monitor...')
    
    // Get the last processed block from database
    await this.loadLastProcessedBlock()
    
    this.isMonitoring = true
    
    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.processNewEvents()
      } catch (error) {
        console.error('❌ Error in EVM event monitoring:', error)
        // Continue monitoring even if there's an error
      }
    }, 5000) // Check every 5 seconds

    console.log('✅ EVM Event Monitor started successfully')
  }

  /**
   * Stop monitoring EVM contracts
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      console.log('⚠️ EVM Event Monitor is not running')
      return
    }

    console.log('🛑 Stopping EVM Event Monitor...')
    
    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    console.log('✅ EVM Event Monitor stopped successfully')
  }

  /**
   * Load the last processed block from database
   */
  private async loadLastProcessedBlock(): Promise<void> {
    try {
      const lastEvent = await db
        .select({ blockNumber: evmEvents.blockNumber })
        .from(evmEvents)
        .orderBy(desc(evmEvents.blockNumber))
        .limit(1)

      if (lastEvent.length > 0) {
        this.lastProcessedBlock = Number(lastEvent[0].blockNumber)
        console.log(`📊 Last processed block: ${this.lastProcessedBlock}`)
      } else {
        // Start from current block if no events processed yet
        const currentBlock = await this.provider.getBlockNumber()
        this.lastProcessedBlock = currentBlock - 100 // Start from 100 blocks ago for safety
        console.log(`📊 Starting from block: ${this.lastProcessedBlock}`)
      }
    } catch (error) {
      console.error('❌ Error loading last processed block:', error)
      throw error
    }
  }

  /**
   * Process new events from all monitored contracts
   */
  private async processNewEvents(): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber()
    
    if (currentBlock <= this.lastProcessedBlock) {
      return // No new blocks to process
    }

    console.log(`🔍 Processing events from block ${this.lastProcessedBlock + 1} to ${currentBlock}`)

    for (const [contractName, contract] of this.contracts) {
      try {
        await this.processContractEvents(contractName, contract, this.lastProcessedBlock + 1, currentBlock)
      } catch (error) {
        console.error(`❌ Error processing events for contract ${contractName}:`, error)
      }
    }

    this.lastProcessedBlock = currentBlock
  }

  /**
   * Process events for a specific contract
   */
  private async processContractEvents(
    contractName: string,
    contract: ethers.Contract,
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    try {
      // Get all events from the contract
      const filter = {
        fromBlock,
        toBlock
      }

      const events = await contract.queryFilter(filter)
      
      for (const event of events) {
        await this.processEvent(contractName, event)
      }

      if (events.length > 0) {
        console.log(`📝 Processed ${events.length} events from ${contractName}`)
      }
    } catch (error) {
      console.error(`❌ Error querying events for ${contractName}:`, error)
      throw error
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(contractName: string, event: EventLog | Log): Promise<void> {
    try {
      // Store the raw event in database
      const eventId = uuidv4()
      
      await db.insert(evmEvents).values({
        id: eventId,
        contractAddress: event.address,
        eventName: event.topics[0], // First topic is the event signature
        blockNumber: BigInt(event.blockNumber),
        transactionHash: event.transactionHash,
        logIndex: event.index,
        eventData: {
          topics: event.topics,
          data: event.data,
          args: event instanceof EventLog ? event.args : null
        },
        processingStatus: 'pending'
      })

      // Process the event based on contract type
      if (contractName === 'BtcCollateralLoan') {
        await this.processLoanEvent(event)
      } else if (contractName === 'EtherSwap') {
        await this.processSwapEvent(event)
      }

      // Mark event as processed
      await db
        .update(evmEvents)
        .set({ 
          processingStatus: 'processed',
          processedAt: new Date()
        })
        .where(eq(evmEvents.id, eventId))

    } catch (error) {
      console.error('❌ Error processing event:', error)
      
      // Mark event as failed
      if (event.transactionHash) {
        await db
          .update(evmEvents)
          .set({ 
            processingStatus: 'failed',
            eventData: {
              ...event,
              processingError: error instanceof Error ? error.message : String(error)
            }
          })
          .where(and(
            eq(evmEvents.transactionHash, event.transactionHash),
            eq(evmEvents.logIndex, event.index)
          ))
      }
    }
  }

  /**
   * Process loan-related events
   */
  private async processLoanEvent(event: EventLog | Log): Promise<void> {
    if (!(event instanceof EventLog)) {
      return // Skip non-EventLog events
    }

    const eventName = event.fragment.name
    const args = event.args

    console.log(`🔄 Processing loan event: ${eventName}`)

    switch (eventName) {
      case 'LoanRequested':
        await this.handleLoanRequested(args)
        break
      case 'LoanOffered':
        await this.handleLoanOffered(args)
        break
      case 'LoanActivated':
        await this.handleLoanActivated(args)
        break
      case 'RepaymentInProgress':
        await this.handleRepaymentInProgress(args)
        break
      case 'LoanRepaid':
        await this.handleLoanRepaid(args)
        break
      case 'LoanRefundedToLender':
        await this.handleLoanRefundedToLender(args)
        break
      case 'LoanRefundedToBorrower':
        await this.handleLoanRefundedToBorrower(args)
        break
      case 'LoanDefaulted':
        await this.handleLoanDefaulted(args)
        break
      default:
        console.log(`⚠️ Unknown loan event: ${eventName}`)
    }
  }

  /**
   * Process swap-related events
   */
  private async processSwapEvent(event: EventLog | Log): Promise<void> {
    if (!(event instanceof EventLog)) {
      return
    }

    const eventName = event.fragment.name
    const args = event.args

    console.log(`🔄 Processing swap event: ${eventName}`)

    switch (eventName) {
      case 'SwapClaimed':
        await this.handleSwapClaimed(args)
        break
      case 'SwapRefunded':
        await this.handleSwapRefunded(args)
        break
      default:
        console.log(`⚠️ Unknown swap event: ${eventName}`)
    }
  }

  // Event handlers for loan events
  private async handleLoanRequested(args: any): Promise<void> {
    const loanId = args.loanId.toString()
    const borrowerAddress = args.borrower
    const amount = args.amount.toString()
    const borrowerBtcPubkey = args.borrowerBtcPubkey
    const preimageHashBorrower = args.preimageHashBorrower
    const txidP2tr0 = args.txidP2tr0
    const voutP2tr0 = args.voutP2tr0

    console.log(`📝 Loan requested: ${loanId} by ${borrowerAddress}`)

    // Create loan record in database
    await db.insert(loans).values({
      evmContractId: BigInt(loanId),
      borrowerId: uuidv4(), // TODO: Get actual borrower ID from users table
      amount: amount.toString(),
      borrowerBtcPubkey: borrowerBtcPubkey,
      preimageHashBorrower: preimageHashBorrower,
      status: 'requested',
      durationBlocks: 1000, // Default duration
      timelockLoanReq: 10, // Default timelock
      timelockBtcEscrow: 20, // Default timelock
      timelockRepaymentAccept: 30, // Default timelock
      timelockBtcCollateral: 40 // Default timelock
    })

    // Log the event
    await this.logLoanEvent(loanId, 'loan_requested', 'requested', null, {
      borrowerAddress,
      amount,
      borrowerBtcPubkey,
      preimageHashBorrower,
      txidP2tr0,
      voutP2tr0
    })
  }

  private async handleLoanOffered(args: any): Promise<void> {
    const loanId = args.loanId.toString()
    const lenderAddress = args.lender
    const bondAmount = args.bondAmount.toString()
    const lenderBtcPubkey = args.lenderBtcPubkey
    const preimageHashLender = args.preimageHashLender

    console.log(`📝 Loan offered: ${loanId} by ${lenderAddress}`)

    // Update loan record
    await db
      .update(loans)
      .set({
        lenderId: uuidv4(), // TODO: Get actual lender ID from users table
        bondAmount: bondAmount,
        lenderBtcPubkey: lenderBtcPubkey,
        preimageHashLender: preimageHashLender,
        status: 'offered'
      })
      .where(eq(loans.evmContractId, BigInt(loanId)))

    // Log the event
    await this.logLoanEvent(loanId, 'loan_offered', 'offered', 'requested', {
      lenderAddress,
      bondAmount,
      lenderBtcPubkey,
      preimageHashLender
    })
  }

  private async handleLoanActivated(args: any): Promise<void> {
    const loanId = args.loanId.toString()
    const borrowerAddress = args.borrower

    console.log(`📝 Loan activated: ${loanId}`)

    // Update loan status
    await db
      .update(loans)
      .set({ status: 'active' })
      .where(eq(loans.evmContractId, BigInt(loanId)))

    // Log the event
    await this.logLoanEvent(loanId, 'loan_activated', 'active', 'offered', {
      borrowerAddress
    })
  }

  private async handleRepaymentInProgress(args: any): Promise<void> {
    const loanId = args.loanId.toString()
    const borrowerAddress = args.borrower

    console.log(`📝 Repayment in progress: ${loanId}`)

    // Update loan status
    await db
      .update(loans)
      .set({ status: 'repayment_in_progress' })
      .where(eq(loans.evmContractId, BigInt(loanId)))

    // Log the event
    await this.logLoanEvent(loanId, 'repayment_in_progress', 'repayment_in_progress', 'active', {
      borrowerAddress
    })
  }

  private async handleLoanRepaid(args: any): Promise<void> {
    const loanId = args.loanId.toString()
    const lenderAddress = args.lender

    console.log(`📝 Loan repaid: ${loanId}`)

    // Update loan status
    await db
      .update(loans)
      .set({ status: 'repaid' })
      .where(eq(loans.evmContractId, BigInt(loanId)))

    // Log the event
    await this.logLoanEvent(loanId, 'loan_repaid', 'repaid', 'repayment_in_progress', {
      lenderAddress
    })
  }

  private async handleLoanRefundedToLender(args: any): Promise<void> {
    const loanId = args.loanId.toString()
    const lenderAddress = args.lender

    console.log(`📝 Loan refunded to lender: ${loanId}`)

    // Update loan status
    await db
      .update(loans)
      .set({ status: 'refunded_to_lender' })
      .where(eq(loans.evmContractId, BigInt(loanId)))

    // Log the event
    await this.logLoanEvent(loanId, 'loan_refunded_to_lender', 'refunded_to_lender', null, {
      lenderAddress
    })
  }

  private async handleLoanRefundedToBorrower(args: any): Promise<void> {
    const loanId = args.loanId.toString()
    const borrowerAddress = args.borrower

    console.log(`📝 Loan refunded to borrower: ${loanId}`)

    // Update loan status
    await db
      .update(loans)
      .set({ status: 'refunded_to_borrower' })
      .where(eq(loans.evmContractId, BigInt(loanId)))

    // Log the event
    await this.logLoanEvent(loanId, 'loan_refunded_to_borrower', 'refunded_to_borrower', null, {
      borrowerAddress
    })
  }

  private async handleLoanDefaulted(args: any): Promise<void> {
    const loanId = args.loanId.toString()
    const lenderAddress = args.lender

    console.log(`📝 Loan defaulted: ${loanId}`)

    // Update loan status
    await db
      .update(loans)
      .set({ status: 'defaulted' })
      .where(eq(loans.evmContractId, BigInt(loanId)))

    // Log the event
    await this.logLoanEvent(loanId, 'loan_defaulted', 'defaulted', null, {
      lenderAddress
    })
  }

  // Event handlers for swap events
  private async handleSwapClaimed(args: any): Promise<void> {
    const preimageHash = args.preimageHash
    const claimer = args.claimer
    const amount = args.amount.toString()

    console.log(`📝 Swap claimed: ${preimageHash} by ${claimer}`)

    // TODO: Handle swap claimed event
    // This might trigger collateral release or other actions
  }

  private async handleSwapRefunded(args: any): Promise<void> {
    const preimageHash = args.preimageHash
    const refunder = args.refunder
    const amount = args.amount.toString()

    console.log(`📝 Swap refunded: ${preimageHash} by ${refunder}`)

    // TODO: Handle swap refunded event
    // This might trigger refund processes
  }

  /**
   * Log loan event for audit trail
   */
  private async logLoanEvent(
    loanId: string,
    eventType: string,
    toStatus: string,
    fromStatus: string | null,
    eventData: any
  ): Promise<void> {
    await db.insert(loanEvents).values({
      loanId: uuidv4(), // TODO: Get actual loan ID from database
      eventType,
      fromStatus,
      toStatus,
      eventData,
      notes: `Loan ${loanId}: ${eventType}`
    })
  }

  /**
   * Replay historical events from a specific block
   */
  async replayHistoricalEvents(fromBlock: number): Promise<EventProcessingResult> {
    console.log(`🔄 Replaying historical events from block ${fromBlock}`)
    
    const currentBlock = await this.provider.getBlockNumber()
    let processedEvents = 0

    try {
      for (const [contractName, contract] of this.contracts) {
        const events = await contract.queryFilter({}, fromBlock, currentBlock)
        
        for (const event of events) {
          await this.processEvent(contractName, event)
          processedEvents++
        }
      }

      console.log(`✅ Replayed ${processedEvents} historical events`)
      
      return {
        success: true,
        processedEvents
      }
    } catch (error) {
      console.error('❌ Error replaying historical events:', error)
      
      return {
        success: false,
        error: error.message,
        processedEvents
      }
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): { isMonitoring: boolean; lastProcessedBlock: number } {
    return {
      isMonitoring: this.isMonitoring,
      lastProcessedBlock: this.lastProcessedBlock
    }
  }
}

// Export singleton instance
export const evmEventMonitor = new EVMEventMonitorService(
  process.env.EVM_RPC_URL || 'http://localhost:8545',
  [
    {
      name: 'BtcCollateralLoan',
      address: process.env.BTC_COLLATERAL_LOAN_ADDRESS || '',
      abi: BTC_COLLATERAL_LOAN_ABI
    },
    {
      name: 'EtherSwap',
      address: process.env.ETHER_SWAP_ADDRESS || '',
      abi: ETHER_SWAP_ABI
    }
  ]
)
