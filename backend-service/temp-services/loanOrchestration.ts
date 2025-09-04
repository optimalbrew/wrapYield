/**
 * Loan Orchestration Service
 * 
 * This service manages the complete loan lifecycle, coordinating between
 * EVM events, Bitcoin transactions, and cross-chain state synchronization.
 */

import { db } from '../db/connection'
import { loans, loanWorkflows, loanEvents, bitcoinTransactions, signatures } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { evmEventMonitor } from './evmEventMonitor'
import { crossChainSync } from './crossChainSync'

interface WorkflowStep {
  id: string
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  error?: string
  retryCount: number
  maxRetries: number
  dependencies: string[]
  execute: () => Promise<void>
}

interface WorkflowDefinition {
  id: string
  name: string
  steps: WorkflowStep[]
  onSuccess?: () => Promise<void>
  onFailure?: (error: Error) => Promise<void>
}

export class LoanOrchestrationService {
  private pythonApiUrl: string
  private activeWorkflows: Map<string, WorkflowDefinition> = new Map()

  constructor(pythonApiUrl: string) {
    this.pythonApiUrl = pythonApiUrl
  }

  /**
   * Process a loan request event
   */
  async processLoanRequest(evmEvent: any): Promise<void> {
    const loanId = evmEvent.loanId.toString()
    console.log(`🔄 Processing loan request for loan ${loanId}`)

    try {
      // Create loan record in database
      await this.createLoanRecord(evmEvent)

      // Start escrow setup workflow
      await this.startEscrowSetupWorkflow(loanId, evmEvent)

      console.log(`✅ Loan request processed for loan ${loanId}`)
    } catch (error) {
      console.error(`❌ Error processing loan request for loan ${loanId}:`, error)
      throw error
    }
  }

  /**
   * Process a loan offer event
   */
  async processLoanOffer(evmEvent: any): Promise<void> {
    const loanId = evmEvent.loanId.toString()
    console.log(`🔄 Processing loan offer for loan ${loanId}`)

    try {
      // Update loan record with lender information
      await this.updateLoanWithLenderInfo(evmEvent)

      // Start collateral setup workflow
      await this.startCollateralSetupWorkflow(loanId, evmEvent)

      console.log(`✅ Loan offer processed for loan ${loanId}`)
    } catch (error) {
      console.error(`❌ Error processing loan offer for loan ${loanId}:`, error)
      throw error
    }
  }

  /**
   * Process a loan activation event
   */
  async processLoanActivation(evmEvent: any): Promise<void> {
    const loanId = evmEvent.loanId.toString()
    console.log(`🔄 Processing loan activation for loan ${loanId}`)

    try {
      // Update loan status
      await this.updateLoanStatus(loanId, 'active')

      // Validate cross-chain state
      await crossChainSync.validateEVMState(loanId)
      await crossChainSync.validateBitcoinState(loanId)

      // Start loan monitoring workflow
      await this.startLoanMonitoringWorkflow(loanId)

      console.log(`✅ Loan activation processed for loan ${loanId}`)
    } catch (error) {
      console.error(`❌ Error processing loan activation for loan ${loanId}:`, error)
      throw error
    }
  }

  /**
   * Process a repayment in progress event
   */
  async processRepayment(evmEvent: any): Promise<void> {
    const loanId = evmEvent.loanId.toString()
    console.log(`🔄 Processing repayment for loan ${loanId}`)

    try {
      // Update loan status
      await this.updateLoanStatus(loanId, 'repayment_in_progress')

      // Start repayment workflow
      await this.startRepaymentWorkflow(loanId, evmEvent)

      console.log(`✅ Repayment processed for loan ${loanId}`)
    } catch (error) {
      console.error(`❌ Error processing repayment for loan ${loanId}:`, error)
      throw error
    }
  }

