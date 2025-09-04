/**
 * Monitoring and Alerting Service
 * 
 * This service provides comprehensive monitoring, alerting, and observability
 * for the BTC Yield Protocol backend service.
 */

import { db } from '../db/connection'
import { loans, loanEvents, bitcoinTransactions, evmTransactions, loanWorkflows } from '../db/schema'
import { eq, and, desc, gte, count, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

// Alert severity levels
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Metric interface
export interface Metric {
  name: string
  type: MetricType
  value: number
  labels: Record<string, string>
  timestamp: Date
}

// Alert interface
export interface Alert {
  id: string
  name: string
  severity: AlertSeverity
  message: string
  condition: string
  value: number
  threshold: number
  triggered: boolean
  triggeredAt?: Date
  resolvedAt?: Date
  metadata: Record<string, any>
}

// Health check result
export interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  lastCheck: Date
  details: Record<string, any>
}

// Performance metrics
export interface PerformanceMetrics {
  loanProcessingRate: number
  transactionSuccessRate: number
  averageResponseTime: number
  errorRate: number
  activeWorkflows: number
  pendingTransactions: number
}

export class MonitoringService {
  private metrics: Map<string, Metric[]> = new Map()
  private alerts: Map<string, Alert> = new Map()
  private healthChecks: Map<string, HealthCheckResult> = new Map()
  private alertChannels: AlertChannel[] = []

  constructor() {
    this.initializeAlerts()
    this.startMonitoringLoop()
  }

  /**
   * Initialize default alerts
   */
  private initializeAlerts(): void {
    // Loan processing alerts
    this.addAlert({
      name: 'loan_processing_rate_low',
      severity: AlertSeverity.WARNING,
      message: 'Loan processing rate is below threshold',
      condition: 'loan_processing_rate < 0.1',
      threshold: 0.1,
      value: 0,
      metadata: { unit: 'loans_per_minute' }
    })

    // Transaction success rate alerts
    this.addAlert({
      name: 'transaction_success_rate_low',
      severity: AlertSeverity.ERROR,
      message: 'Transaction success rate is below threshold',
      condition: 'transaction_success_rate < 0.95',
      threshold: 0.95,
      value: 0,
      metadata: { unit: 'percentage' }
    })

    // Error rate alerts
    this.addAlert({
      name: 'error_rate_high',
      severity: AlertSeverity.CRITICAL,
      message: 'Error rate is above threshold',
      condition: 'error_rate > 0.05',
      threshold: 0.05,
      value: 0,
      metadata: { unit: 'percentage' }
    })

    // Response time alerts
    this.addAlert({
      name: 'response_time_high',
      severity: AlertSeverity.WARNING,
      message: 'Average response time is above threshold',
      condition: 'average_response_time > 5000',
      threshold: 5000,
      value: 0,
      metadata: { unit: 'milliseconds' }
    })

    // Active workflow alerts
    this.addAlert({
      name: 'active_workflows_high',
      severity: AlertSeverity.WARNING,
      message: 'Too many active workflows',
      condition: 'active_workflows > 100',
      threshold: 100,
      value: 0,
      metadata: { unit: 'count' }
    })

    // Pending transaction alerts
    this.addAlert({
      name: 'pending_transactions_high',
      severity: AlertSeverity.ERROR,
      message: 'Too many pending transactions',
      condition: 'pending_transactions > 50',
      threshold: 50,
      value: 0,
      metadata: { unit: 'count' }
    })
  }

  /**
   * Start monitoring loop
   */
  private startMonitoringLoop(): void {
    // Collect metrics every 30 seconds
    setInterval(async () => {
      try {
        await this.collectMetrics()
        await this.checkAlerts()
        await this.performHealthChecks()
      } catch (error) {
        console.error('❌ Error in monitoring loop:', error)
      }
    }, 30000)

    // Clean up old metrics every hour
    setInterval(async () => {
      try {
        await this.cleanupOldMetrics()
      } catch (error) {
        console.error('❌ Error cleaning up metrics:', error)
      }
    }, 3600000)
  }

