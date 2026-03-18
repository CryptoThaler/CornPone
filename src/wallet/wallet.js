/**
 * Agent Wallet
 *
 * Manages funds for autonomous agent transactions.
 * Supports multi-currency balances, spending policies, and audit trails.
 */

/** @typedef {'deposit'|'withdrawal'|'payment'|'refund'|'session_reserve'|'session_release'} TxType */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {TxType} type
 * @property {number} amount
 * @property {string} currency
 * @property {string} counterparty - Who was paid or who paid
 * @property {string} protocol - 'mpp' | 'x402' | 'internal'
 * @property {string} timestamp
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} SpendingPolicy
 * @property {number} maxPerTransaction - Max single transaction amount
 * @property {number} maxPerSession - Max per session
 * @property {number} maxDaily - Max daily spend
 * @property {string[]} allowedRecipients - Whitelist of allowed recipients (empty = all)
 * @property {string[]} blockedRecipients - Blacklist of blocked recipients
 * @property {boolean} requireApproval - Require human approval above threshold
 * @property {number} approvalThreshold - Amount above which approval is required
 */

export class AgentWallet {
  /**
   * @param {Object} config
   * @param {string} config.address - Wallet address
   * @param {SpendingPolicy} [config.policy] - Spending policy
   */
  constructor(config) {
    this.address = config.address;
    this.balances = new Map(); // currency -> amount
    this.transactions = [];
    this.policy = {
      maxPerTransaction: config.policy?.maxPerTransaction ?? Infinity,
      maxPerSession: config.policy?.maxPerSession ?? Infinity,
      maxDaily: config.policy?.maxDaily ?? Infinity,
      allowedRecipients: config.policy?.allowedRecipients ?? [],
      blockedRecipients: config.policy?.blockedRecipients ?? [],
      requireApproval: config.policy?.requireApproval ?? false,
      approvalThreshold: config.policy?.approvalThreshold ?? Infinity,
    };
    this._dailySpend = new Map(); // date string -> amount
  }

  /**
   * Deposit funds into the wallet.
   * @param {number} amount
   * @param {string} currency
   * @param {string} [source]
   * @returns {Transaction}
   */
  deposit(amount, currency, source = 'external') {
    const current = this.balances.get(currency) || 0;
    this.balances.set(currency, current + amount);

    const tx = this._recordTransaction('deposit', amount, currency, source, 'internal');
    return tx;
  }

  /**
   * Check if a payment is allowed by spending policy.
   * @param {number} amount
   * @param {string} currency
   * @param {string} recipient
   * @returns {{allowed: boolean, reason?: string}}
   */
  checkPolicy(amount, currency, recipient) {
    if (amount > this.policy.maxPerTransaction) {
      return { allowed: false, reason: `Exceeds per-transaction limit (${this.policy.maxPerTransaction})` };
    }

    if (this.policy.blockedRecipients.includes(recipient)) {
      return { allowed: false, reason: `Recipient ${recipient} is blocked` };
    }

    if (this.policy.allowedRecipients.length > 0 && !this.policy.allowedRecipients.includes(recipient)) {
      return { allowed: false, reason: `Recipient ${recipient} not in allowlist` };
    }

    const today = new Date().toISOString().split('T')[0];
    const dailySpent = this._dailySpend.get(today) || 0;
    if (dailySpent + amount > this.policy.maxDaily) {
      return { allowed: false, reason: `Would exceed daily limit (${this.policy.maxDaily})` };
    }

    const balance = this.balances.get(currency) || 0;
    if (amount > balance) {
      return { allowed: false, reason: `Insufficient balance: ${balance} ${currency}` };
    }

    if (this.policy.requireApproval && amount > this.policy.approvalThreshold) {
      return { allowed: false, reason: `Requires human approval (amount ${amount} > threshold ${this.policy.approvalThreshold})` };
    }

    return { allowed: true };
  }

  /**
   * Execute a payment from the wallet.
   * @param {number} amount
   * @param {string} currency
   * @param {string} recipient
   * @param {string} protocol
   * @param {Object} [metadata]
   * @returns {Transaction}
   */
  pay(amount, currency, recipient, protocol, metadata = {}) {
    const check = this.checkPolicy(amount, currency, recipient);
    if (!check.allowed) {
      throw new Error(`Payment blocked: ${check.reason}`);
    }

    const balance = this.balances.get(currency) || 0;
    this.balances.set(currency, balance - amount);

    // Track daily spend
    const today = new Date().toISOString().split('T')[0];
    const dailySpent = this._dailySpend.get(today) || 0;
    this._dailySpend.set(today, dailySpent + amount);

    return this._recordTransaction('payment', amount, currency, recipient, protocol, metadata);
  }

  /**
   * Process a refund.
   * @param {number} amount
   * @param {string} currency
   * @param {string} from
   * @param {string} protocol
   * @returns {Transaction}
   */
  refund(amount, currency, from, protocol) {
    const balance = this.balances.get(currency) || 0;
    this.balances.set(currency, balance + amount);

    return this._recordTransaction('refund', amount, currency, from, protocol);
  }

  /**
   * Get balance for a currency.
   * @param {string} currency
   * @returns {number}
   */
  getBalance(currency) {
    return this.balances.get(currency) || 0;
  }

  /**
   * Get all balances.
   * @returns {Object<string, number>}
   */
  getAllBalances() {
    return Object.fromEntries(this.balances);
  }

  /**
   * Get transaction history with optional filters.
   * @param {Object} [filters]
   * @param {TxType} [filters.type]
   * @param {string} [filters.protocol]
   * @param {string} [filters.since] - ISO date string
   * @returns {Transaction[]}
   */
  getTransactions(filters = {}) {
    return this.transactions.filter(tx => {
      if (filters.type && tx.type !== filters.type) return false;
      if (filters.protocol && tx.protocol !== filters.protocol) return false;
      if (filters.since && tx.timestamp < filters.since) return false;
      return true;
    });
  }

  /**
   * @private
   */
  _recordTransaction(type, amount, currency, counterparty, protocol, metadata = {}) {
    const tx = {
      id: `tx_${crypto.randomUUID()}`,
      type,
      amount,
      currency,
      counterparty,
      protocol,
      timestamp: new Date().toISOString(),
      metadata,
    };
    this.transactions.push(tx);
    return tx;
  }
}