  /**
   * Process a loan completion event
   */
  async handleLoanCompletion(evmEvent: any): Promise<void> {
    const loanId = evmEvent.loanId.toString()
    console.log(`🔄 Processing loan completion for loan ${loanId}`)

    try {
      // Update loan status
      await this.updateLoanStatus(loanId, 'repaid')

      // Start collateral release workflow
      await this.startCollateralReleaseWorkflow(loanId)

      // Finalize cross-chain state
      await crossChainSync.reconcileStates(loanId)

      console.log(`✅ Loan completion processed for loan ${loanId}`)
    } catch (error) {
      console.error(`❌ Error processing loan completion for loan ${loanId}:`, error)
      throw error
    }
  }

  /**
   * Process a loan default event
   */
  async handleLoanDefault(evmEvent: any): Promise<void> {
    const loanId = evmEvent.loanId.toString()
    console.log(`🔄 Processing loan default for loan ${loanId}`)

    try {
      // Update loan status
      await this.updateLoanStatus(loanId, 'defaulted')

      // Start collateral capture workflow
      await this.startCollateralCaptureWorkflow(loanId)

      console.log(`✅ Loan default processed for loan ${loanId}`)
    } catch (error) {
      console.error(`❌ Error processing loan default for loan ${loanId}:`, error)
      throw error
    }
  }

  // Workflow definitions

  private async startEscrowSetupWorkflow(loanId: string, evmEvent: any): Promise<void> {
    const workflowId = uuidv4()
    
    const workflow: WorkflowDefinition = {
      id: workflowId,
      name: 'escrow_setup',
      steps: [
        {
          id: 'create_escrow_tx',
          name: 'Create Escrow Transaction',
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          dependencies: [],
          execute: async () => {
            await this.createEscrowTransaction(loanId, evmEvent)
          }
        },
        {
          id: 'store_escrow_tx',
          name: 'Store Escrow Transaction',
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          dependencies: ['create_escrow_tx'],
          execute: async () => {
            await this.storeEscrowTransaction(loanId)
          }
        },
        {
          id: 'notify_borrower',
          name: 'Notify Borrower',
          status: 'pending',
          retryCount: 0,
          maxRetries: 2,
          dependencies: ['store_escrow_tx'],
          execute: async () => {
            await this.notifyBorrowerForSigning(loanId)
          }
        }
      ],
      onSuccess: async () => {
        await this.logWorkflowSuccess(loanId, 'escrow_setup')
      },
      onFailure: async (error) => {
        await this.logWorkflowFailure(loanId, 'escrow_setup', error)
      }
    }

    await this.executeWorkflow(workflow)
  }

  private async startCollateralSetupWorkflow(loanId: string, evmEvent: any): Promise<void> {
    const workflowId = uuidv4()
    
    const workflow: WorkflowDefinition = {
      id: workflowId,
      name: 'collateral_setup',
      steps: [
        {
          id: 'create_collateral_tx',
          name: 'Create Collateral Transaction',
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          dependencies: [],
          execute: async () => {
            await this.createCollateralTransaction(loanId, evmEvent)
          }
        },
        {
          id: 'coordinate_signatures',
          name: 'Coordinate Signatures',
          status: 'pending',
          retryCount: 0,
          maxRetries: 5,
          dependencies: ['create_collateral_tx'],
          execute: async () => {
            await this.coordinateSignatureWorkflow(loanId)
          }
        },
        {
          id: 'broadcast_transaction',
          name: 'Broadcast Transaction',
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          dependencies: ['coordinate_signatures'],
          execute: async () => {
            await this.broadcastCollateralTransaction(loanId)
          }
        }
      ],
      onSuccess: async () => {
        await this.logWorkflowSuccess(loanId, 'collateral_setup')
      },
      onFailure: async (error) => {
        await this.logWorkflowFailure(loanId, 'collateral_setup', error)
      }
    }

    await this.executeWorkflow(workflow)
  }