  /**
   * Collect system metrics
   */
  async collectMetrics(): Promise<void> {
    console.log('📊 Collecting metrics...')

    try {
      // Loan processing metrics
      const loanMetrics = await this.collectLoanMetrics()
      this.recordMetrics('loan_processing', loanMetrics)

      // Transaction metrics
      const transactionMetrics = await this.collectTransactionMetrics()
      this.recordMetrics('transactions', transactionMetrics)

      // Workflow metrics
      const workflowMetrics = await this.collectWorkflowMetrics()
      this.recordMetrics('workflows', workflowMetrics)

      // System metrics
      const systemMetrics = await this.collectSystemMetrics()
      this.recordMetrics('system', systemMetrics)

      console.log('✅ Metrics collected successfully')
    } catch (error) {
      console.error('❌ Error collecting metrics:', error)
    }
  }

  /**
   * Collect loan-related metrics
   */
  private async collectLoanMetrics(): Promise<Metric[]> {
    const metrics: Metric[] = []
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Total loans
    const totalLoans = await db
      .select({ count: count() })
      .from(loans)

    metrics.push({
      name: 'total_loans',
      type: MetricType.GAUGE,
      value: totalLoans[0].count,
      labels: { status: 'all' },
      timestamp: now
    })

    // Loans by status
    const loansByStatus = await db
      .select({ status: loans.status, count: count() })
      .from(loans)
      .groupBy(loans.status)

    for (const status of loansByStatus) {
      metrics.push({
        name: 'loans_by_status',
        type: MetricType.GAUGE,
        value: status.count,
        labels: { status: status.status },
        timestamp: now
      })
    }

    // Loans created in last hour
    const recentLoans = await db
      .select({ count: count() })
      .from(loans)
      .where(gte(loans.createdAt, oneHourAgo))

    metrics.push({
      name: 'loans_created_per_hour',
      type: MetricType.GAUGE,
      value: recentLoans[0].count,
      labels: { period: '1h' },
      timestamp: now
    })

    return metrics
  }

  /**
   * Collect transaction-related metrics
   */
  private async collectTransactionMetrics(): Promise<Metric[]> {
    const metrics: Metric[] = []
    const now = new Date()

    // Bitcoin transactions by status
    const bitcoinTxsByStatus = await db
      .select({ status: bitcoinTransactions.status, count: count() })
      .from(bitcoinTransactions)
      .groupBy(bitcoinTransactions.status)

    for (const status of bitcoinTxsByStatus) {
      metrics.push({
        name: 'bitcoin_transactions_by_status',
        type: MetricType.GAUGE,
        value: status.count,
        labels: { status: status.status, type: 'bitcoin' },
        timestamp: now
      })
    }

    // EVM transactions by status
    const evmTxsByStatus = await db
      .select({ status: evmTransactions.status, count: count() })
      .from(evmTransactions)
      .groupBy(evmTransactions.status)

    for (const status of evmTxsByStatus) {
      metrics.push({
        name: 'evm_transactions_by_status',
        type: MetricType.GAUGE,
        value: status.count,
        labels: { status: status.status, type: 'evm' },
        timestamp: now
      })
    }

    // Pending transactions
    const pendingBitcoinTxs = await db
      .select({ count: count() })
      .from(bitcoinTransactions)
      .where(eq(bitcoinTransactions.status, 'pending'))

    const pendingEvmTxs = await db
      .select({ count: count() })
      .from(evmTransactions)
      .where(eq(evmTransactions.status, 'pending'))

    metrics.push({
      name: 'pending_transactions',
      type: MetricType.GAUGE,
      value: pendingBitcoinTxs[0].count + pendingEvmTxs[0].count,
      labels: { type: 'all' },
      timestamp: now
    })

    return metrics
  }

