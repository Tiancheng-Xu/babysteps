// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {VRFV2PlusClient} from "./VRFV2PlusClient.sol";

// Minimal request interface implemented by Chainlink VRF v2.5 coordinators.
interface IVRFCoordinatorV2Plus {
    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata request
    ) external returns (uint256 requestId);
}
