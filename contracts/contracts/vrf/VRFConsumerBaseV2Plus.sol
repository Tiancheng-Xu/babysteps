// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Minimal coordinator-authentication behavior from Chainlink Contracts 1.5.0.
abstract contract VRFConsumerBaseV2Plus {
    error OnlyCoordinatorCanFulfill(address have, address want);
    error InvalidCoordinator(address coordinator);

    address public immutable vrfCoordinator;

    constructor(address coordinator) {
        if (coordinator == address(0)) {
            revert InvalidCoordinator(coordinator);
        }
        vrfCoordinator = coordinator;
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal virtual;

    function rawFulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) external {
        if (msg.sender != vrfCoordinator) {
            revert OnlyCoordinatorCanFulfill(msg.sender, vrfCoordinator);
        }
        fulfillRandomWords(requestId, randomWords);
    }
}