  /**
   * Collect workflow-related metrics
   */
  private async collectWorkflowMetrics(): Promise<Metric[]> {
    const metrics: Metric[] = []
    const now = new Date()

    // Active workflows
    const activeWorkflows = await db
      .select({ count: count() })
      .from(loanWorkflows)
      .where(eq(loanWorkflows.status, 'in_progress'))

    metrics.push({
      name: 'active_workflows',
      type: MetricType.GAUGE,
      value: activeWorkflows[0].count,
      labels: { status: 'active' },
      timestamp: now
    })

    // Workflows by type
    const workflowsByType = await db
      .select({ workflowType: loanWorkflows.workflowType, count: count() })
      .from(loanWorkflows)
      .groupBy(loanWorkflows.workflowType)

    for (const workflow of workflowsByType) {
      metrics.push({
        name: 'workflows_by_type',
        type: MetricType.GAUGE,
        value: workflow.count,
        labels: { type: workflow.workflowType },
        timestamp: now
      })
    }

    return metrics
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<Metric[]> {
    const metrics: Metric[] = []
    const now = new Date()

    // Memory usage
    const memUsage = process.memoryUsage()
    metrics.push({
      name: 'memory_usage',
      type: MetricType.GAUGE,
      value: memUsage.heapUsed / 1024 / 1024, // MB
      labels: { type: 'heap_used' },
      timestamp: now
    })

    // CPU usage (approximate)
    const cpuUsage = process.cpuUsage()
    metrics.push({
      name: 'cpu_usage',
      type: MetricType.GAUGE,
      value: (cpuUsage.user + cpuUsage.system) / 1000000, // seconds
      labels: { type: 'total' },
      timestamp: now
    })

    // Uptime
    metrics.push({
      name: 'uptime',
      type: MetricType.GAUGE,
      value: process.uptime(),
      labels: { type: 'seconds' },
      timestamp: now
    })

    return metrics
  }

  /**
   * Record metrics
   */
  private recordMetrics(category: string, metrics: Metric[]): void {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, [])
    }

    const existingMetrics = this.metrics.get(category)!
    existingMetrics.push(...metrics)

