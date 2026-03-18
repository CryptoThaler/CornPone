# Machine Payments Protocol (MPP) - Protocol Analysis

## Overview

The Machine Payments Protocol (MPP) is an open standard co-authored by **Stripe** and **Tempo** that enables AI agents to pay for resources programmatically over HTTP. It builds on the long-dormant HTTP 402 "Payment Required" status code to create a native payment layer for the internet.

## The Problem MPP Solves

AI agents are evolving from chatbots to autonomous actors that browse, transact, and consume services. But the financial infrastructure was built for humans — creating accounts, navigating pricing pages, entering card details. MPP eliminates this friction by making payments a protocol-level concern, just like authentication (401) or authorization (403).

## How MPP Works (Technical Flow)

```
Agent                          Service                         Stripe
  │                              │                               │
  │──── GET /resource ──────────>│                               │
  │                              │                               │
  │<─── 402 Payment Required ────│                               │
  │     {                        │                               │
  │       challengeId: "ch_xxx", │                               │
  │       amount: 100,           │                               │
  │       currency: "usd",      │                               │
  │       recipient: "0x..."    │                               │
  │     }                        │                               │
  │                              │                               │
  │──── GET /resource ──────────>│                               │
  │     Authorization: MPP <cred>│                               │
  │                              │──── PaymentIntent.create ────>│
  │                              │     { amount, currency,       │
  │                              │       payment_method: crypto } │
  │                              │<──── PaymentIntent confirmed ─│
  │                              │                               │
  │<─── 200 OK + Receipt ───────│                               │
  │     X-MPP-Receipt: <receipt> │                               │
  │     { data: "..." }          │                               │
```

### Key Components

1. **402 Challenge**: Service returns payment requirements (amount, currency, accepted methods)
2. **Challenge ID**: Unique identifier linking the payment to the resource request
3. **Credential**: Agent's payment authorization (wallet address, signature, or SPT)
4. **Receipt**: Proof of payment returned with the resource

### Server-Side (Stripe Integration)

```javascript
import { Mppx, tempo } from 'mppx/server';

const mppx = Mppx.create({
  charge: tempo.charge({
    currency: 'PATH_USD',
    recipient: '0x...',
    testnet: true,
  }),
});

// In request handler:
const response = await mppx.charge({ amount: 100, recipient: '0x...' });
if (response.status === 402) {
  return response.challenge;  // Send 402 to agent
}
return response.withReceipt(Response.json({ data: 'paid content' }));
```

## Sessions: "OAuth for Money"

MPP introduces **sessions** — a primitive that lets agents authorize a spending limit upfront and stream micropayments without an on-chain transaction per interaction.

```
┌─ Session Lifecycle ──────────────────────────────┐
│                                                   │
│  1. Agent opens session with $10 spending limit   │
│  2. Agent makes API calls within session          │
│  3. Each call deducts from session balance         │
│  4. Thousands of microtransactions aggregated      │
│  5. Single settlement transaction on close         │
│                                                   │
│  No per-call blockchain tx = viable micropayments │
└───────────────────────────────────────────────────┘
```

## Shared Payment Tokens (SPTs)

SPTs bridge fiat and crypto payments. An agent can use an SPT (issued by Stripe) to pay with cards, wallets, or buy-now-pay-later methods — without the agent needing a traditional credit card.

## MPP vs x402

| Feature | MPP (Stripe/Tempo) | x402 (Coinbase/Cloudflare) |
|---------|-------------------|---------------------------|
| Settlement | Tempo network (stablecoins) + Stripe (fiat) | On-chain (Base, Stellar, etc.) |
| Fiat Support | Yes (via SPTs) | No (crypto-only) |
| Sessions | Yes (streaming micropayments) | No (per-transaction) |
| Facilitator | Stripe | Coinbase |
| Header | `Authorization: MPP <credential>` | `X-PAYMENT: <payload>` |
| Verification | Stripe PaymentIntents | On-chain verification |
| Tax/Fraud | Stripe built-in | Manual |
| Foundation | Stripe + Tempo | Coinbase + Cloudflare + Google + Visa |

Both protocols use **HTTP 402** as the trigger mechanism, but differ in settlement infrastructure and capabilities.

## Relationship to Agentic Frameworks

### Model Context Protocol (MCP)

