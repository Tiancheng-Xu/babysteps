// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ITransferableGrowthStars} from "./interfaces/ITransferableGrowthStars.sol";
import {StarBuddyKeepsakeSBT} from "./StarBuddyKeepsakeSBT.sol";
import {IVRFCoordinatorV2Plus} from "./vrf/IVRFCoordinatorV2Plus.sol";
import {VRFConsumerBaseV2Plus} from "./vrf/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "./vrf/VRFV2PlusClient.sol";

contract StarBuddyKeepsakes is ReentrancyGuard, VRFConsumerBaseV2Plus {
    uint256 public constant DRAW_COST = 12;
    uint256 public constant RECOVERY_DELAY = 1 days;

    enum RequestKind {
        None,
        Draw,
        Fusion
    }

    enum RequestStatus {
        None,
        Pending,
        Succeeded,
        Failed,
        Recovered
    }

    struct Request {
        address owner;
        RequestKind kind;
        RequestStatus status;
        uint64 requestedAt;
        uint256[3] tokenIds;
        uint256 resultTokenId;
        uint256 burnedTokenId;
    }

    ITransferableGrowthStars public immutable growthStars;
    StarBuddyKeepsakeSBT public immutable keepsakeToken;
    IVRFCoordinatorV2Plus private immutable coordinator;
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;
    uint16 public immutable requestConfirmations;
    uint32 public immutable callbackGasLimit;

    mapping(uint256 requestId => Request request) private requests;
    mapping(address owner => uint256 requestId) public latestRequestIdByOwner;
    mapping(uint256 tokenId => bool lockedForFusion) public isTokenLocked;

    error UnknownKeepsakeRequest(uint256 requestId);
    error KeepsakeNotOwned(
        uint256 tokenId,
        address expectedOwner,
        address actualOwner
    );
    error DuplicateKeepsake(uint256 tokenId);
    error KeepsakeAlreadyLocked(uint256 tokenId);
    error KeepsakeTraitsMismatch(uint256 tokenId);
    error CollectorCannotFuse();
    error RequestOwnerMismatch(
        uint256 requestId,
        address expectedOwner,
        address caller
    );
    error RequestNotPending(uint256 requestId, RequestStatus status);
    error RecoveryNotReady(uint256 requestId, uint256 recoverableAt);
    error InvalidRandomWords(uint256 actualLength);

    event DrawRequested(
        uint256 indexed requestId,
        address indexed owner,
        uint256 starCost
    );
    event FusionRequested(
        uint256 indexed requestId,
        address indexed owner,
        uint256 tokenIdOne,
        uint256 tokenIdTwo,
        uint256 tokenIdThree
    );
    event DrawSettled(
        uint256 indexed requestId,
        address indexed owner,
        uint256 indexed tokenId,
        uint8 series,
        uint8 rarity
    );
    event FusionSettled(
        uint256 indexed requestId,
        address indexed owner,
        bool succeeded,
        uint256 resultTokenId,
        uint256 burnedTokenId
    );
    event RequestRecovered(
        uint256 indexed requestId,
        address indexed owner,
        RequestKind kind
    );

    constructor(
        address growthStarsAddress,
        address keepsakeTokenAddress,
        address coordinatorAddress,
        uint256 vrfSubscriptionId,
        bytes32 vrfKeyHash,
        uint16 vrfRequestConfirmations,
        uint32 vrfCallbackGasLimit
    ) VRFConsumerBaseV2Plus(coordinatorAddress) {
        growthStars = ITransferableGrowthStars(growthStarsAddress);
        keepsakeToken = StarBuddyKeepsakeSBT(keepsakeTokenAddress);
        coordinator = IVRFCoordinatorV2Plus(coordinatorAddress);
        subscriptionId = vrfSubscriptionId;
        keyHash = vrfKeyHash;
        requestConfirmations = vrfRequestConfirmations;
        callbackGasLimit = vrfCallbackGasLimit;
    }

    function requestDraw() external nonReentrant returns (uint256 requestId) {
        growthStars.spendTransferableBalance(msg.sender, DRAW_COST);
        requestId = requestRandomness();

        requests[requestId] = Request({
            owner: msg.sender,
            kind: RequestKind.Draw,
            status: RequestStatus.Pending,
            requestedAt: uint64(block.timestamp),
            tokenIds: [uint256(0), uint256(0), uint256(0)],
            resultTokenId: 0,
            burnedTokenId: 0
        });
        latestRequestIdByOwner[msg.sender] = requestId;
        emit DrawRequested(requestId, msg.sender, DRAW_COST);
    }

    function requestFusion(
        uint256[3] calldata tokenIds
    ) external nonReentrant returns (uint256 requestId) {
        if (tokenIds[0] == tokenIds[1]) {
            revert DuplicateKeepsake(tokenIds[0]);
        }
        if (tokenIds[0] == tokenIds[2]) {
            revert DuplicateKeepsake(tokenIds[0]);
        }
        if (tokenIds[1] == tokenIds[2]) {
            revert DuplicateKeepsake(tokenIds[1]);
        }

        (uint8 expectedSeries, uint8 expectedRarity) = keepsakeToken
            .getKeepsake(tokenIds[0]);
        for (uint256 index = 0; index < tokenIds.length; index++) {
            uint256 tokenId = tokenIds[index];
            address actualOwner = keepsakeToken.ownerOf(tokenId);
            if (actualOwner != msg.sender) {
                revert KeepsakeNotOwned(tokenId, msg.sender, actualOwner);
            }
            if (isTokenLocked[tokenId]) {
                revert KeepsakeAlreadyLocked(tokenId);
            }
            (uint8 series, uint8 rarity) = keepsakeToken.getKeepsake(tokenId);
            if (series != expectedSeries || rarity != expectedRarity) {
                revert KeepsakeTraitsMismatch(tokenId);
            }
        }
        if (expectedRarity == 3) revert CollectorCannotFuse();

        for (uint256 index = 0; index < tokenIds.length; index++) {
            isTokenLocked[tokenIds[index]] = true;
        }
        requestId = requestRandomness();
        requests[requestId] = Request({
            owner: msg.sender,
            kind: RequestKind.Fusion,
            status: RequestStatus.Pending,
            requestedAt: uint64(block.timestamp),
            tokenIds: tokenIds,
            resultTokenId: 0,
            burnedTokenId: 0
        });
        latestRequestIdByOwner[msg.sender] = requestId;
        emit FusionRequested(
            requestId,
            msg.sender,
            tokenIds[0],
            tokenIds[1],
            tokenIds[2]
        );
    }

    function recover(uint256 requestId) external nonReentrant {
        Request storage request = requestFor(requestId);
        if (request.owner != msg.sender) {
            revert RequestOwnerMismatch(requestId, request.owner, msg.sender);
        }
        if (request.status != RequestStatus.Pending) {
            revert RequestNotPending(requestId, request.status);
        }
        uint256 recoverableAt = uint256(request.requestedAt) + RECOVERY_DELAY;
        if (block.timestamp < recoverableAt) {
            revert RecoveryNotReady(requestId, recoverableAt);
        }

        request.status = RequestStatus.Recovered;
        if (request.kind == RequestKind.Draw) {
            growthStars.refundTransferableBalance(request.owner, DRAW_COST);
        } else {
            unlockTokens(request.tokenIds);
        }
        emit RequestRecovered(requestId, request.owner, request.kind);
    }

    function getRequest(
        uint256 requestId
    ) external view returns (Request memory) {
        return requestFor(requestId);
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        Request storage request = requests[requestId];
        if (request.status != RequestStatus.Pending) return;
        if (randomWords.length < 2) {
            revert InvalidRandomWords(randomWords.length);
        }

        if (request.kind == RequestKind.Draw) {
            settleDraw(requestId, request, randomWords);
        } else {
            settleFusion(requestId, request, randomWords);
        }
    }

    function requestRandomness() private returns (uint256) {
        return
            coordinator.requestRandomWords(
                VRFV2PlusClient.RandomWordsRequest({
                    keyHash: keyHash,
                    subId: subscriptionId,
                    requestConfirmations: requestConfirmations,
                    callbackGasLimit: callbackGasLimit,
                    numWords: 2,
                    extraArgs: VRFV2PlusClient.argsToBytes(
                        VRFV2PlusClient.ExtraArgsV1({nativePayment: true})
                    )
                })
            );
    }

    function settleDraw(
        uint256 requestId,
        Request storage request,
        uint256[] calldata randomWords
    ) private {
        uint8 series = uint8(randomWords[0] % 4);
        uint8 rarity = drawRarity(randomWords[1]);
        request.status = RequestStatus.Succeeded;
        uint256 tokenId = keepsakeToken.mint(request.owner, series, rarity);
        request.resultTokenId = tokenId;
        emit DrawSettled(requestId, request.owner, tokenId, series, rarity);
    }

    function settleFusion(
        uint256 requestId,
        Request storage request,
        uint256[] calldata randomWords
    ) private {
        (uint8 series, uint8 rarity) = keepsakeToken.getKeepsake(
            request.tokenIds[0]
        );
        bool succeeded = fusionSucceeded(rarity, randomWords[0]);
        unlockTokens(request.tokenIds);

        if (succeeded) {
            request.status = RequestStatus.Succeeded;
            for (uint256 index = 0; index < request.tokenIds.length; index++) {
                keepsakeToken.burnFrom(request.owner, request.tokenIds[index]);
            }
            uint256 resultTokenId = keepsakeToken.mint(
                request.owner,
                series,
                rarity + 1
            );
            request.resultTokenId = resultTokenId;
            emit FusionSettled(
                requestId,
                request.owner,
                true,
                resultTokenId,
                0
            );
            return;
        }

        request.status = RequestStatus.Failed;
        uint256 burnedTokenId = request.tokenIds[randomWords[1] % 3];
        request.burnedTokenId = burnedTokenId;
        keepsakeToken.burnFrom(request.owner, burnedTokenId);
        emit FusionSettled(
            requestId,
            request.owner,
            false,
            0,
            burnedTokenId
        );
    }

    function drawRarity(uint256 randomWord) private pure returns (uint8) {
        uint256 roll = randomWord % 10_000;
        if (roll < 7_000) return 0;
        if (roll < 9_200) return 1;
        if (roll < 9_900) return 2;
        return 3;
    }

    function fusionSucceeded(
        uint8 rarity,
        uint256 randomWord
    ) private pure returns (bool) {
        if (rarity == 0) return true;
        uint256 roll = randomWord % 10_000;
        if (rarity == 1) return roll < 7_000;
        return roll < 4_000;
    }

    function unlockTokens(uint256[3] memory tokenIds) private {
        for (uint256 index = 0; index < tokenIds.length; index++) {
            isTokenLocked[tokenIds[index]] = false;
        }
    }

    function requestFor(
        uint256 requestId
    ) private view returns (Request storage request) {
        request = requests[requestId];
        if (request.kind == RequestKind.None) {
            revert UnknownKeepsakeRequest(requestId);
        }
    }
}
