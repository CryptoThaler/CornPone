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

## Key Insight

MPP turns every HTTP endpoint into a potential point-of-sale. Combined with MCP, it creates an economy where agents can autonomously discover, negotiate, pay for, and consume services — the same way humans browse, evaluate, and purchase on the web, but at machine speed and scale.

The session primitive is the critical innovation: by aggregating thousands of micropayments into single settlements, MPP makes true pay-per-use economics viable at internet scale. This is what enables business models like "pay $0.001 per API call" that were previously impractical due to transaction costs.
