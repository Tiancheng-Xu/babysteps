// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockTransferableGrowthStars {
    mapping(address account => uint256 balance) public balances;

    function setBalance(address account, uint256 amount) external {
        balances[account] = amount;
    }

    function spendTransferableBalance(address account, uint256 amount) external {
        require(balances[account] >= amount, "insufficient stars");
        balances[account] -= amount;
    }

    function refundTransferableBalance(address account, uint256 amount) external {
        balances[account] += amount;
    }

    function getTransferableBalance(address account) external view returns (uint256) {
        return balances[account];
    }
}
