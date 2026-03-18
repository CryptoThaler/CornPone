/**
 * Agentic Finance Sub Agent
 *
 * A composable sub-agent that gives any AI agent autonomous financial capabilities.
 * Manages the full lifecycle of machine-to-machine payments:
 *
 * - Protocol negotiation (MPP vs x402 auto-detection)
 * - Wallet management with spending policies
 * - Session-based streaming micropayments (MPP sessions)
 * - Payment authorization and settlement
 * - Receipt collection and reconciliation
 * - Budget tracking and audit trails
 *
 * Architecture:
 * ┌─────────────────────────────────────────┐
 * │           Parent Agent (LLM)            │
 * │  "I need to call this paid API..."      │
 * └──────────────┬──────────────────────────┘
 *                │ delegates financial ops
 * ┌──────────────▼──────────────────────────┐
 * │       Agentic Finance Sub Agent         │
 * │                                         │
 * │  ┌─────────┐  ┌─────────┐  ┌────────┐  │
 * │  │  Wallet  │  │ Sessions│  │ Budget │  │
 * │  └────┬────┘  └────┬────┘  └───┬────┘  │
 * │       │            │           │        │
 * │  ┌────▼────────────▼───────────▼────┐   │
 * │  │      Protocol Negotiator         │   │
 * │  │   (MPP / x402 auto-detect)       │   │
 * │  └────┬─────────────────┬───────────┘   │
 * │       │                 │               │
 * │  ┌────▼────┐      ┌────▼────┐          │
 * │  │   MPP   │      │  x402   │          │
 * │  │ Client  │      │ Client  │          │
 * │  └─────────┘      └─────────┘          │
 * └─────────────────────────────────────────┘
 */

import { MppClient } from '../protocols/mpp.js';
import { X402Client } from '../protocols/x402.js';
import { AgentWallet } from '../wallet/wallet.js';

/**
 * @typedef {Object} PaymentResult
 * @property {boolean} success
 * @property {string} protocol - 'mpp' | 'x402'
 * @property {Object} [receipt] - Payment receipt
 * @property {Object} [error] - Error details if failed
 * @property {Response} [response] - The HTTP response with the resource
 */

/**
 * @typedef {Object} BudgetStatus
 * @property {Object<string, number>} balances - Current balances by currency
 * @property {number} totalSpent - Total spent across all currencies (USD equivalent)
 * @property {number} activeSessions - Number of active MPP sessions
 * @property {number} transactionCount - Total transactions
 */

export class AgenticFinanceAgent {
  /**
   * @param {Object} config
   * @param {string} config.agentId - Unique identifier for this agent
   * @param {string} config.walletAddress - Crypto wallet address
   * @param {Object} [config.spending] - Spending policy
   * @param {number} [config.spending.maxPerTransaction] - Max per tx
   * @param {number} [config.spending.maxDaily] - Max daily spend
   * @param {boolean} [config.spending.requireApproval] - Require human approval
   * @param {number} [config.spending.approvalThreshold] - Approval threshold
   * @param {string} [config.sharedPaymentToken] - SPT for fiat payments
   * @param {Function} [config.signPayment] - Crypto signing function for x402
   * @param {boolean} [config.testnet] - Use testnet (default: true)
   * @param {Function} [config.onPayment] - Callback on each payment
   * @param {Function} [config.onApprovalRequired] - Callback when human approval needed
   * @param {typeof fetch} [config.fetch] - Custom fetch
   */
  constructor(config) {
    this.agentId = config.agentId;
    this.onPayment = config.onPayment || null;
    this.onApprovalRequired = config.onApprovalRequired || null;

    // Initialize wallet
    this.wallet = new AgentWallet({
      address: config.walletAddress,
      policy: config.spending,
    });

    // Initialize protocol clients
    this.mpp = new MppClient({
      walletAddress: config.walletAddress,
      sharedPaymentToken: config.sharedPaymentToken,
      testnet: config.testnet,
      fetch: config.fetch,
    });

    this.x402 = new X402Client({
      walletAddress: config.walletAddress,
      signPayment: config.signPayment || (async () => 'mock-signature'),
      fetch: config.fetch,
    });

    // Service registry: URL patterns -> preferred protocol
    this.serviceRegistry = new Map();

    this._log('initialized', { agentId: this.agentId, wallet: config.walletAddress });
  }

  /**
   * Pay for and access a resource. Auto-detects protocol.
   *
   * This is the primary method parent agents call. It handles:
   * 1. Checking if the service is known and which protocol to use
   * 2. Making the initial request to detect 402 requirements
   * 3. Validating payment against wallet policy
   * 4. Executing payment via the appropriate protocol
   * 5. Returning the resource + receipt
   *
   * @param {string} url - Resource URL
   * @param {Object} [options] - Fetch options (method, headers, body)
   * @param {Object} [paymentOptions]
   * @param {string} [paymentOptions.sessionId] - Use existing MPP session
   * @param {string} [paymentOptions.preferredProtocol] - Force protocol
   * @param {number} [paymentOptions.maxPrice] - Max willing to pay
   * @returns {Promise<PaymentResult>}
   */
  async payForResource(url, options = {}, paymentOptions = {}) {
    const protocol = paymentOptions.preferredProtocol || this._detectProtocol(url);

    try {
      let result;

      if (protocol === 'x402') {
        result = await this._payViaX402(url, options, paymentOptions);
      } else {
        result = await this._payViaMpp(url, options, paymentOptions);
      }

      if (this.onPayment && result.receipt) {
        this.onPayment(result);
      }

      return result;
    } catch (error) {
      this._log('payment_error', { url, protocol, error: error.message });
      return {
        success: false,
        protocol,
        error: { message: error.message, url },
      };
    }
  }