MPP is designed to work with MCP servers. An MCP server can gate tools/resources behind payment:

```
MCP Server: "tool: web_search"
  → Agent calls tool
  → MCP server returns 402 with MPP challenge
  → Agent's finance sub-agent handles payment
  → Tool result delivered
```

This enables **monetized MCP servers** — any MCP tool provider can charge per-call.

### Stripe's Agentic Commerce Stack

- **Agentic Commerce Protocol (ACP)**: Higher-level protocol for agent-to-business commerce
- **MPP**: Low-level payment protocol (this document)
- **MCP Integrations**: Payment-aware MCP servers
- **x402 Support**: Stripe also supports the competing x402 standard
- **Dashboard**: All agent payments visible in Stripe Dashboard alongside human payments

### Agent Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Parent Agent (LLM)                  │
│  Planning, reasoning, tool selection             │
├─────────────────────────────────────────────────┤
│          Agentic Finance Sub Agent               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Wallet   │ │ Sessions │ │ Spending Policy  │ │
│  │ (balances,│ │ (stream  │ │ (limits, daily   │ │
│  │  audit)   │ │  micro-  │ │  caps, approval  │ │
│  │           │ │  payments│ │  thresholds)     │ │
│  └─────┬────┘ └────┬─────┘ └────────┬─────────┘ │
│        └────────┬───┘               │            │
│           ┌─────▼───────────────────▼──┐         │
│           │   Protocol Negotiator      │         │
│           │   (auto-detect MPP/x402)   │         │
│           └─────┬──────────────┬───────┘         │
│           ┌─────▼────┐  ┌─────▼────┐             │
│           │ MPP (402) │  │ x402     │             │
│           │ Stripe/   │  │ Coinbase/│             │
│           │ Tempo     │  │ Base     │             │
│           └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────┘
```

## Early Ecosystem (March 2026)

### Services accepting MPP payments:
- **Browserbase**: Pay-per-session headless browsers
- **PostalForm**: Agent-paid physical mail printing
- **Prospect Butcher Co.**: Agent-ordered sandwiches (NYC)
- **Stripe Climate**: Programmatic climate contributions
- **100+ services** in Tempo's payment directory

### Infrastructure:
- **Tempo Network**: Purpose-built for high-volume stablecoin settlement (low fees, instant finality)
- **Visa**: Extended MPP to support card payments
- **Lightspark**: Extended MPP for Bitcoin Lightning payments

## x402 Deep Dive

### x402 Protocol Flow (12 Steps)

1. Client requests resource from server
2. Server responds `402` + `PAYMENT-REQUIRED` header (Base64 JSON)
3. Client selects a PaymentRequirement and creates PaymentPayload
4. Client retries with `PAYMENT-SIGNATURE` header
5. Server verifies payload locally or via facilitator `/verify` endpoint
6. Facilitator validates based on scheme and network
7. Server fulfills request if verification succeeds
8. Server settles payment via facilitator `/settle` endpoint
9. Facilitator submits transaction to blockchain
10. Facilitator awaits confirmation
11. Facilitator returns execution response
12. Server returns `200 OK` with `PAYMENT-RESPONSE` header

### x402 Headers

| Header | Direction | Content |
|---|---|---|
| `PAYMENT-REQUIRED` | Server → Client | Base64 payment requirements (in 402 response) |
| `PAYMENT-SIGNATURE` | Client → Server | Base64 payment payload (retry request) |
| `PAYMENT-RESPONSE` | Server → Client | Base64 settlement response (200 response) |

### x402 Payment Schemes

- **`exact`** — Fixed amount (e.g., $1 per article)
- **`upto`** — Variable based on consumption (e.g., LLM token billing)

### x402 Server Example (Express)

```javascript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = express();
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.x402.org"
});
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:84532", new ExactEvmScheme());