  private async startLoanMonitoringWorkflow(loanId: string): Promise<void> {
    const workflowId = uuidv4()
    
    const workflow: WorkflowDefinition = {
      id: workflowId,
      name: 'loan_monitoring',
      steps: [
        {
          id: 'setup_monitoring',
          name: 'Setup Monitoring',
          status: 'pending',
          retryCount: 0,
          maxRetries: 2,
          dependencies: [],
          execute: async () => {
            await this.setupLoanMonitoring(loanId)
          }
        },
        {
          id: 'enforce_timelocks',
          name: 'Enforce Timelocks',
          status: 'pending',
          retryCount: 0,
          maxRetries: 1,
          dependencies: ['setup_monitoring'],
          execute: async () => {
            await crossChainSync.enforceTimelocks(loanId)
          }
        }
      ],
      onSuccess: async () => {
        await this.logWorkflowSuccess(loanId, 'loan_monitoring')
      },
      onFailure: async (error) => {
        await this.logWorkflowFailure(loanId, 'loan_monitoring', error)
      }
    }

    await this.executeWorkflow(workflow)
  }

  private async startRepaymentWorkflow(loanId: string, evmEvent: any): Promise<void> {
    const workflowId = uuidv4()
    
    const workflow: WorkflowDefinition = {
      id: workflowId,
      name: 'repayment',
      steps: [
        {
          id: 'validate_repayment',
          name: 'Validate Repayment',
          status: 'pending',
          retryCount: 0,
          maxRetries: 2,
          dependencies: [],
          execute: async () => {
            await this.validateRepayment(loanId, evmEvent)
          }
        },
        {
          id: 'prepare_collateral_release',
          name: 'Prepare Collateral Release',
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          dependencies: ['validate_repayment'],
          execute: async () => {
            await this.prepareCollateralRelease(loanId)
          }
        }
      ],
      onSuccess: async () => {
        await this.logWorkflowSuccess(loanId, 'repayment')
      },
      onFailure: async (error) => {
        await this.logWorkflowFailure(loanId, 'repayment', error)
      }
    }

    await this.executeWorkflow(workflow)
  }

  private async startCollateralReleaseWorkflow(loanId: string): Promise<void> {
    const workflowId = uuidv4()
    
    const workflow: WorkflowDefinition = {
      id: workflowId,
      name: 'collateral_release',
      steps: [
        {
          id: 'create_release_tx',
          name: 'Create Release Transaction',
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          dependencies: [],
          execute: async () => {
            await this.createCollateralReleaseTransaction(loanId)
          }
        },
        {
          id: 'broadcast_release_tx',
          name: 'Broadcast Release Transaction',
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          dependencies: ['create_release_tx'],
          execute: async () => {
            await this.broadcastCollateralReleaseTransaction(loanId)
          }
        }
      ],
      onSuccess: async () => {
        await this.logWorkflowSuccess(loanId, 'collateral_release')
      },
      onFailure: async (error) => {
        await this.logWorkflowFailure(loanId, 'collateral_release', error)
      }
    }

    await this.executeWorkflow(workflow)
  }

  private async startCollateralCaptureWorkflow(loanId: string): Promise<void> {
    const workflowId = uuidv4()
    
    const workflow: WorkflowDefinition = {
      id: workflowId,
      name: 'collateral_capture',
      steps: [
        {
          id: 'create_capture_tx',
          name: 'Create Capture Transaction',
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          dependencies: [],
          execute: async () => {
            await this.createCollateralCaptureTransaction(loanId)
          }
        },
        {
          id: 'broadcast_capture_tx',
          name: 'Broadcast Capture Transaction',
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          dependencies: ['create_capture_tx'],
          execute: async () => {
            await this.broadcastCollateralCaptureTransaction(loanId)
          }
        }
      ],
      onSuccess: async () => {
        await this.logWorkflowSuccess(loanId, 'collateral_capture')
      },
      onFailure: async (error) => {
        await this.logWorkflowFailure(loanId, 'collateral_capture', error)
      }
    }

    await this.executeWorkflow(workflow)
  }

  // Workflow execution engine

  private async executeWorkflow(workflow: WorkflowDefinition): Promise<void> {
    console.log(`🚀 Starting workflow: ${workflow.name}`)
    
    this.activeWorkflows.set(workflow.id, workflow)
    
    try {
      // Store workflow in database
      await this.storeWorkflow(workflow)
      
      // Execute steps in order
      for (const step of workflow.steps) {
        await this.executeStep(workflow, step)
      }
      
      // Workflow completed successfully
      if (workflow.onSuccess) {
        await workflow.onSuccess()
      }
      
      console.log(`✅ Workflow completed: ${workflow.name}`)
    } catch (error) {
      console.error(`❌ Workflow failed: ${workflow.name}`, error)
      
      if (workflow.onFailure) {
        await workflow.onFailure(error)
      }
    } finally {
      this.activeWorkflows.delete(workflow.id)
    }
  }