  /**
   * Open a streaming micropayment session for repeated API calls.
   * Useful for agents that need to make many small payments to the same service.
   *
   * @param {Object} params
   * @param {number} params.budget - Total budget for the session
   * @param {string} params.currency - Currency (default: 'usd')
   * @param {number} [params.ttlSeconds] - Session duration (default: 3600)
   * @returns {Promise<{sessionId: string, budget: number, expiresAt: string}>}
   */
  async openPaymentSession({ budget, currency = 'usd', ttlSeconds = 3600 }) {
    // Reserve funds in wallet
    const check = this.wallet.checkPolicy(budget, currency, 'session_reserve');
    if (!check.allowed) {
      throw new Error(`Cannot open session: ${check.reason}`);
    }

    const session = await this.mpp.openSession({
      spendingLimit: budget,
      currency,
      ttlSeconds,
    });

    this._log('session_opened', { sessionId: session.sessionId, budget, currency });

    return {
      sessionId: session.sessionId,
      budget,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Close a payment session and settle.
   * @param {string} sessionId
   * @returns {Promise<{settled: number, refunded: number}>}
   */
  async closePaymentSession(sessionId) {
    const result = await this.mpp.closeSession(sessionId);
    this._log('session_closed', { sessionId, ...result });
    return result;
  }

  /**
   * Fund the agent's wallet.
   * @param {number} amount
   * @param {string} currency
   * @param {string} [source]
   * @returns {Object} Transaction record
   */
  fund(amount, currency, source = 'external') {
    const tx = this.wallet.deposit(amount, currency, source);
    this._log('funded', { amount, currency, source });
    return tx;
  }

  /**
   * Register a service with its preferred payment protocol.
   * @param {string} urlPattern - URL pattern or domain
   * @param {'mpp'|'x402'} protocol - Preferred protocol
   */
  registerService(urlPattern, protocol) {
    this.serviceRegistry.set(urlPattern, protocol);
  }

  /**
   * Get budget status summary.
   * @returns {BudgetStatus}
   */
  getBudgetStatus() {
    return {
      balances: this.wallet.getAllBalances(),
      totalSpent: this.wallet.getTransactions({ type: 'payment' })
        .reduce((sum, tx) => sum + tx.amount, 0),
      activeSessions: this.mpp.getActiveSessions().length,
      transactionCount: this.wallet.getTransactions().length,
    };
  }

  /**
   * Get full audit trail.
   * @param {Object} [filters]
   * @returns {Object}
   */
  getAuditTrail(filters = {}) {
    return {
      agentId: this.agentId,
      walletAddress: this.wallet.address,
      transactions: this.wallet.getTransactions(filters),
      mppReceipts: this.mpp.getReceipts(),
      x402Payments: this.x402.getPaymentHistory(),
      activeSessions: this.mpp.getActiveSessions(),
      balances: this.wallet.getAllBalances(),
      generatedAt: new Date().toISOString(),
    };
  }

  // --- Private methods ---

  /**
   * @private
   */
  async _payViaMpp(url, options, paymentOptions) {
    const { response, receipt } = await this.mpp.requestResource(
      url, options, paymentOptions.sessionId
    );

    if (receipt) {
      this.wallet.pay(
        receipt.amount, receipt.currency,
        url, 'mpp', { receiptId: receipt.receiptId }
      );
    }

    return {
      success: response.ok,
      protocol: 'mpp',
      receipt,
      response,
    };
  }

  /**
   * @private
   */
  async _payViaX402(url, options, paymentOptions) {
    const { response, payment } = await this.x402.requestResource(url, options);

    if (payment) {
      this.wallet.pay(
        payment.payload.amount, payment.payload.currency,
        url, 'x402', { network: payment.network }
      );
    }

    return {
      success: response.ok,
      protocol: 'x402',
      receipt: payment,
      response,
    };
  }

  /**
   * Auto-detect protocol from URL or service registry.
   * @private
   */
  _detectProtocol(url) {
    for (const [pattern, protocol] of this.serviceRegistry) {
      if (url.includes(pattern)) return protocol;
    }
    // Default to MPP (Stripe's protocol)
    return 'mpp';
  }

  /**
   * @private
   */
  _log(event, data) {
    // Structured log for observability
    const entry = {
      agent: this.agentId,
      event,
      ...data,
      timestamp: new Date().toISOString(),
    };
    // In production, pipe to observability stack
    if (process.env.DEBUG) {
      console.log('[AgenticFinance]', JSON.stringify(entry));
    }
  }
}
