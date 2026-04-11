# Monarch

### Tokenize Real-World Assets. Invest on-chain. Earn yield.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Sepolia](https://img.shields.io/badge/Network-Sepolia%20Testnet-7B3FE4)
![License](https://img.shields.io/badge/License-MIT-green)

Monarch is a full-stack Real-World Asset (RWA) tokenization platform. It lets anyone fractionally invest in physical assets — real estate, farmland, commercial property — by purchasing ERC-20 tokens backed by those assets. Settlement, yield distribution, and authentication are all secured by the Ethereum blockchain (Sepolia testnet).

> **Demo note:** Monarch runs on Sepolia testnet using Mock USDC. No real funds are involved. Grab test tokens from the in-app faucet.

---

## Table of Contents

1. [What is Monarch?](#what-is-monarch)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Deployed Contracts](#deployed-contracts-sepolia)
5. [Prerequisites](#prerequisites)
6. [Local Development](#local-development)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Project Structure](#project-structure)
10. [How It Works](#how-it-works)
11. [Deploying to Production](#deploying-to-production)
12. [Contributing](#contributing)
13. [License](#license)

---

## What is Monarch?

### The Problem

Real-world assets — real estate, agricultural land, commodities — represent the largest asset class on earth, yet access is gated by high minimum investments, illiquid markets, and opaque intermediaries. Ordinary investors are locked out.

### The Solution

Monarch tokenizes RWAs as on-chain ERC-20 shares. Each asset is represented by a smart contract token. Investors buy fractions using USDC, hold tokens in their own wallet, and receive proportional yield when the asset generates income. Selling is as simple as transferring tokens back to the secondary pool — the relayer pays out USDC atomically.

### Key Properties

| Property | Implementation |
|---|---|
| Fractional ownership | ERC-20 tokens at configurable USD price per token |
| Trustless payment | USDC transfer verified on-chain before tokens are minted |
| Yield distribution | Snapshot-based `PayoutDistributor` contract; pro-rata claims |
| Passwordless auth | SIWE (Sign-In With Ethereum, EIP-4361) + JWT |
| Secondary market | Secondary treasury pool with on-chain verification |
| Escrow support | `MilestoneEscrow` holds primary USDC, releases on approval |

---

## Architecture

```mermaid
graph TD
    subgraph Browser ["Browser (React + Wagmi)"]
        UI[Pages: Marketplace · Dashboard · AssetDetail · ListAsset]
        Auth[WalletAuthContext\nSIWE sign-in · JWT storage]
    end

    subgraph API ["monarch-api (Express v5 + Prisma)"]
        Routes[REST API\nauth · assets · purchases · sales\nyield · listings · portfolio · admin]
        Relayer[Blockchain Service\nRelayer Wallet — mints tokens,\npays yield, releases escrow]
        Workers[Background Workers\nOracle — price drift every 30 s\nTx-Monitor — Sepolia heartbeat]
        DB[(PostgreSQL\nvia Prisma ORM)]
    end

    subgraph Chain ["Sepolia — Ethereum Testnet"]
        USDC[MockUSDC\nERC-20 · 6 decimals]
        Token[AssetToken\nERC-20 · snapshots · roles]
        Payout[PayoutDistributor\nyield → snapshot → claim]
        Escrow[MilestoneEscrow\nprimary USDC release]
        Registry[AssetRegistry\nonchain asset index]
    end

    UI -- "SIWE challenge / JWT" --> Routes
    UI -- "Wagmi write\nUSDC transfer · yield claim" --> Chain
    Routes --> DB
    Routes --> Relayer
    Workers --> DB
    Workers --> Chain
    Relayer -- "mint · distributeYield\ntransfer · releaseMilestone" --> Chain
```

**Request flow (buy):**
1. Browser fetches `/purchases/intent` — API reserves supply and returns the USDC payment target.
2. User approves + transfers USDC on-chain via MetaMask.
3. Browser posts payment tx hash to `/purchases/confirm`.
4. API verifies the ERC-20 Transfer event on-chain, then the relayer mints AssetTokens to the user's wallet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TanStack Query, Wagmi v3, Viem |
| **UI** | Shadcn/UI, Radix UI, Tailwind CSS, Framer Motion |
| **Web3 (browser)** | Wagmi v3, Viem, MetaMask SDK (`@metamask/connect-evm`) |
| **Backend** | Express.js v5, TypeScript, Node.js 20 |
| **Database** | PostgreSQL, Prisma ORM v6 |
| **Blockchain (server)** | ethers.js v6 (relayer wallet, event parsing) |
| **Auth** | SIWE (EIP-4361), JWT (RS256) |
| **Smart Contracts** | Solidity 0.8.20, Hardhat, OpenZeppelin Contracts v4 |
| **Infrastructure** | Vercel (frontend), Render (API), Neon/Supabase (Postgres) |

---

## Deployed Contracts (Sepolia)

| Contract | Address |
|---|---|
| MockUSDC | [`0x52f3E714cff72DB398F70E9E607B15105b5F2302`](https://sepolia.etherscan.io/address/0x52f3E714cff72DB398F70E9E607B15105b5F2302) |
| AssetRegistry | [`0xc5417d5D37e85324F2Bec0Af941146aB43797929`](https://sepolia.etherscan.io/address/0xc5417d5D37e85324F2Bec0Af941146aB43797929) |
| PayoutDistributor | [`0xff82ffF721997a4095Ed7f07d7232167C76d4dD8`](https://sepolia.etherscan.io/address/0xff82ffF721997a4095Ed7f07d7232167C76d4dD8) |
| DemoAssetToken | [`0xC910e62BF7bd5C3Aa6e0c89d91041a88b8f194F0`](https://sepolia.etherscan.io/address/0xC910e62BF7bd5C3Aa6e0c89d91041a88b8f194F0) |
| Deployer / Relayer | [`0xF11Be4cd94AAfE40A1d08B9842F351A60600Ab86`](https://sepolia.etherscan.io/address/0xF11Be4cd94AAfE40A1d08B9842F351A60600Ab86) |

Contract source lives in [`monarch-contracts/contracts/`](monarch-contracts/contracts/). Deployed addresses are recorded in [`monarch-contracts/deployed-addresses.json`](monarch-contracts/deployed-addresses.json).

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 20+ | [nodejs.org](https://nodejs.org) |
| PostgreSQL | Local Docker, [Neon](https://neon.tech) free tier, or [Supabase](https://supabase.com) |
| MetaMask | Browser extension; switch to Sepolia network |
| Alchemy / Infura RPC | Free tier is enough — one key used for both API and browser |
| Relayer wallet | A funded Sepolia wallet **separate from your MetaMask key** — sharing keys causes nonce conflicts |
| Sepolia ETH | Small amount for gas; faucet at [sepoliafaucet.com](https://sepoliafaucet.com) |

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/your-org/monarch.git
cd monarch
```

### 2. Install dependencies

```bash
npm install --prefix monarch-api
npm install --prefix monarch-assets
npm install --prefix monarch-contracts   # optional — only needed to redeploy contracts
```

### 3. Configure the API

```bash
cp monarch-api/.env.example monarch-api/.env
```

Open `monarch-api/.env` and fill in the required values:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/monarch?schema=public"
JWT_SECRET="a-long-random-secret-min-8-chars"
SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
PRIVATE_KEY="0xYOUR_RELAYER_PRIVATE_KEY"
```

### 4. Configure the frontend

```bash
cp monarch-assets/.env.example monarch-assets/.env
```

```dotenv
VITE_API_BASE_URL=http://localhost:4000
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### 5. Set up the database

```bash
cd monarch-api
npx prisma migrate dev          # run migrations
npx prisma db seed              # seed demo assets
cd ..
```

### 6. Start the API (terminal 1)

```bash
cd monarch-api && npm run dev
# monarch-api listening on :4000
```

### 7. Start the frontend (terminal 2)

```bash
cd monarch-assets && npm run dev
# Vite dev server running on http://localhost:8080
```

### 8. Open in browser

Navigate to [http://localhost:8080](http://localhost:8080), connect MetaMask (Sepolia network), and sign in.

> **Test USDC:** Click the faucet button in the sidebar to mint 10,000 Mock USDC to your wallet.

---

## Environment Variables

### `monarch-api/.env`

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/monarch` |
| `JWT_SECRET` | **Yes** | JWT signing secret (min 8 chars). Use `openssl rand -hex 32` in production | `super-secret-key` |
| `FRONTEND_ORIGIN` | **Yes** | Comma-separated CORS origins | `http://localhost:8080` |
| `SIWE_DOMAIN` | **Yes** | Domain checked in SIWE messages | `localhost` |
| `SIWE_ORIGIN` | **Yes** | Origin checked in SIWE messages | `http://localhost:8080` |
| `SEPOLIA_RPC_URL` | Recommended | Alchemy / Infura Sepolia endpoint — enables on-chain settlement | `https://eth-sepolia.g.alchemy.com/v2/KEY` |
| `PRIVATE_KEY` | Recommended | Relayer wallet hex key (`0x…`) — must hold `MINTER_ROLE` on AssetToken | `0xabc123…` |
| `SECONDARY_TREASURY_ADDRESS` | Optional | Wallet that receives RWA tokens on secondary sells | `0x…` |
| `PRIMARY_ISSUER_ADDRESS` | Optional | Receives primary subscription USDC for seed assets | `0x…` |
| `MOCK_USDC_ADDRESS` | Optional | Override contract address from `deployed-addresses.json` | `0x52f3…` |
| `ASSET_REGISTRY_ADDRESS` | Optional | Override AssetRegistry address | `0xc541…` |
| `PAYOUT_DISTRIBUTOR_ADDRESS` | Optional | Override PayoutDistributor address | `0xff82…` |
| `MILESTONE_ESCROW_ADDRESS` | Optional | Override MilestoneEscrow address | `0x…` |
| `KYC_MODE` | Optional | `stub` (allow all, default) or `strict` (require KYC approval) | `stub` |
| `LISTINGS_AUTO_PUBLISH` | Optional | `true` (default) — publish listings immediately; `false` — require admin approval | `true` |
| `OPENAI_API_KEY` | Optional | Enables AI-assisted risk scoring | `sk-…` |
| `PORT` | Optional | API server port (default `4000`) | `4000` |

### `monarch-assets/.env`

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_BASE_URL` | **Yes** | Backend API base URL | `http://localhost:4000` |
| `VITE_SEPOLIA_RPC_URL` | Recommended | Alchemy / Infura endpoint for browser wallet | `https://eth-sepolia.g.alchemy.com/v2/KEY` |
| `VITE_SEPOLIA_RPC_FALLBACK_URL` | Optional | Secondary RPC if primary is unavailable | `https://rpc.sepolia.org` |
| `VITE_MOCK_USDC_ADDRESS` | Optional | Override MockUSDC address | `0x52f3…` |
| `VITE_PAYOUT_DISTRIBUTOR_ADDRESS` | Optional | Override PayoutDistributor address | `0xff82…` |
| `VITE_SECONDARY_TREASURY_ADDRESS` | Optional | Override secondary treasury address | `0x…` |

---

## API Reference

All authenticated endpoints require an `Authorization: Bearer <jwt>` header. Obtain a JWT via the SIWE sign-in flow.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/challenge` | — | Request a SIWE challenge message for a wallet address |
| `POST` | `/auth/verify` | — | Submit signed SIWE message; returns a JWT on success |

### Config

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/config` | — | Returns chain ID, contract addresses, and settlement mode |
| `GET` | `/health` | — | Liveness check (`{ status: "ok" }`) |

### Assets

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/assets` | — | List all marketplace assets (with oracle prices) |
| `GET` | `/assets/:id` | — | Single asset detail including escrow milestones |

### Purchases

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/purchases/intent` | User | Create a purchase intent; returns USDC payment instructions |
| `POST` | `/purchases/confirm` | User | Submit payment tx hash; API verifies on-chain and triggers relayer mint |
| `GET` | `/purchases/me` | User | Last 25 purchase intents for the authenticated user |

### Sales

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/sales/intent` | User | Create a sell intent; returns expected USDC payout |
| `POST` | `/sales/settle` | User | Submit RWA transfer tx hash; relayer pays out USDC |
| `GET` | `/sales/me` | User | Last 25 sale intents for the authenticated user |

### Portfolio

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/portfolio/me` | User | Positions, unrealized P&L, risk scores, and portfolio snapshots |

### Yield

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/yield/onchain-claimable` | User | Query `PayoutDistributor` for claimable yield per asset |
| `POST` | `/yield/distribute` | Admin | Relayer deposits USDC into `PayoutDistributor` and takes a snapshot |

### Listings

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/listings` | User | Submit a new asset for tokenization (validates economics + yield) |
| `GET` | `/listings/me` | User | All listings submitted by the authenticated user |

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/admin/assets` | Admin | Create a tokenized asset directly (bypasses listing flow) |
| `POST` | `/admin/sync-escrow` | Admin | Sync escrow milestone completion status from on-chain |

---

## Project Structure

```
monarch/
├── monarch-api/                   # Express v5 REST API
│   ├── prisma/
│   │   ├── schema.prisma          # Data model: User, Asset, Position, Yield, ...
│   │   ├── migrations/            # PostgreSQL migration history
│   │   └── seed.ts                # Demo asset seeding
│   └── src/
│       ├── config/
│       │   └── env.ts             # Zod-validated environment variables
│       ├── db/
│       │   └── prisma.ts          # Prisma client singleton
│       ├── lib/
│       │   ├── asset-json.ts      # Asset → API shape transform
│       │   ├── http-error.ts      # Typed HTTP error class
│       │   └── tranche.ts         # Supply / tranche helpers
│       ├── middleware/
│       │   ├── auth.ts            # requireAuth / requireAdmin JWT middleware
│       │   └── error-handler.ts   # Express error handler
│       ├── routes/
│       │   ├── admin.routes.ts
│       │   ├── assets.routes.ts
│       │   ├── auth.routes.ts
│       │   ├── listings.routes.ts
│       │   ├── portfolio.routes.ts
│       │   ├── purchases.routes.ts
│       │   ├── sales.routes.ts
│       │   └── yield.routes.ts
│       ├── services/
│       │   ├── auth.service.ts          # SIWE challenge + verify
│       │   ├── blockchain.service.ts    # Provider, relayer wallet, on-chain calls
│       │   ├── contracts.ts             # ABI + address registry
│       │   ├── kyc.service.ts           # KYC gating (stub / strict)
│       │   ├── listing-publish.service.ts
│       │   ├── purchase-recipient.service.ts
│       │   └── risk.service.ts          # Oracle risk scoring
│       ├── workers/
│       │   ├── oracle.worker.ts         # Price drift simulation (every 30 s)
│       │   └── tx-monitor.worker.ts     # Sepolia heartbeat monitor
│       ├── app.ts                       # Express app + route mounting
│       └── index.ts                     # Server entry point
│
├── monarch-assets/                # React 18 frontend
│   └── src/
│       ├── components/
│       │   ├── ui/                # Shadcn/UI primitives (Button, Card, ...)
│       │   ├── AppSidebar.tsx     # Navigation sidebar + faucet + wallet
│       │   ├── AssetCard.tsx      # Marketplace asset tile
│       │   ├── DashboardOnchainPanels.tsx  # Holdings table + yield claims
│       │   ├── InvestAmountSelector.tsx    # USDC amount slider
│       │   ├── InvestRitualOverlay.tsx     # Multi-step buy flow UI
│       │   └── SellRwaPanel.tsx            # Token sell panel
│       ├── contexts/
│       │   └── WalletAuthContext.tsx  # SIWE auth state + auto-sign-in
│       ├── hooks/
│       │   ├── use-assets.ts
│       │   ├── use-portfolio.ts
│       │   ├── use-sell-holding.ts
│       │   ├── use-wallet-auth.ts
│       │   └── use-wallet-liquidity.ts
│       ├── layouts/
│       │   └── AppLayout.tsx      # Sidebar + main content shell
│       ├── lib/
│       │   ├── api.ts             # Typed API client
│       │   ├── asset-images.ts    # Asset image mapping
│       │   ├── auth-token.ts      # JWT localStorage helpers
│       │   ├── chain.ts           # Contract addresses + ABIs
│       │   ├── invest-amount.ts   # Buy-amount bounds logic
│       │   ├── invest-flow.ts     # End-to-end purchase orchestration
│       │   ├── sell-flow.ts       # End-to-end sell orchestration
│       │   ├── tranche.ts         # Supply percentage helpers
│       │   ├── utils.ts           # cn(), formatUsd()
│       │   └── wagmi.ts           # Wagmi config (Sepolia + Mainnet)
│       └── pages/
│           ├── AssetDetail.tsx    # Asset info + buy panel + map
│           ├── Dashboard.tsx      # Portfolio summary + activity
│           ├── Landing.tsx        # Marketing landing page
│           ├── ListAsset.tsx      # Asset submission form
│           ├── Marketplace.tsx    # Asset grid + filters
│           └── NotFound.tsx       # 404 page
│
└── monarch-contracts/             # Solidity 0.8.20 + Hardhat
    ├── contracts/
    │   ├── AssetRegistry.sol      # Central registry of tokenized assets
    │   ├── AssetToken.sol         # ERC-20 with snapshots + roles
    │   ├── MilestoneEscrow.sol    # Milestone-gated USDC release
    │   ├── MockUSDC.sol           # Test USDC with public faucet
    │   └── PayoutDistributor.sol  # Snapshot-based yield distribution
    ├── scripts/
    │   └── deploy.js              # Hardhat deploy script (writes deployed-addresses.json)
    ├── deployed-addresses.json    # On-chain addresses after deploy
    └── hardhat.config.js
```

---

## How It Works

### Buy Flow

```
User                  Frontend              monarch-api           Sepolia
 │                        │                      │                   │
 │──select asset + amount─►│                      │                   │
 │                        │──POST /purchases/intent──►│               │
 │                        │◄──payment instructions──│                 │
 │◄─approve MetaMask tx───│                      │                   │
 │──sign USDC transfer────►│                      │                   │
 │                        │──────────────────────────────────────────►│
 │                        │                      │      ERC-20 Transfer
 │                        │──POST /purchases/confirm (paymentTxHash)─►│
 │                        │                      │──verifyErc20Transfer─►│
 │                        │                      │◄──Transfer found──│
 │                        │                      │──relayerMint()────────►│
 │                        │                      │◄──AssetToken minted───│
 │◄───────────────tokens in wallet───────────────│                   │
```

1. User selects an asset and enters a USDC amount on the Marketplace or Asset Detail page.
2. Frontend calls `POST /purchases/intent` — API reserves supply and returns USDC payment target (escrow or secondary treasury).
3. User approves the USDC transfer in MetaMask; transaction is broadcast to Sepolia.
4. Frontend calls `POST /purchases/confirm` with the transaction hash.
5. API queries Sepolia for the receipt and verifies the exact ERC-20 `Transfer` event (amount, sender, recipient).
6. Relayer wallet calls `AssetToken.mint(userWallet, amount)` — tokens land in the user's wallet.
7. API updates `PortfolioPosition` in Postgres; the dashboard reflects the new holding.

### Yield Distribution Flow

1. Admin calls `POST /yield/distribute` specifying an asset and a USDC amount.
2. The relayer approves and deposits Mock USDC into `PayoutDistributor`, then calls `distributeYield(assetToken, amount)`.
3. `PayoutDistributor` snapshots all `AssetToken` balances at that block.
4. Each holder's claimable share is `userBalance × amountPerToken / 1e18`.
5. Users call `claimYield(assetToken)` directly from their wallet on the Dashboard — USDC transfers on-chain.

### Sell Flow

1. User selects a holding on the Dashboard and enters a token amount to sell.
2. Frontend calls `POST /sales/intent` — API checks the DB position and quotes a USDC payout at oracle price.
3. User transfers AssetTokens to the secondary treasury via MetaMask.
4. Frontend calls `POST /sales/settle` with the transfer tx hash.
5. API verifies the `Transfer` event on-chain (correct token, amount, recipient).
6. Relayer calls `MockUSDC.transfer(userWallet, usdcAmount)` — stablecoin lands in the user's wallet.
7. API decrements `PortfolioPosition`; available supply is restored for future buyers.

---

## Deploying to Production

### Frontend → Vercel

The repo includes a root-level [`vercel.json`](vercel.json) pre-configured for Vercel deployments:

```bash
vercel login
vercel deploy
```

Set these environment variables in the Vercel dashboard:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | Your Render API URL (e.g. `https://monarch-api.onrender.com`) |
| `VITE_SEPOLIA_RPC_URL` | Your Alchemy / Infura key |

### API → Render

[`monarch-api/render.yaml`](monarch-api/render.yaml) is a Render blueprint. Create a new Web Service from the repo and set:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon or Supabase PostgreSQL connection string |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `FRONTEND_ORIGIN` | Your Vercel deployment URL |
| `SIWE_DOMAIN` | Your Vercel domain (e.g. `monarch.vercel.app`) |
| `SIWE_ORIGIN` | Your Vercel HTTPS URL |
| `SEPOLIA_RPC_URL` | Alchemy / Infura endpoint |
| `PRIVATE_KEY` | Funded Sepolia relayer wallet private key |

Render auto-runs migrations on deploy via the build command in `render.yaml`.

### Contracts → Hardhat (optional)

Redeploy contracts only if you need fresh addresses:

```bash
cd monarch-contracts
cp .env.example .env
# Set SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY in .env
npx hardhat run scripts/deploy.js --network sepolia
# deployed-addresses.json is updated automatically
```

Copy the new addresses into your API `.env` (`MOCK_USDC_ADDRESS`, etc.) and redeploy.

---

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feat/my-feature`
2. Follow existing patterns: Zod for all validation, `HttpError` for API errors, no `any` types.
3. Run lint and build before opening a PR:
   ```bash
   cd monarch-api   && npm run lint && npm run build
   cd monarch-assets && npm run lint && npm run build
   ```
4. Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`.
5. Open a pull request with a clear description of what changed and why.

---

## License

MIT — see [LICENSE](LICENSE) for details.