  private async executeStep(workflow: WorkflowDefinition, step: WorkflowStep): Promise<void> {
    console.log(`🔄 Executing step: ${step.name}`)
    
    // Check dependencies
    for (const depId of step.dependencies) {
      const depStep = workflow.steps.find(s => s.id === depId)
      if (!depStep || depStep.status !== 'completed') {
        throw new Error(`Dependency ${depId} not completed for step ${step.id}`)
      }
    }
    
    // Update step status
    step.status = 'in_progress'
    await this.updateWorkflowStep(workflow.id, step)
    
    try {
      // Execute step
      await step.execute()
      
      // Mark as completed
      step.status = 'completed'
      await this.updateWorkflowStep(workflow.id, step)
      
      console.log(`✅ Step completed: ${step.name}`)
    } catch (error) {
      step.status = 'failed'
      step.error = error.message
      step.retryCount++
      
      await this.updateWorkflowStep(workflow.id, step)
      
      // Retry if possible
      if (step.retryCount < step.maxRetries) {
        console.log(`🔄 Retrying step ${step.name} (${step.retryCount}/${step.maxRetries})`)
        step.status = 'pending'
        await this.updateWorkflowStep(workflow.id, step)
        await this.executeStep(workflow, step)
      } else {
        console.error(`❌ Step failed permanently: ${step.name}`)
        throw error
      }
    }
  }

  // Helper methods

  private async createLoanRecord(evmEvent: any): Promise<void> {
    const loanId = uuidv4()
    
    await db.insert(loans).values({
      id: loanId,
      evmContractId: BigInt(evmEvent.loanId),
      borrowerId: uuidv4(), // TODO: Get actual borrower ID
      amount: evmEvent.amount.toString(),
      borrowerBtcPubkey: evmEvent.borrowerBtcPubkey,
      preimageHashBorrower: evmEvent.preimageHashBorrower,
      status: 'requested',
      durationBlocks: 1008, // TODO: Get from contract
      timelockLoanReq: 144,
      timelockBtcEscrow: 144,
      timelockRepaymentAccept: 144,
      timelockBtcCollateral: 2016
    })
  }

  private async updateLoanWithLenderInfo(evmEvent: any): Promise<void> {
    await db
      .update(loans)
      .set({
        lenderId: uuidv4(), // TODO: Get actual lender ID
        lenderBtcPubkey: evmEvent.lenderBtcPubkey,
        preimageHashLender: evmEvent.preimageHashLender,
        bondAmount: evmEvent.bondAmount.toString(),
        status: 'offered'
      })
      .where(eq(loans.evmContractId, BigInt(evmEvent.loanId)))
  }

  private async updateLoanStatus(loanId: string, status: string): Promise<void> {
    await db
      .update(loans)
      .set({ status })
      .where(eq(loans.id, loanId))
  }

  private async createEscrowTransaction(loanId: string, evmEvent: any): Promise<void> {
    const response = await axios.post(`${this.pythonApiUrl}/transactions/escrow`, {
      loan_id: loanId,
      borrower_pubkey: evmEvent.borrowerBtcPubkey,
      preimage_hash_borrower: evmEvent.preimageHashBorrower,
      borrower_timelock: 144,
      amount: evmEvent.amount.toString()
    })
    
    if (!response.data.success) {
      throw new Error(`Failed to create escrow transaction: ${response.data.error}`)
    }
  }

  private async storeEscrowTransaction(loanId: string): Promise<void> {
    // TODO: Store escrow transaction details in database
    console.log(`📝 Storing escrow transaction for loan ${loanId}`)
  }

  private async notifyBorrowerForSigning(loanId: string): Promise<void> {
    // TODO: Send notification to borrower
    console.log(`📧 Notifying borrower for signing loan ${loanId}`)
  }

