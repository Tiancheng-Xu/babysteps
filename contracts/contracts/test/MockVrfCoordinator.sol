// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IVRFCoordinatorV2Plus} from "../vrf/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "../vrf/VRFV2PlusClient.sol";

interface IVrfConsumer {
    function rawFulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) external;
}

contract MockVrfCoordinator is IVRFCoordinatorV2Plus {
    uint256 public latestRequestId;
    bool public latestNativePayment;
    mapping(uint256 requestId => address consumer) public requestConsumer;

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata request
    ) external returns (uint256 requestId) {
        latestNativePayment = abi.decode(request.extraArgs[4:], (bool));
        requestId = ++latestRequestId;
        requestConsumer[requestId] = msg.sender;
    }

    function fulfill(
        uint256 requestId,
        uint256[] calldata randomWords
    ) external {
        IVrfConsumer(requestConsumer[requestId]).rawFulfillRandomWords(
            requestId,
            randomWords
        );
    }
}
