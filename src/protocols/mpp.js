/**
 * Machine Payments Protocol (MPP) Client
 *
 * Implements the MPP flow co-authored by Stripe and Tempo:
 * 1. Agent requests a resource from a service endpoint
 * 2. Service responds with HTTP 402 + challengeId + payment details
 * 3. Agent authorizes payment via wallet/session
 * 4. Agent retries request with payment credential in Authorization header
 * 5. Service validates payment, delivers resource + receipt
 *
 * Supports: Fiat (cards via SPTs), Crypto (stablecoins on Tempo network),
 * and session-based streaming micropayments.
 */

/** @typedef {'pending'|'authorized'|'settled'|'failed'|'refunded'} PaymentStatus */

/**
 * @typedef {Object} MppChallenge
 * @property {string} type - Challenge type identifier
 * @property {string} title - Human-readable title
 * @property {number} status - HTTP status (always 402)
 * @property {string} detail - Description of payment requirement
 * @property {string} challengeId - Unique challenge identifier
 * @property {Object} paymentDetails - Amount, currency, recipient, accepted methods
 */

/**
 * @typedef {Object} MppReceipt
 * @property {string} receiptId - Unique receipt identifier
 * @property {string} challengeId - Original challenge this fulfills
 * @property {number} amount - Amount paid
 * @property {string} currency - Currency code
 * @property {PaymentStatus} status - Payment status
 * @property {string} timestamp - ISO timestamp of settlement
 */

/**
 * @typedef {Object} MppSession
 * @property {string} sessionId - Unique session identifier
 * @property {number} spendingLimit - Max authorized spend for this session
 * @property {number} spent - Amount spent so far
 * @property {string} currency - Session currency
 * @property {string} createdAt - ISO timestamp
 * @property {string} expiresAt - ISO timestamp
 * @property {boolean} active - Whether session is active
 */

export class MppClient {
  /**
   * @param {Object} config
   * @param {string} config.walletAddress - Agent's wallet address for crypto payments
   * @param {string} [config.sharedPaymentToken] - SPT for fiat payments
   * @param {string} [config.network] - Settlement network (default: 'tempo')
   * @param {boolean} [config.testnet] - Use testnet (default: true)
   * @param {typeof fetch} [config.fetch] - Custom fetch implementation
   */
  constructor(config) {
    this.walletAddress = config.walletAddress;
    this.sharedPaymentToken = config.sharedPaymentToken || null;
    this.network = config.network || 'tempo';
    this.testnet = config.testnet !== false;
    this.fetch = config.fetch || globalThis.fetch;
    this.sessions = new Map();
    this.receipts = [];
  }