    // Keep only last 1000 metrics per category
    if (existingMetrics.length > 1000) {
      existingMetrics.splice(0, existingMetrics.length - 1000)
    }
  }

  /**
   * Check alerts
   */
  async checkAlerts(): Promise<void> {
    console.log('🚨 Checking alerts...')

    try {
      const performanceMetrics = await this.getPerformanceMetrics()

      for (const alert of this.alerts.values()) {
        const currentValue = this.getMetricValue(alert.name, performanceMetrics)
        
        if (this.evaluateAlertCondition(alert, currentValue)) {
          if (!alert.triggered) {
            await this.triggerAlert(alert, currentValue)
          }
        } else {
          if (alert.triggered) {
            await this.resolveAlert(alert)
          }
        }
      }

      console.log('✅ Alerts checked successfully')
    } catch (error) {
      console.error('❌ Error checking alerts:', error)
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Loan processing rate
    const recentLoans = await db
      .select({ count: count() })
      .from(loans)
      .where(gte(loans.createdAt, oneHourAgo))

    const loanProcessingRate = recentLoans[0].count / 60 // loans per minute

    // Transaction success rate
    const totalTxs = await db
      .select({ count: count() })
      .from(bitcoinTransactions)

    const successfulTxs = await db
      .select({ count: count() })
      .from(bitcoinTransactions)
      .where(eq(bitcoinTransactions.status, 'confirmed'))

    const transactionSuccessRate = totalTxs[0].count > 0 ? successfulTxs[0].count / totalTxs[0].count : 1

    // Error rate (from loan events)
    const totalEvents = await db
      .select({ count: count() })
      .from(loanEvents)

    const errorEvents = await db
      .select({ count: count() })
      .from(loanEvents)
      .where(eq(loanEvents.eventType, 'error_occurred'))

    const errorRate = totalEvents[0].count > 0 ? errorEvents[0].count / totalEvents[0].count : 0

    // Average response time (mock for now)
    const averageResponseTime = 1000 // milliseconds

    // Active workflows
    const activeWorkflows = await db
      .select({ count: count() })
      .from(loanWorkflows)
      .where(eq(loanWorkflows.status, 'in_progress'))

    // Pending transactions
    const pendingTxs = await db
      .select({ count: count() })
      .from(bitcoinTransactions)
      .where(eq(bitcoinTransactions.status, 'pending'))

    return {
      loanProcessingRate,
      transactionSuccessRate,
      averageResponseTime,
      errorRate,
      activeWorkflows: activeWorkflows[0].count,
      pendingTransactions: pendingTxs[0].count
    }
  }

  /**
   * Get metric value for alert evaluation
   */
  private getMetricValue(alertName: string, metrics: PerformanceMetrics): number {
    switch (alertName) {
      case 'loan_processing_rate_low':
        return metrics.loanProcessingRate
      case 'transaction_success_rate_low':
        return metrics.transactionSuccessRate
      case 'error_rate_high':
        return metrics.errorRate
      case 'response_time_high':
        return metrics.averageResponseTime
      case 'active_workflows_high':
        return metrics.activeWorkflows
      case 'pending_transactions_high':
        return metrics.pendingTransactions
      default:
        return 0
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(alert: Alert, currentValue: number): boolean {
    switch (alert.condition) {
      case 'loan_processing_rate < 0.1':
        return currentValue < alert.threshold
      case 'transaction_success_rate < 0.95':
        return currentValue < alert.threshold
      case 'error_rate > 0.05':
        return currentValue > alert.threshold
      case 'average_response_time > 5000':
        return currentValue > alert.threshold
      case 'active_workflows > 100':
        return currentValue > alert.threshold
      case 'pending_transactions > 50':
        return currentValue > alert.threshold
      default:
        return false
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(alert: Alert, currentValue: number): Promise<void> {
    alert.triggered = true
    alert.triggeredAt = new Date()
    alert.value = currentValue

    console.log(`🚨 ALERT TRIGGERED: ${alert.name} - ${alert.message}`)
    console.log(`Current value: ${currentValue}, Threshold: ${alert.threshold}`)

    // Send alert to all channels
    for (const channel of this.alertChannels) {
      try {
        await channel.sendAlert(alert)
      } catch (error) {
        console.error(`❌ Failed to send alert via ${channel.name}:`, error)
      }
    }

    // Log alert to database
    await this.logAlertToDatabase(alert, 'triggered')
  }

  /**
   * Resolve alert
   */
  private async resolveAlert(alert: Alert): Promise<void> {
    alert.triggered = false
    alert.resolvedAt = new Date()

    console.log(`✅ ALERT RESOLVED: ${alert.name}`)

    // Send resolution to all channels
    for (const channel of this.alertChannels) {
      try {
        await channel.sendAlertResolution(alert)
      } catch (error) {
        console.error(`❌ Failed to send alert resolution via ${channel.name}:`, error)
      }
    }

    // Log alert resolution to database
    await this.logAlertToDatabase(alert, 'resolved')
  }

  /**
   * Perform health checks
   */
  async performHealthChecks(): Promise<void> {
    console.log('🏥 Performing health checks...')

    try {
      // Database health check
      await this.checkDatabaseHealth()

      // Python API health check
      await this.checkPythonAPIHealth()

      // EVM node health check
      await this.checkEVMNodeHealth()

      console.log('✅ Health checks completed')
    } catch (error) {
      console.error('❌ Error performing health checks:', error)
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      await db.execute('SELECT 1')
      const responseTime = Date.now() - startTime
      
      this.healthChecks.set('database', {
        service: 'database',
        status: 'healthy',
        responseTime,
        lastCheck: new Date(),
        details: { connection: 'ok' }
      })
    } catch (error) {
      this.healthChecks.set('database', {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: { error: error.message }
      })
    }
  }

  /**
   * Check Python API health
   */
  private async checkPythonAPIHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await axios.get(`${process.env.PYTHON_API_URL}/health`, { timeout: 5000 })
      const responseTime = Date.now() - startTime
      
      this.healthChecks.set('python_api', {
        service: 'python_api',
        status: response.status === 200 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
        details: { status: response.status, data: response.data }
      })
    } catch (error) {
      this.healthChecks.set('python_api', {
        service: 'python_api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: { error: error.message }
      })
    }
  }

  /**
   * Check EVM node health
   */
  private async checkEVMNodeHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // TODO: Implement EVM node health check
      const responseTime = Date.now() - startTime
      
      this.healthChecks.set('evm_node', {
        service: 'evm_node',
        status: 'healthy',
        responseTime,
        lastCheck: new Date(),
        details: { connection: 'ok' }
      })
    } catch (error) {
      this.healthChecks.set('evm_node', {
        service: 'evm_node',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: { error: error.message }
      })
    }
  }

  /**
   * Add alert
   */
  addAlert(alert: Omit<Alert, 'id' | 'triggered' | 'triggeredAt' | 'resolvedAt'>): void {
    const alertWithId: Alert = {
      ...alert,
      id: uuidv4(),
      triggered: false
    }
    
    this.alerts.set(alertWithId.id, alertWithId)
  }

  /**
   * Add alert channel
   */
  addAlertChannel(channel: AlertChannel): void {
    this.alertChannels.push(channel)
  }

  /**
   * Get all metrics
   */
  getMetrics(): Map<string, Metric[]> {
    return this.metrics
  }

  /**
   * Get all alerts
   */
  getAlerts(): Map<string, Alert> {
    return this.alerts
  }

  /**
   * Get health check results
   */
  getHealthChecks(): Map<string, HealthCheckResult> {
    return this.healthChecks
  }

  /**
   * Log alert to database
   */
  private async logAlertToDatabase(alert: Alert, action: 'triggered' | 'resolved'): Promise<void> {
    try {
      await db.insert(loanEvents).values({
        id: uuidv4(),
        loanId: uuidv4(), // TODO: Get actual loan ID if available
        eventType: `alert_${action}`,
        eventData: {
          alertId: alert.id,
          alertName: alert.name,
          severity: alert.severity,
          message: alert.message,
          value: alert.value,
          threshold: alert.threshold,
          action
        },
        notes: `Alert ${action}: ${alert.name} - ${alert.message}`
      })
    } catch (error) {
      console.error('❌ Failed to log alert to database:', error)
    }
  }

  /**
   * Clean up old metrics
   */
  private async cleanupOldMetrics(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    for (const [category, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(metric => metric.timestamp > oneDayAgo)
      this.metrics.set(category, filteredMetrics)
    }
  }
}

// Alert channel interface
export interface AlertChannel {
  name: string
  sendAlert(alert: Alert): Promise<void>
  sendAlertResolution(alert: Alert): Promise<void>
}

// Console alert channel
export class ConsoleAlertChannel implements AlertChannel {
  name = 'console'

  async sendAlert(alert: Alert): Promise<void> {
    console.log(`🚨 [${alert.severity.toUpperCase()}] ${alert.name}: ${alert.message}`)
    console.log(`   Current value: ${alert.value}, Threshold: ${alert.threshold}`)
  }

  async sendAlertResolution(alert: Alert): Promise<void> {
    console.log(`✅ [RESOLVED] ${alert.name}: Alert resolved`)
  }
}

// Export singleton instance
export const monitoring = new MonitoringService()

// Add default console alert channel
monitoring.addAlertChannel(new ConsoleAlertChannel())
