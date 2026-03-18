/**
 * x402 Protocol Client
 *
 * Implements the x402 HTTP 402 payment flow (Coinbase/Cloudflare standard):
 * 1. Client requests a resource
 * 2. Server responds with HTTP 402 + payment requirements in headers/body
 * 3. Client signs a payment authorization with crypto wallet
 * 4. Client retries with payment proof in X-PAYMENT header
 * 5. Facilitator verifies payment, server delivers resource
 *
 * x402 differs from MPP in that it uses on-chain stablecoin payments
 * verified by a facilitator (e.g., Coinbase), whereas MPP uses Stripe's
 * PaymentIntents with the Tempo network for settlement.
 */

/**
 * @typedef {Object} X402PaymentRequired
 * @property {string} scheme - Payment scheme identifier
 * @property {string} network - Blockchain network (e.g., 'base', 'stellar')
 * @property {number} maxAmountRequired - Maximum payment amount
 * @property {string} currency - Token/currency (e.g., 'USDC')
 * @property {string} recipient - Recipient wallet address
 * @property {Object} [extra] - Additional scheme-specific data
 */

/**
 * @typedef {Object} X402PaymentPayload
 * @property {string} scheme - Payment scheme used
 * @property {string} network - Network used
 * @property {Object} payload - Signed payment data
 */

export class X402Client {
  /**
   * @param {Object} config
   * @param {string} config.walletAddress - Agent's wallet address
   * @param {Function} config.signPayment - Function to sign payment authorizations
   * @param {string} [config.network] - Preferred network (default: 'base')
   * @param {string} [config.facilitatorUrl] - Payment facilitator URL
   * @param {typeof fetch} [config.fetch] - Custom fetch implementation
   */
  constructor(config) {
    this.walletAddress = config.walletAddress;
    this.signPayment = config.signPayment;
    this.network = config.network || 'base';
    this.facilitatorUrl = config.facilitatorUrl || null;
    this.fetch = config.fetch || globalThis.fetch;
    this.payments = [];
  }

  /**
   * Request a paid resource using x402 flow.
   *
   * @param {string} url - Resource URL
   * @param {Object} [options] - Fetch options
   * @returns {Promise<{response: Response, payment: X402PaymentPayload|null}>}
   */
  async requestResource(url, options = {}) {
    // Step 1: Initial request
    const initialResponse = await this.fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Accept': 'application/json',
      },
    });

    if (initialResponse.status !== 402) {
      return { response: initialResponse, payment: null };
    }

    // Step 2: Parse payment requirements
    const requirements = await this._parsePaymentRequired(initialResponse);

    // Step 3: Select scheme and create signed payment
    const paymentPayload = await this._createPayment(requirements);

    // Step 4: Retry with payment proof
    const paidResponse = await this.fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-PAYMENT': Buffer.from(JSON.stringify(paymentPayload)).toString('base64'),
        'Accept': 'application/json',
      },
    });

    this.payments.push({
      url,
      ...paymentPayload,
      timestamp: new Date().toISOString(),
      status: paidResponse.ok ? 'settled' : 'failed',
    });

    return { response: paidResponse, payment: paymentPayload };
  }

  /**
   * Parse 402 response for payment requirements.
   * @param {Response} response
   * @returns {Promise<X402PaymentRequired>}
   * @private
   */
  async _parsePaymentRequired(response) {
    const body = await response.json();

    return {
      scheme: body.scheme || body.accepts?.[0]?.scheme || 'exact',
      network: body.network || body.accepts?.[0]?.network || this.network,
      maxAmountRequired: body.maxAmountRequired || body.amount,
      currency: body.currency || 'USDC',
      recipient: body.recipient || body.address,
      extra: body.extra || {},
    };
  }

  /**
   * Create and sign a payment authorization.
   * @param {X402PaymentRequired} requirements
   * @returns {Promise<X402PaymentPayload>}
   * @private
   */
  async _createPayment(requirements) {
    const paymentData = {
      from: this.walletAddress,
      to: requirements.recipient,
      amount: requirements.maxAmountRequired,
      currency: requirements.currency,
      network: requirements.network,
      nonce: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    const signature = await this.signPayment(paymentData);

    return {
      scheme: requirements.scheme,
      network: requirements.network,
      payload: {
        ...paymentData,
        signature,
      },
    };
  }

  /**
   * Get payment history.
   * @returns {Array}
   */
  getPaymentHistory() {
    return [...this.payments];
  }
}
