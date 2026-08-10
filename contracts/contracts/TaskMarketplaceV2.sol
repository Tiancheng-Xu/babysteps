// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BabyCoin} from "./BabyCoin.sol";
import {GrowthCertificateSBT} from "./GrowthCertificateSBT.sol";
import {IVRFCoordinatorV2Plus} from "./vrf/IVRFCoordinatorV2Plus.sol";
import {VRFConsumerBaseV2Plus} from "./vrf/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "./vrf/VRFV2PlusClient.sol";

contract TaskMarketplaceV2 is
    AccessControl,
    ReentrancyGuard,
    VRFConsumerBaseV2Plus
{
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");

    enum ActivityType {
        Meal,
        Walk,
        Read
    }

    enum TaskStatus {
        None,
        PendingReview,
        PendingRandomness,
        Active,
        Rejected
    }

    struct Task {
        address provider;
        address payee;
        ActivityType activityType;
        string metadataUri;
        bytes32 metadataHash;
        bytes32 rejectionReasonHash;
        uint256 requestId;
        uint256 price;
        uint64 opensAt;
        uint64 closesAt;
        TaskStatus status;
        bool paused;
    }

    BabyCoin public immutable babyCoin;
    GrowthCertificateSBT public immutable certificate;
    IVRFCoordinatorV2Plus private immutable coordinator;
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;
    uint16 public immutable requestConfirmations;
    uint32 public immutable callbackGasLimit;

    uint256 public nextTaskId = 1;
    mapping(uint256 taskId => Task task) private tasks;
    mapping(uint256 requestId => uint256 taskId) public requestToTaskId;

    error InvalidPayee(address payee);
    error InvalidMetadataUri();
    error InvalidMetadataHash(bytes32 metadataHash);
    error UnknownTask(uint256 taskId);
    error UnknownRequest(uint256 requestId);
    error InvalidTaskStatus(
        uint256 taskId,
        TaskStatus expected,
        TaskStatus actual
    );
    error InvalidRandomWords(uint256 actualLength);

    event TaskRequested(
        uint256 indexed taskId,
        address indexed provider,
        address indexed payee,
        ActivityType activityType,
        string metadataUri,
        bytes32 metadataHash
    );
    event TaskApproved(
        uint256 indexed taskId,
        uint256 indexed requestId,
        address indexed owner
    );
    event TaskRejected(
        uint256 indexed taskId,
        address indexed owner,
        bytes32 indexed reasonHash
    );
    event TaskRandomized(
        uint256 indexed taskId,
        uint256 indexed requestId,
        uint256 price,
        uint256 opensAt,
        uint256 closesAt
    );
    event TaskPauseChanged(uint256 indexed taskId, bool paused);

    constructor(
        address admin,
        address babyCoinAddress,
        address certificateAddress,
        address coordinatorAddress,
        uint256 vrfSubscriptionId,
        bytes32 vrfKeyHash,
        uint16 vrfRequestConfirmations,
        uint32 vrfCallbackGasLimit
    ) VRFConsumerBaseV2Plus(coordinatorAddress) {
        babyCoin = BabyCoin(babyCoinAddress);
        certificate = GrowthCertificateSBT(certificateAddress);
        coordinator = IVRFCoordinatorV2Plus(coordinatorAddress);
        subscriptionId = vrfSubscriptionId;
        keyHash = vrfKeyHash;
        requestConfirmations = vrfRequestConfirmations;
        callbackGasLimit = vrfCallbackGasLimit;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function requestTask(
        address payee,
        ActivityType activityType,
        string calldata metadataUri,
        bytes32 metadataHash
    ) external onlyRole(PROVIDER_ROLE) returns (uint256 taskId) {
        if (payee == address(0)) revert InvalidPayee(payee);
        if (bytes(metadataUri).length == 0) revert InvalidMetadataUri();
        if (metadataHash == bytes32(0)) {
            revert InvalidMetadataHash(metadataHash);
        }

        taskId = nextTaskId++;
        tasks[taskId] = Task({
            provider: msg.sender,
            payee: payee,
            activityType: activityType,
            metadataUri: metadataUri,
            metadataHash: metadataHash,
            rejectionReasonHash: bytes32(0),
            requestId: 0,
            price: 0,
            opensAt: 0,
            closesAt: 0,
            status: TaskStatus.PendingReview,
            paused: false
        });

        emit TaskRequested(
            taskId,
            msg.sender,
            payee,
            activityType,
            metadataUri,
            metadataHash
        );
    }

    function approveTask(
        uint256 taskId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        Task storage task = taskFor(taskId);
        requireStatus(taskId, task, TaskStatus.PendingReview);
        task.status = TaskStatus.PendingRandomness;

        uint256 requestId = coordinator.requestRandomWords(
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
        task.requestId = requestId;
        requestToTaskId[requestId] = taskId;

        emit TaskApproved(taskId, requestId, msg.sender);
    }

    function rejectTask(
        uint256 taskId,
        bytes32 reasonHash
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Task storage task = taskFor(taskId);
        requireStatus(taskId, task, TaskStatus.PendingReview);
        task.status = TaskStatus.Rejected;
        task.rejectionReasonHash = reasonHash;
        emit TaskRejected(taskId, msg.sender, reasonHash);
    }

    function setTaskPaused(
        uint256 taskId,
        bool paused
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Task storage task = taskFor(taskId);
        requireStatus(taskId, task, TaskStatus.Active);
        task.paused = paused;
        emit TaskPauseChanged(taskId, paused);
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        return taskFor(taskId);
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        uint256 taskId = requestToTaskId[requestId];
        if (taskId == 0) revert UnknownRequest(requestId);
        Task storage task = tasks[taskId];
        requireStatus(taskId, task, TaskStatus.PendingRandomness);
        if (randomWords.length < 2) {
            revert InvalidRandomWords(randomWords.length);
        }

        uint256 price = (2 + (randomWords[0] % 3)) * 1 ether;
        (uint256 minimumHours, uint256 spanHours) = durationRange(
            task.activityType
        );
        uint256 duration =
            (minimumHours + (randomWords[1] % (spanHours + 1))) *
            1 hours;

        task.price = price;
        task.opensAt = uint64(block.timestamp);
        task.closesAt = uint64(block.timestamp + duration);
        task.status = TaskStatus.Active;

        emit TaskRandomized(
            taskId,
            requestId,
            price,
            task.opensAt,
            task.closesAt
        );
    }

    function taskFor(uint256 taskId) private view returns (Task storage task) {
        task = tasks[taskId];
        if (task.status == TaskStatus.None) revert UnknownTask(taskId);
    }

    function requireStatus(
        uint256 taskId,
        Task storage task,
        TaskStatus expected
    ) private view {
        if (task.status != expected) {
            revert InvalidTaskStatus(taskId, expected, task.status);
        }
    }

    function durationRange(
        ActivityType activityType
    ) private pure returns (uint256 minimumHours, uint256 spanHours) {
        if (activityType == ActivityType.Meal) return (3, 1);
        if (activityType == ActivityType.Walk) return (8, 4);
        return (4, 2);
    }
}