  /**
   * Request a paid resource using MPP flow.
   * Handles the 402 challenge/response cycle automatically.
   *
   * @param {string} url - Resource URL
   * @param {Object} [options] - Fetch options
   * @param {string} [sessionId] - Existing session to use for payment
   * @returns {Promise<{response: Response, receipt: MppReceipt|null}>}
   */
  async requestResource(url, options = {}, sessionId = null) {
    // Step 1: Initial request
    const initialResponse = await this.fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Accept': 'application/json',
        'User-Agent': 'CornPone-AgenticFinance/1.0',
      },
    });

    // If not 402, resource is free or already authorized
    if (initialResponse.status !== 402) {
      return { response: initialResponse, receipt: null };
    }

    // Step 2: Parse the 402 challenge
    const challenge = await this._parseChallenge(initialResponse);

    // Step 3: Authorize payment
    const credential = await this._authorizePayment(challenge, sessionId);

    // Step 4: Retry with payment credential
    const paidResponse = await this.fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `MPP ${credential}`,
        'Accept': 'application/json',
        'User-Agent': 'CornPone-AgenticFinance/1.0',
      },
    });

    // Step 5: Extract receipt
    const receipt = this._extractReceipt(paidResponse);
    if (receipt) {
      this.receipts.push(receipt);
    }

    return { response: paidResponse, receipt };
  }

  /**
   * Open a session for streaming micropayments.
   * "OAuth for money" - authorize once, pay programmatically within limits.
   *
   * @param {Object} params
   * @param {number} params.spendingLimit - Max amount to authorize
   * @param {string} params.currency - Currency code (e.g., 'usd', 'PATH_USD')
   * @param {number} [params.ttlSeconds] - Session TTL (default: 3600)
   * @returns {Promise<MppSession>}
   */
  async openSession({ spendingLimit, currency, ttlSeconds = 3600 }) {
    const now = new Date();
    const session = {
      sessionId: `mpp_session_${crypto.randomUUID()}`,
      spendingLimit,
      spent: 0,
      currency,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      active: true,
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  /**
   * Close a session and settle remaining balance.
   * @param {string} sessionId
   * @returns {Promise<{settled: number, refunded: number}>}
   */
  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.active = false;
    const refunded = session.spendingLimit - session.spent;

    return { settled: session.spent, refunded };
  }

  /**
   * Check if a session can cover a payment.
   * @param {string} sessionId
   * @param {number} amount
   * @returns {boolean}
   */
  canSessionPay(sessionId, amount) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) return false;
    if (new Date(session.expiresAt) < new Date()) {
      session.active = false;
      return false;
    }
    return (session.spent + amount) <= session.spendingLimit;
  }

  /**
   * Parse a 402 challenge response.
   * @param {Response} response
   * @returns {Promise<MppChallenge>}
   * @private
   */
  async _parseChallenge(response) {
    const body = await response.json();

    if (!body.challengeId) {
      throw new Error('Invalid MPP 402 response: missing challengeId');
    }

    return {
      type: body.type || 'payment_required',
      title: body.title || 'Payment Required',
      status: 402,
      detail: body.detail || 'Payment is required.',
      challengeId: body.challengeId,
      paymentDetails: {
        amount: body.amount || body.paymentDetails?.amount,
        currency: body.currency || body.paymentDetails?.currency,
        recipient: body.recipient || body.paymentDetails?.recipient,
        acceptedMethods: body.acceptedMethods || body.paymentDetails?.acceptedMethods || ['crypto'],
      },
    };
  }

  /**
   * Authorize a payment against a challenge.
   * Returns an encoded credential for the Authorization header.
   *
   * @param {MppChallenge} challenge
   * @param {string|null} sessionId
   * @returns {Promise<string>}
   * @private
   */
  async _authorizePayment(challenge, sessionId) {
    const { paymentDetails } = challenge;

    // If using a session, debit from session
    if (sessionId) {
      if (!this.canSessionPay(sessionId, paymentDetails.amount)) {
        throw new Error(
          `Session ${sessionId} cannot cover payment of ${paymentDetails.amount} ${paymentDetails.currency}`
        );
      }
      const session = this.sessions.get(sessionId);
      session.spent += paymentDetails.amount;
    }

    // Build credential payload
    const credential = {
      challengeId: challenge.challengeId,
      paymentScheme: this._selectPaymentScheme(paymentDetails.acceptedMethods),
      walletAddress: this.walletAddress,
      network: this.network,
      testnet: this.testnet,
      sessionId: sessionId || undefined,
      timestamp: new Date().toISOString(),
    };

    // If fiat via SPT, include the token
    if (credential.paymentScheme === 'spt' && this.sharedPaymentToken) {
      credential.sharedPaymentToken = this.sharedPaymentToken;
    }

    return Buffer.from(JSON.stringify(credential)).toString('base64');
  }

  /**
   * Select the best payment scheme from accepted methods.
   * @param {string[]} acceptedMethods
   * @returns {string}
   * @private
   */
  _selectPaymentScheme(acceptedMethods) {
    // Prefer crypto (stablecoins) > SPT (fiat) > other
    if (acceptedMethods.includes('crypto')) return 'crypto';
    if (acceptedMethods.includes('spt') && this.sharedPaymentToken) return 'spt';
    if (acceptedMethods.includes('lightning')) return 'lightning';
    return acceptedMethods[0] || 'crypto';
  }

  /**
   * Extract receipt from a paid response.
   * @param {Response} response
   * @returns {MppReceipt|null}
   * @private
   */
  _extractReceipt(response) {
    const receiptHeader = response.headers?.get?.('X-MPP-Receipt');
    if (receiptHeader) {
      try {
        return JSON.parse(Buffer.from(receiptHeader, 'base64').toString());
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Get all payment receipts for audit/reconciliation.
   * @returns {MppReceipt[]}
   */
  getReceipts() {
    return [...this.receipts];
  }

  /**
   * Get active sessions.
   * @returns {MppSession[]}
   */
  getActiveSessions() {
    return [...this.sessions.values()].filter(s => s.active);
  }
}
