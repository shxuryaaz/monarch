# Monarch Smart Contracts

Smart contracts for tokenizing real-world assets (RWA) on Ethereum Sepolia testnet.

## 📋 Contracts

1. **AssetToken.sol** - ERC-20 token representing fractional asset ownership
2. **AssetRegistry.sol** - Central registry tracking all tokenized assets
3. **PayoutDistributor.sol** - Automated yield distribution to token holders
4. **MockUSDC.sol** - Test USDC for Sepolia testnet

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required values:
- `SEPOLIA_RPC_URL`: Get from [Alchemy](https://www.alchemy.com) (free)
- `DEPLOYER_PRIVATE_KEY`: Your MetaMask private key (testnet wallet only!)
- `ETHERSCAN_API_KEY`: Get from [Etherscan](https://etherscan.io/myapikey) (optional, for verification)

### 3. Get Testnet ETH
Visit [Sepolia Faucet](https://sepoliafaucet.com) and get ~0.5 ETH for gas fees.

### 4. Compile Contracts
```bash
npx hardhat compile
```

### 5. Deploy to Sepolia
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

This will:
- Deploy all 4 contracts
- Create a demo asset (Austin Residential Complex)
- Mint 1000 demo tokens to your address
- Save addresses to `deployed-addresses.json`

### 6. Verify Contracts on Etherscan (Optional)
```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## 📝 How It Works

### For Users:
1. **Buy Tokens**: Purchase fractional shares of real-world assets
2. **Earn Yield**: Automatically receive profits (rent, harvest sales)
3. **Trade**: Transfer tokens to other users

### For Admins:
1. **Tokenize Assets**: Deploy new AssetToken for each property/farm
2. **Register**: Add to AssetRegistry
3. **Distribute Yield**: Send profits via PayoutDistributor

## 🧪 Testing

Get test USDC by calling the faucet:
```bash
# In Hardhat console
npx hardhat console --network sepolia

const usdc = await ethers.getContractAt("MockUSDC", "USDC_ADDRESS");
await usdc.faucet(); // Get 10,000 USDC
```

## 📚 Contract Addresses

After deployment, addresses will be saved to `deployed-addresses.json`.

## 🔒 Security Notes

- **Testnet Only**: These contracts are for Sepolia testnet only
- **Never** use mainnet private keys
- MockUSDC is for testing only - not real USDC
- Get security audit before mainnet deployment

## 🆘 Troubleshooting

### "Insufficient funds"
- Make sure you have Sepolia ETH from faucet

### "Invalid nonce"
- Reset your MetaMask account: Settings → Advanced → Reset Account

### "Cannot find module"
- Run `npm install` again

## 📞 Support

- Check logs in terminal
- View transactions on [Sepolia Etherscan](https://sepolia.etherscan.io)
- Ensure MetaMask is set to Sepolia network
