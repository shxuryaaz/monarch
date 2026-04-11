// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AssetToken.sol";

/**
 * @title PayoutDistributor
 * @dev Distributes yield/profits to asset token holders
 *
 * How it works:
 * 1. Admin deposits USDC for yield distribution
 * 2. System creates a snapshot of token holders
 * 3. Users claim their proportional share based on their token balance
 *
 * Example: If you own 100 out of 10,000 tokens (1%), you get 1% of the yield
 */
contract PayoutDistributor is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // USDC token address (will be set in constructor for Sepolia testnet)
    IERC20 public usdcToken;

    // Distribution tracking
    struct Distribution {
        uint256 snapshotId;         // Snapshot of token balances
        uint256 totalAmount;        // Total USDC being distributed
        uint256 amountPerToken;     // USDC per token (scaled by 1e18)
        uint256 timestamp;          // When distribution was created
        bool finalized;             // Whether distribution is complete
    }

    // Storage
    mapping(address => Distribution[]) public distributions;        // assetToken => distributions
    mapping(address => mapping(address => uint256)) public claimed; // assetToken => user => lastClaimedIndex

    // Events
    event YieldDistributed(
        address indexed assetToken,
        uint256 totalAmount,
        uint256 snapshotId,
        uint256 distributionIndex
    );
    event YieldClaimed(
        address indexed user,
        address indexed assetToken,
        uint256 amount,
        uint256 distributionIndex
    );

    /**
     * @dev Constructor
     * @param usdcAddress Address of USDC token on Sepolia
     */
    constructor(address usdcAddress) {
        require(usdcAddress != address(0), "Invalid USDC address");
        usdcToken = IERC20(usdcAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Distribute yield to token holders
     * @param assetToken Address of the AssetToken contract
     * @param totalAmount Total USDC to distribute
     */
    function distributeYield(address assetToken, uint256 totalAmount)
        public
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        require(assetToken != address(0), "Invalid asset token");
        require(totalAmount > 0, "Amount must be positive");

        AssetToken token = AssetToken(assetToken);

        // Transfer USDC from sender to this contract
        require(
            usdcToken.transferFrom(msg.sender, address(this), totalAmount),
            "USDC transfer failed"
        );

        // Create snapshot of current token holders
        uint256 snapshotId = token.snapshot();
        uint256 totalSupply = token.totalSupply();

        require(totalSupply > 0, "No tokens minted");

        // Calculate amount per token (scaled by 1e18 for precision)
        uint256 amountPerToken = (totalAmount * 1e18) / totalSupply;

        // Create distribution record
        Distribution memory newDistribution = Distribution({
            snapshotId: snapshotId,
            totalAmount: totalAmount,
            amountPerToken: amountPerToken,
            timestamp: block.timestamp,
            finalized: false
        });

        distributions[assetToken].push(newDistribution);
        uint256 distributionIndex = distributions[assetToken].length - 1;

        emit YieldDistributed(assetToken, totalAmount, snapshotId, distributionIndex);
    }

    /**
     * @dev Claim all pending yields for a specific asset
     * @param assetToken Address of the AssetToken
     */
    function claimYield(address assetToken) public nonReentrant {
        uint256 claimableAmount = getClaimableYield(assetToken, msg.sender);
        require(claimableAmount > 0, "No yield to claim");

        // Update claimed index
        claimed[assetToken][msg.sender] = distributions[assetToken].length;

        // Transfer USDC to user
        require(
            usdcToken.transfer(msg.sender, claimableAmount),
            "USDC transfer failed"
        );

        emit YieldClaimed(msg.sender, assetToken, claimableAmount, distributions[assetToken].length - 1);
    }

    /**
     * @dev Get claimable yield for a user
     * @param assetToken Address of the AssetToken
     * @param user User address
     * @return Total claimable amount in USDC
     */
    function getClaimableYield(address assetToken, address user)
        public
        view
        returns (uint256)
    {
        AssetToken token = AssetToken(assetToken);
        uint256 lastClaimed = claimed[assetToken][user];
        uint256 totalClaimable = 0;

        Distribution[] storage assetDistributions = distributions[assetToken];

        // Loop through all unclaimed distributions
        for (uint256 i = lastClaimed; i < assetDistributions.length; i++) {
            Distribution storage dist = assetDistributions[i];

            // Get user's balance at the snapshot
            uint256 userBalance = token.balanceOfAt(user, dist.snapshotId);

            if (userBalance > 0) {
                // Calculate user's share: (userBalance * amountPerToken) / 1e18
                uint256 userShare = (userBalance * dist.amountPerToken) / 1e18;
                totalClaimable += userShare;
            }
        }

        return totalClaimable;
    }

    /**
     * @dev Get number of distributions for an asset
     * @param assetToken Address of the AssetToken
     * @return Number of distributions
     */
    function getDistributionCount(address assetToken) public view returns (uint256) {
        return distributions[assetToken].length;
    }

    /**
     * @dev Get distribution details
     * @param assetToken Address of the AssetToken
     * @param index Distribution index
     * @return Distribution struct
     */
    function getDistribution(address assetToken, uint256 index)
        public
        view
        returns (Distribution memory)
    {
        require(index < distributions[assetToken].length, "Invalid index");
        return distributions[assetToken][index];
    }

    /**
     * @dev Emergency withdraw (admin only - for recovering stuck funds)
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount)
        public
        onlyRole(ADMIN_ROLE)
    {
        IERC20(token).transfer(msg.sender, amount);
    }
}
