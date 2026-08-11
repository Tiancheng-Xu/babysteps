// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.28;

interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}
