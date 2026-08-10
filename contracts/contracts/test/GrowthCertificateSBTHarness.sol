// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {GrowthCertificateSBT} from "../GrowthCertificateSBT.sol";

contract GrowthCertificateSBTHarness is GrowthCertificateSBT {
    constructor(address admin) GrowthCertificateSBT(admin) {}

    function burnForTest(uint256 tokenId) external {
        _burn(tokenId);
    }
}