  private async createCollateralTransaction(loanId: string, evmEvent: any): Promise<void> {
    const response = await axios.post(`${this.pythonApiUrl}/transactions/collateral`, {
      loan_id: loanId,
      borrower_pubkey: evmEvent.borrowerBtcPubkey,
      lender_pubkey: evmEvent.lenderBtcPubkey,
      preimage_hash_borrower: evmEvent.preimageHashBorrower,
      preimage_hash_lender: evmEvent.preimageHashLender,
      borrower_timelock: 144,
      lender_timelock: 2016,
      amount: evmEvent.amount.toString()
    })
    
    if (!response.data.success) {
      throw new Error(`Failed to create collateral transaction: ${response.data.error}`)
    }
  }

  private async coordinateSignatureWorkflow(loanId: string): Promise<void> {
    // TODO: Coordinate signature workflow between borrower and lender
    console.log(`✍️ Coordinating signature workflow for loan ${loanId}`)
  }

  private async broadcastCollateralTransaction(loanId: string): Promise<void> {
    // TODO: Broadcast collateral transaction
    console.log(`📡 Broadcasting collateral transaction for loan ${loanId}`)
  }

  private async setupLoanMonitoring(loanId: string): Promise<void> {
    // TODO: Setup monitoring for loan
    console.log(`👁️ Setting up monitoring for loan ${loanId}`)
  }

  private async validateRepayment(loanId: string, evmEvent: any): Promise<void> {
    // TODO: Validate repayment
    console.log(`✅ Validating repayment for loan ${loanId}`)
  }

  private async prepareCollateralRelease(loanId: string): Promise<void> {
    // TODO: Prepare collateral release
    console.log(`🔓 Preparing collateral release for loan ${loanId}`)
  }

  private async createCollateralReleaseTransaction(loanId: string): Promise<void> {
    // TODO: Create collateral release transaction
    console.log(`🔓 Creating collateral release transaction for loan ${loanId}`)
  }

  private async broadcastCollateralReleaseTransaction(loanId: string): Promise<void> {
    // TODO: Broadcast collateral release transaction
    console.log(`📡 Broadcasting collateral release transaction for loan ${loanId}`)
  }

  private async createCollateralCaptureTransaction(loanId: string): Promise<void> {
    // TODO: Create collateral capture transaction
    console.log(`🔒 Creating collateral capture transaction for loan ${loanId}`)
  }

  private async broadcastCollateralCaptureTransaction(loanId: string): Promise<void> {
    // TODO: Broadcast collateral capture transaction
    console.log(`📡 Broadcasting collateral capture transaction for loan ${loanId}`)
  }

  private async storeWorkflow(workflow: WorkflowDefinition): Promise<void> {
    await db.insert(loanWorkflows).values({
      id: workflow.id,
      loanId: uuidv4(), // TODO: Get actual loan ID
      workflowType: workflow.name,
      status: 'in_progress',
      currentStep: workflow.steps[0]?.name,
      stepsCompleted: workflow.steps.map(s => ({ id: s.id, name: s.name, status: s.status }))
    })
  }

  private async updateWorkflowStep(workflowId: string, step: WorkflowStep): Promise<void> {
    // TODO: Update workflow step in database
    console.log(`📝 Updating workflow step: ${step.name} - ${step.status}`)
  }

  private async logWorkflowSuccess(loanId: string, workflowType: string): Promise<void> {
    await db.insert(loanEvents).values({
      loanId,
      eventType: 'workflow_completed',
      eventData: { workflowType },
      notes: `Workflow ${workflowType} completed successfully`
    })
  }

  private async logWorkflowFailure(loanId: string, workflowType: string, error: Error): Promise<void> {
    await db.insert(loanEvents).values({
      loanId,
      eventType: 'workflow_failed',
      eventData: { workflowType, error: error.message },
      notes: `Workflow ${workflowType} failed: ${error.message}`
    })
  }
}

// Export singleton instance
export const loanOrchestration = new LoanOrchestrationService(
  process.env.PYTHON_API_URL || 'http://localhost:8001'
)