app.use(
  paymentMiddleware(
    {
      "GET /protected-route": {
        accepts: { scheme: "exact", price: "$0.10", network: "eip155:84532", payTo: "0xYourAddress" },
        description: "Access to premium content",
      },
    },
    resourceServer,
  ),
);
```

### x402 Ecosystem Stats

- 35M+ transactions and $10M+ volume on Solana since launch
- SDKs: TypeScript, Python, Go
- Supported networks: Base, Polygon, Solana
- Coinbase hosts facilitator with free tier of 1,000 tx/month

## Tempo Network Technical Details

| Feature | Detail |
|---|---|
| **Throughput** | 100K+ TPS |
| **Finality** | Sub-1 second |
| **Consensus** | Simplex (low-latency), transitioning to permissionless PoS |
| **Execution** | EVM-compatible (Solidity), built on Paradigm's Reth client |
| **Token standard** | TIP-20 (enshrined stablecoin standard with memo/reconciliation) |
| **Gas fees** | Payable in any stablecoin via enshrined AMM — no native gas token |
| **Privacy** | Opt-in privacy features |
| **Compliance** | ISO 20022 compliant, access control lists planned |
| **Payment lanes** | Dedicated tx lanes ensuring payments always have blockspace |

Tempo = Stripe's capstone: **Tempo** (L1 chain) + **Bridge** (stablecoin orchestration) + **Privy** (wallet infrastructure) = full-stack stablecoin settlement.

## SPT Technical Details

1. Customer provides payment method to agent (card, BNPL via Affirm/Klarna, wallet)
2. Agent creates SPT via Stripe API — scoped to: specific seller, transaction amount, short expiration
3. SPT passed to seller (in ACP `CompleteCheckout` call or MPP payment)
4. Seller creates PaymentIntent using SPT
5. Stripe clones the payment method — seller never sees raw credentials

```bash
curl https://api.stripe.com/v1/test_helpers/shared_payment/tokens \
  -u "sk_test_..." \
  -d payment_method=pm_card_visa \
  -d "usage_limits[currency]"=usd \
  -d "usage_limits[max_amount]"=10000 \
  -d "usage_limits[expires_at]"={{TIME_IN_FUTURE}} \
  -d "seller_details[network_id]"=internal \
  -d "seller_details[external_id]"={{ANY_STRING}}
```

## ACP (Agentic Commerce Protocol) — Product Commerce Layer

Co-developed by Stripe and OpenAI. Four endpoints:

1. **CreateCheckout** — Agent sends SKU; seller returns cart, payment methods, fulfillment options
2. **UpdateCheckout** — Modify quantities, shipping, customer details
3. **CompleteCheckout** — Agent provisions SPT and completes purchase
4. **CancelCheckout** — Agent notifies seller; seller releases inventory

First live integration: OpenAI's Instant Checkout in ChatGPT (Etsy, Shopify merchants).

## MCP Payment Integration Patterns

### Worldpay MCP Server
- `take_guest_payment` — process payment via Worldpay API
- `generateCheckoutForm` — create checkout UI code
- Follow-on tools for settlement, cancel, refund via action links

### Agent Wallet SDK (`@agentauth/wallet`)
- Non-custodial USDC wallet as MCP tool server
- Spending policies with per-tx caps and daily limits
- Native x402 support: detects 402, checks policy, signs USDC transfer, retries

### PayGated (`paygated.dev`)
- "Monetize any MCP server with one command"
- Adds API key auth, credit billing, rate limiting as a proxy

## Full Competitive Landscape (March 2026)

| Protocol | Creator | Payment Rails | Primary Use | Transport |
|---|---|---|---|---|
| **MPP** | Stripe + Tempo | Stablecoins, cards, Lightning | Pay-per-call APIs | HTTP 402 |
| **x402** | Coinbase | USDC on Base/Polygon/Solana | API monetization | HTTP 402 |
| **ACP** | Stripe + OpenAI | Cards, wallets, BNPL via SPTs | E-commerce checkout | REST / MCP |
| **UCP** | Google | Cards, stablecoins | Full commerce | REST / A2A / MCP |
| **AP2** | Google Cloud | Cards, stablecoins | Payment orchestration | gRPC / REST |

## Key Insight

MPP turns every HTTP endpoint into a potential point-of-sale. Combined with MCP, it creates an economy where agents can autonomously discover, negotiate, pay for, and consume services — the same way humans browse, evaluate, and purchase on the web, but at machine speed and scale.

The session primitive is the critical innovation: by aggregating thousands of micropayments into single settlements, MPP makes true pay-per-use economics viable at internet scale. This is what enables business models like "pay $0.001 per API call" that were previously impractical due to transaction costs.

Stripe supporting **both** MPP and x402, plus ACP for product commerce, positions them as the universal settlement layer for the agent economy — regardless of which protocol wins.
