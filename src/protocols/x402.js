/**
 * x402 Protocol Client
 *
 * Implements the x402 HTTP 402 payment flow (Coinbase/Cloudflare/Google standard):
 * 1. Client requests a resource
 * 2. Server responds HTTP 402 + PAYMENT-REQUIRED header (Base64 JSON requirements)
 * 3. Client selects PaymentRequirement and creates signed PaymentPayload
 * 4. Client retries with PAYMENT-SIGNATURE header (Base64 payload)
 * 5. Server verifies via facilitator /verify endpoint
 * 6. Server settles via facilitator /settle endpoint (on-chain tx)
 * 7. Server returns 200 + PAYMENT-RESPONSE header (Base64 settlement receipt)
 *
 * x402 differs from MPP: on-chain USDC settlement via facilitator (Coinbase)
 * vs MPP's Stripe PaymentIntents + Tempo network.
 * Supported networks: Base, Polygon, Solana (ERC-20/SPL stablecoins).
 * Payment schemes: "exact" (fixed price) and "upto" (variable/consumption-based).
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
    this.facilitatorUrl = config.facilitatorUrl || 'https://facilitator.x402.org';
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

    // Step 2: Parse payment requirements from PAYMENT-REQUIRED header or body
    const requirements = await this._parsePaymentRequired(initialResponse);

    // Step 3: Select scheme and create signed payment
    const paymentPayload = await this._createPayment(requirements);

    // Step 4: Retry with PAYMENT-SIGNATURE header (x402 spec)
    const encodedPayload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
    const paidResponse = await this.fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'PAYMENT-SIGNATURE': encodedPayload,
        // Legacy header for backwards compatibility
        'X-PAYMENT': encodedPayload,
        'Accept': 'application/json',
      },
    });

    // Step 5: Extract settlement receipt from PAYMENT-RESPONSE header
    const settlementReceipt = this._extractSettlementReceipt(paidResponse);

    this.payments.push({
      url,
      ...paymentPayload,
      settlementReceipt,
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
    // x402 spec: requirements in PAYMENT-REQUIRED header (Base64) or body
    const headerValue = response.headers?.get?.('PAYMENT-REQUIRED');
    let body;
    if (headerValue) {
      try {
        body = JSON.parse(Buffer.from(headerValue, 'base64').toString());
      } catch {
        body = await response.json();
      }
    } else {
      body = await response.json();
    }

    return {
      scheme: body.scheme || body.accepts?.[0]?.scheme || 'exact',
      network: body.network || body.accepts?.[0]?.network || this.network,
      maxAmountRequired: body.maxAmountRequired || body.amount,
      currency: body.currency || 'USDC',
      recipient: body.recipient || body.address || body.payTo,
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
   * Extract settlement receipt from PAYMENT-RESPONSE header.
   * @param {Response} response
   * @returns {Object|null}
   * @private
   */
  _extractSettlementReceipt(response) {
    const receiptHeader = response.headers?.get?.('PAYMENT-RESPONSE');
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
   * Get payment history.
   * @returns {Array}
   */
  getPaymentHistory() {
    return [...this.payments];
  }
}
