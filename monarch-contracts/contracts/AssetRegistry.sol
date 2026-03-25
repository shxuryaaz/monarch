// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./AssetToken.sol";

/**
 * @title AssetRegistry
 * @dev Central registry for all tokenized real-world assets
 *
 * Purpose:
 * - Register new tokenized assets
 * - Track all asset tokens deployed
 * - Provide lookup functionality
 * - Maintain asset status (active/paused/closed)
 */
contract AssetRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Asset status enum
    enum AssetStatus {
        DRAFT,          // Not yet active
        ACTIVE,         // Trading enabled
        PAUSED,         // Temporarily disabled
        CLOSED          // Permanently closed
    }

    // Asset information struct
    struct AssetInfo {
        address tokenAddress;       // Address of the AssetToken contract
        string assetId;             // Unique identifier
        string assetType;           // "REAL_ESTATE" or "AGRICULTURE"
        string name;                // Asset name
        AssetStatus status;         // Current status
        uint256 registeredAt;       // Timestamp of registration
    }

    // Storage
    mapping(string => AssetInfo) private assetsById;          // assetId => AssetInfo
    mapping(address => string) private assetIdByToken;        // token address => assetId
    string[] private allAssetIds;                             // Array of all asset IDs

    // Events
    event AssetRegistered(
        string indexed assetId,
        address indexed tokenAddress,
        string assetType,
        string name
    );
    event AssetStatusUpdated(string indexed assetId, AssetStatus newStatus);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Register a new asset token
     * @param tokenAddress Address of the deployed AssetToken
     * @param assetId Unique asset identifier
     * @param assetType Type of asset ("REAL_ESTATE" or "AGRICULTURE")
     * @param name Human-readable asset name
     */
    function registerAsset(
        address tokenAddress,
        string memory assetId,
        string memory assetType,
        string memory name
    ) public onlyRole(ADMIN_ROLE) {
        require(tokenAddress != address(0), "Invalid token address");
        require(bytes(assetId).length > 0, "Asset ID required");
        require(assetsById[assetId].tokenAddress == address(0), "Asset already registered");

        AssetInfo memory newAsset = AssetInfo({
            tokenAddress: tokenAddress,
            assetId: assetId,
            assetType: assetType,
            name: name,
            status: AssetStatus.ACTIVE,
            registeredAt: block.timestamp
        });

        assetsById[assetId] = newAsset;
        assetIdByToken[tokenAddress] = assetId;
        allAssetIds.push(assetId);

        emit AssetRegistered(assetId, tokenAddress, assetType, name);
    }

    /**
     * @dev Update asset status
     * @param assetId The asset identifier
     * @param newStatus New status to set
     */
    function updateAssetStatus(string memory assetId, AssetStatus newStatus)
        public
        onlyRole(ADMIN_ROLE)
    {
        require(assetsById[assetId].tokenAddress != address(0), "Asset not found");
        assetsById[assetId].status = newStatus;
        emit AssetStatusUpdated(assetId, newStatus);
    }

    /**
     * @dev Get asset information by ID
     * @param assetId The asset identifier
     * @return AssetInfo struct
     */
    function getAssetInfo(string memory assetId) public view returns (AssetInfo memory) {
        require(assetsById[assetId].tokenAddress != address(0), "Asset not found");
        return assetsById[assetId];
    }

    /**
     * @dev Get asset token address by asset ID
     * @param assetId The asset identifier
     * @return Token contract address
     */
    function getAssetTokenAddress(string memory assetId) public view returns (address) {
        return assetsById[assetId].tokenAddress;
    }

    /**
     * @dev Get asset ID by token address
     * @param tokenAddress The token contract address
     * @return Asset ID
     */
    function getAssetIdByToken(address tokenAddress) public view returns (string memory) {
        return assetIdByToken[tokenAddress];
    }

    /**
     * @dev Get all registered asset IDs
     * @return Array of asset IDs
     */
    function getAllAssetIds() public view returns (string[] memory) {
        return allAssetIds;
    }

    /**
     * @dev Get total number of registered assets
     * @return Count of assets
     */
    function getAssetCount() public view returns (uint256) {
        return allAssetIds.length;
    }

    /**
     * @dev Get assets by type
     * @param assetType "REAL_ESTATE" or "AGRICULTURE"
     * @return Array of asset IDs matching the type
     */
    function getAssetsByType(string memory assetType) public view returns (string[] memory) {
        uint256 count = 0;

        // First, count matching assets
        for (uint256 i = 0; i < allAssetIds.length; i++) {
            if (keccak256(bytes(assetsById[allAssetIds[i]].assetType)) == keccak256(bytes(assetType))) {
                count++;
            }
        }

        // Create result array
        string[] memory result = new string[](count);
        uint256 index = 0;

        // Fill result array
        for (uint256 i = 0; i < allAssetIds.length; i++) {
            if (keccak256(bytes(assetsById[allAssetIds[i]].assetType)) == keccak256(bytes(assetType))) {
                result[index] = allAssetIds[i];
                index++;
            }
        }

        return result;
    }

    /**
     * @dev Check if an asset is registered
     * @param assetId The asset identifier
     * @return True if registered
     */
    function isAssetRegistered(string memory assetId) public view returns (bool) {
        return assetsById[assetId].tokenAddress != address(0);
    }
}
