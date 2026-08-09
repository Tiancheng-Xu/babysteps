// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BabyCoin is ERC20, AccessControl {
    bytes32 public constant REWARD_ROLE = keccak256("REWARD_ROLE");

    mapping(address account => uint256 amount) public lifetimeEarned;

    constructor(address admin) ERC20("BabyCoin", "BABY") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mintTest(address account, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _mint(account, amount);
    }

    function reward(address account, uint256 amount)
        external
        onlyRole(REWARD_ROLE)
    {
        lifetimeEarned[account] += amount;
        _mint(account, amount);
    }

    function growthStageOf(address account) external view returns (uint8) {
        uint256 earned = lifetimeEarned[account];
        if (earned >= 15 ether) return 3;
        if (earned >= 8 ether) return 2;
        if (earned >= 3 ether) return 1;
        return 0;
    }
}
