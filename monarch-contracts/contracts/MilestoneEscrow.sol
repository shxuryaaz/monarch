// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice Minimal milestone release escrow for USDC (6 decimals expected).
 * @dev Primary subscriptions call deposit(assetToken, amount) after USDC approve.
 *      Inspector (or owner) releases tranches as % of total deposited (bps sum = 10000).
 */
contract MilestoneEscrow is Ownable {
    IERC20 public immutable usdc;
    address public inspector;

    struct Milestone {
        uint16 releaseBps;
        bool released;
        bytes32 proofHash;
    }

    mapping(address assetToken => Milestone[]) internal _milestones;
    mapping(address assetToken => address) public beneficiary;
    mapping(address assetToken => uint256) public totalDeposited;
    mapping(address assetToken => uint256) public totalReleased;

    event AssetConfigured(address indexed assetToken, address beneficiary, uint256 milestoneCount);
    event Deposited(address indexed assetToken, address indexed from, uint256 amount);
    event MilestoneReleased(address indexed assetToken, uint256 index, uint256 amount, bytes32 proofHash);

    constructor(address _usdc, address _inspector) {
        require(_usdc != address(0) && _inspector != address(0), "zero addr");
        usdc = IERC20(_usdc);
        inspector = _inspector;
    }

    function setInspector(address i) external onlyOwner {
        require(i != address(0), "zero inspector");
        inspector = i;
    }

    function milestoneCount(address assetToken) external view returns (uint256) {
        return _milestones[assetToken].length;
    }

    function getMilestone(address assetToken, uint256 index) external view returns (uint16 releaseBps, bool released, bytes32 proofHash) {
        Milestone storage m = _milestones[assetToken][index];
        return (m.releaseBps, m.released, m.proofHash);
    }

    function configureAsset(address assetToken, address _beneficiary, uint16[] calldata releaseBps) external onlyOwner {
        require(_milestones[assetToken].length == 0, "configured");
        require(_beneficiary != address(0), "zero ben");
        require(releaseBps.length > 0, "no milestones");
        uint256 sum;
        for (uint256 i = 0; i < releaseBps.length; i++) {
            require(releaseBps[i] > 0, "zero bps");
            sum += releaseBps[i];
            _milestones[assetToken].push(Milestone({ releaseBps: releaseBps[i], released: false, proofHash: bytes32(0) }));
        }
        require(sum == 10_000, "bps != 10000");
        beneficiary[assetToken] = _beneficiary;
        emit AssetConfigured(assetToken, _beneficiary, releaseBps.length);
    }

    function deposit(address assetToken, uint256 amount) external {
        require(beneficiary[assetToken] != address(0), "not configured");
        require(amount > 0, "amount");
        require(usdc.transferFrom(msg.sender, address(this), amount), "xfer");
        totalDeposited[assetToken] += amount;
        emit Deposited(assetToken, msg.sender, amount);
    }

    function releaseMilestone(address assetToken, uint256 index, bytes32 proofHash) external {
        require(msg.sender == inspector || msg.sender == owner(), "not inspector");
        Milestone[] storage ms = _milestones[assetToken];
        require(index < ms.length, "bad idx");
        require(!ms[index].released, "done");
        ms[index].released = true;
        ms[index].proofHash = proofHash;
        uint256 dep = totalDeposited[assetToken];
        uint256 amt = (dep * uint256(ms[index].releaseBps)) / 10_000;
        uint256 bal = usdc.balanceOf(address(this));
        if (amt > bal) amt = bal;
        totalReleased[assetToken] += amt;
        address b = beneficiary[assetToken];
        require(usdc.transfer(b, amt), "payout");
        emit MilestoneReleased(assetToken, index, amt, proofHash);
    }
}
