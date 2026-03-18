/**
 * Basic Usage: Agentic Finance Sub Agent
 *
 * Shows how a parent agent (LLM-driven) uses the finance sub-agent
 * to autonomously pay for resources via MPP and x402.
 */

import { AgenticFinanceAgent } from '../src/index.js';

// --- Example 1: One-shot payment for a paid API call ---

async function payForApiCall() {
  const finance = new AgenticFinanceAgent({
    agentId: 'research-agent-001',
    walletAddress: '0x1234...agent-wallet',
    spending: {
      maxPerTransaction: 5_00,  // $5.00 max per call (amounts in cents)
      maxDaily: 50_00,          // $50.00 daily limit
      requireApproval: true,
      approvalThreshold: 10_00, // Human approval over $10
    },
    testnet: true,
    onPayment: (result) => {
      console.log(`Paid ${result.protocol}: receipt=${JSON.stringify(result.receipt)}`);
    },
  });

  // Fund the wallet
  finance.fund(100_00, 'usd', 'treasury');

  // Agent pays for a Browserbase session (MPP)
  const result = await finance.payForResource(
    'https://api.browserbase.com/v1/sessions',
    { method: 'POST', body: JSON.stringify({ url: 'https://example.com' }) },
  );

  console.log('Success:', result.success);
  console.log('Budget:', finance.getBudgetStatus());
}

// --- Example 2: Session-based streaming micropayments ---

async function streamingMicropayments() {
  const finance = new AgenticFinanceAgent({
    agentId: 'data-agent-002',
    walletAddress: '0xabcd...agent-wallet',
    spending: { maxPerTransaction: 1_00, maxDaily: 100_00 },
    testnet: true,
  });

  finance.fund(50_00, 'usd');

  // Open a session: "OAuth for money"
  // Authorize $10 upfront, stream micropayments within that limit
  const session = await finance.openPaymentSession({
    budget: 10_00,
    currency: 'usd',
    ttlSeconds: 1800, // 30 minutes
  });

  console.log(`Session opened: ${session.sessionId}, expires: ${session.expiresAt}`);

  // Make many small API calls within the session
  for (let i = 0; i < 5; i++) {
    await finance.payForResource(
      'https://api.data-provider.com/query',
      { method: 'POST', body: JSON.stringify({ query: `SELECT * FROM dataset_${i}` }) },
      { sessionId: session.sessionId },
    );
  }

  // Close session, settle remaining balance
  const settlement = await finance.closePaymentSession(session.sessionId);
  console.log(`Session settled: spent=${settlement.settled}, refunded=${settlement.refunded}`);
}

// --- Example 3: Multi-protocol with service registry ---

async function multiProtocol() {
  const finance = new AgenticFinanceAgent({
    agentId: 'multi-agent-003',
    walletAddress: '0x5678...agent-wallet',
    sharedPaymentToken: 'spt_live_xxx', // Fiat via Stripe SPT
    signPayment: async (data) => `sig_${Date.now()}`, // x402 crypto signing
    testnet: true,
  });

  finance.fund(200_00, 'usd');
  finance.fund(50, 'USDC');

  // Register known services
  finance.registerService('browserbase.com', 'mpp');
  finance.registerService('postalform.com', 'mpp');
  finance.registerService('some-x402-api.com', 'x402');

  // Agent auto-selects protocol based on service registry
  await finance.payForResource('https://api.browserbase.com/sessions');
  await finance.payForResource('https://some-x402-api.com/data');

  // Full audit trail
  console.log(JSON.stringify(finance.getAuditTrail(), null, 2));
}

// Run examples
payForApiCall().catch(console.error);
