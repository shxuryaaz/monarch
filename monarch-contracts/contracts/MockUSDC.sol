// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing on Sepolia testnet
 *
 * IMPORTANT: This is ONLY for testing. Do NOT use on mainnet!
 *
 * Features:
 * - Anyone can mint for testing
 * - 6 decimals (like real USDC)
 * - Faucet function for easy testing
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private _decimals = 6; // USDC has 6 decimals

    constructor() ERC20("Mock USDC", "USDC") Ownable() {
        // Mint 1 million USDC to deployer for initial testing
        _mint(msg.sender, 1_000_000 * 10 ** _decimals);
    }

    /**
     * @dev Override decimals to match USDC (6 decimals)
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Faucet: Anyone can mint 10,000 USDC for testing
     */
    function faucet() public {
        _mint(msg.sender, 10_000 * 10 ** _decimals);
    }

    /**
     * @dev Mint tokens (owner only)
     * @param to Recipient address
     * @param amount Amount to mint (in USDC units, will be scaled by decimals)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount * 10 ** _decimals);
    }
}
