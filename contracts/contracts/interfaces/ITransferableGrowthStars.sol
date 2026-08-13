// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITransferableGrowthStars {
    function spendTransferableBalance(address account, uint256 amount) external;

    function refundTransferableBalance(address account, uint256 amount) external;

    function getTransferableBalance(address account) external view returns (uint256);
}
