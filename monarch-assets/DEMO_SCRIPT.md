# Monarch demo script (aligns with deck + live app)

Use this while presenting. **Actual stack:** React (Vite), Wagmi/Viem, Express + TypeScript API, Prisma/SQLite, SIWE—not Next.js unless you migrate.

## Slide flow → what you do in the app

1. **Problem / illiquid RWA** — Explain fractional ownership and why data + legal + execution layers matter.
2. **Legal / Oracle / Token** — **Legal:** SPV framing (narrative). **Oracle:** Say the backend runs a demo worker that nudges `oraclePriceUsd` on a timer; **open Marketplace or Dashboard and wait ~15–30s** (or refresh) so the audience sees prices and portfolio value move. **Token:** USDC-style purchase intent + mint path you implemented on-chain.
3. **Tech stack slide** — Say **React + Vite**, **Wagmi**, **Express API**, **Prisma**, **ethers**; mention Chainlink/IoT as the production direction, not necessarily wired in this MVP.
4. **User flow (Onboard → Invest → Monitor → Earn)**  
   - **Onboard:** Connect wallet → one-step sign-in (SIWE).  
   - **Invest:** **Marketplace** → pick an asset (e.g. Bengaluru / Nashik / Mumbai demo names) → **Buy $100**.  
   - **Monitor:** **Dashboard** — holdings table, totals, live sparkline sampling on each refetch; call out **unrealized P&amp;L** changing as oracle marks move.  
   - **Earn:** Yield % on assets = product story; payouts = roadmap unless fully automated in-app.
5. **Feasibility** — Point to modular API (`/assets`, `/portfolio`, `/purchases`, workers) and incremental path to real oracles.

## One-line pitch

“We sign in with a wallet, buy fractional exposure through the API-backed flow, and the **oracle** keeps **marks** moving so the **dashboard and marketplace stay visually alive** in the demo.”

## Cues

- **Before demo:** Run `monarch-api` (`npm run dev`) and `monarch-assets` (`npm run dev`); ensure DB is seeded if you reset (Indian demo assets in seed).
- **During demo:** After a purchase, open **Dashboard** and mention **Purchase activity** lists real `PurchaseIntent` rows from `GET /purchases/me`.
