# Monarch platform — engineering vs legal scope

This repository implements **demo / pilot** software for fractional RWA-style tokens on testnet.

It does **not** by itself provide:

- Legal SPVs, offering memoranda, or regulated securities compliance
- Bank-grade escrow of fiat or USDC tied to milestone inspection
- KYC/AML of asset owners (unless `KYC_MODE=strict` and a real provider is integrated)
- Third-party custody of physical assets or title insurance
- Multi-party Gnosis Safe operations (unless `TREASURY_SAFE_ADDRESS` is configured and signers coordinate off-app)

Features such as **MilestoneEscrow** and transparency APIs are **building blocks**; production use requires counsel, ops runbooks, audited contracts, and aligned off-chain processes.
