// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";

/**
 * @title AssetToken
 * @dev ERC-20 token representing fractional ownership of a real-world asset
 *
 * Features:
 * - Fractional ownership (1 token = 1 fractional share of the asset)
 * - Pausable transfers (emergency stop)
 * - Snapshot support for yield distribution
 * - Role-based access control (admin, minter)
 *
 * Example: A $1M property divided into 20,000 tokens at $50 each
 */
contract AssetToken is ERC20, ERC20Pausable, AccessControl, ERC20Snapshot {
    // Roles for access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");

    // Asset metadata
    string public assetId;              // Unique identifier (e.g., "austin-residential-01")
    string public assetType;            // "REAL_ESTATE" or "AGRICULTURE"
    string public location;             // Asset location (e.g., "Austin, Texas")
    uint256 public totalAssetValue;     // Total value in USD (scaled by 1e18)
    uint256 public tokenPriceUSD;       // Price per token in USD (scaled by 1e18)

    // Events
    event AssetMetadataUpdated(string assetId, uint256 totalValue, uint256 tokenPrice);
    event TokensMinted(address indexed to, uint256 amount);
    event YieldDistributed(uint256 totalAmount, uint256 snapshotId);

    /**
     * @dev Constructor to initialize the asset token
     * @param name_ Token name (e.g., "Austin Residential Complex Token")
     * @param symbol_ Token symbol (e.g., "ARC")
     * @param assetId_ Unique asset identifier
     * @param assetType_ Type of asset
     * @param location_ Asset location
     * @param totalValue Total asset value in USD (wei format)
     * @param tokenPrice Price per token in USD (wei format)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory assetId_,
        string memory assetType_,
        string memory location_,
        uint256 totalValue,
        uint256 tokenPrice
    ) ERC20(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(SNAPSHOT_ROLE, msg.sender);

        assetId = assetId_;
        assetType = assetType_;
        location = location_;
        totalAssetValue = totalValue;
        tokenPriceUSD = tokenPrice;
    }

    /**
     * @dev Mint new tokens (only by minter role)
     * @param to Address to receive tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @dev Create a snapshot for yield distribution
     * @return Snapshot ID
     */
    function snapshot() public onlyRole(SNAPSHOT_ROLE) returns (uint256) {
        return _snapshot();
    }

    /**
     * @dev Pause all token transfers (emergency stop)
     */
    function pause() public onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() public onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Update asset metadata
     * @param newTotalValue New total asset value
     * @param newTokenPrice New price per token
     */
    function updateAssetMetadata(
        uint256 newTotalValue,
        uint256 newTokenPrice
    ) public onlyRole(ADMIN_ROLE) {
        totalAssetValue = newTotalValue;
        tokenPriceUSD = newTokenPrice;
        emit AssetMetadataUpdated(assetId, newTotalValue, newTokenPrice);
    }

    /**
     * @dev Get asset information
     * @return assetId_, assetType_, location_, totalAssetValue, tokenPriceUSD
     */
    function getAssetInfo() public view returns (
        string memory,
        string memory,
        string memory,
        uint256,
        uint256
    ) {
        return (assetId, assetType, location, totalAssetValue, tokenPriceUSD);
    }

    // Required overrides for multiple inheritance
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Pausable, ERC20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
