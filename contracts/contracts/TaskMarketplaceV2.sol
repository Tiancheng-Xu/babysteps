// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
    using SafeERC20 for IERC20;

    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    bytes32 public constant COMPLETION_RELAYER_ROLE =
        keccak256("COMPLETION_RELAYER_ROLE");

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

    struct Purchase {
        address buyer;
        uint256 taskId;
        uint256 price;
        uint64 purchasedAt;
        bool completed;
        bytes32 evidenceHash;
        uint256 certificateTokenId;
    }

    BabyCoin public immutable babyCoin;
    GrowthCertificateSBT public immutable certificate;
    IVRFCoordinatorV2Plus private immutable coordinator;
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;
    uint16 public immutable requestConfirmations;
    uint32 public immutable callbackGasLimit;

    uint256 public nextTaskId = 1;
    uint256 public nextPurchaseId = 1;
    mapping(uint256 taskId => Task task) private tasks;
    mapping(uint256 requestId => uint256 taskId) public requestToTaskId;
    mapping(uint256 purchaseId => Purchase purchase) private purchases;
    mapping(uint256 taskId => mapping(address buyer => uint256 purchaseId))
        public purchaseIdForBuyer;

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
    error TaskIsPaused(uint256 taskId);
    error TaskExpired(uint256 taskId, uint256 closesAt);
    error TaskAlreadyPurchased(
        uint256 taskId,
        address buyer,
        uint256 purchaseId
    );
    error UnknownPurchase(uint256 purchaseId);
    error CompletionConflict(uint256 purchaseId);

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
    event PurchaseCreated(
        uint256 indexed purchaseId,
        uint256 indexed taskId,
        address indexed buyer,
        uint256 price,
        uint256 purchasedAt
    );
    event CompletionConfirmed(
        uint256 indexed purchaseId,
        uint256 indexed taskId,
        address indexed buyer,
        bytes32 evidenceHash
    );
    event CertificateMinted(
        uint256 indexed purchaseId,
        uint256 indexed tokenId,
        address indexed recipient
    );

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

    function buy(
        uint256 taskId
    ) external nonReentrant returns (uint256 purchaseId) {
        Task storage task = taskFor(taskId);
        requireStatus(taskId, task, TaskStatus.Active);
        if (task.paused) revert TaskIsPaused(taskId);
        if (block.timestamp >= task.closesAt) {
            revert TaskExpired(taskId, task.closesAt);
        }

        uint256 existingPurchaseId = purchaseIdForBuyer[taskId][msg.sender];
        if (existingPurchaseId != 0) {
            revert TaskAlreadyPurchased(
                taskId,
                msg.sender,
                existingPurchaseId
            );
        }

        purchaseId = nextPurchaseId++;
        purchaseIdForBuyer[taskId][msg.sender] = purchaseId;
        purchases[purchaseId] = Purchase({
            buyer: msg.sender,
            taskId: taskId,
            price: task.price,
            purchasedAt: uint64(block.timestamp),
            completed: false,
            evidenceHash: bytes32(0),
            certificateTokenId: 0
        });

        IERC20(address(babyCoin)).safeTransferFrom(
            msg.sender,
            task.payee,
            task.price
        );
        emit PurchaseCreated(
            purchaseId,
            taskId,
            msg.sender,
            task.price,
            block.timestamp
        );
    }

    function confirmCompletion(
        uint256 purchaseId,
        bytes32 evidenceHash,
        string calldata certificateUri
    )
        external
        onlyRole(COMPLETION_RELAYER_ROLE)
        nonReentrant
        returns (uint256 certificateTokenId)
    {
        Purchase storage purchase = purchaseFor(purchaseId);
        if (purchase.completed) {
            if (purchase.evidenceHash != evidenceHash) {
                revert CompletionConflict(purchaseId);
            }
            return
                certificate.mintForPurchase(
                    purchase.buyer,
                    purchaseId,
                    certificateUri
                );
        }

        purchase.completed = true;
        purchase.evidenceHash = evidenceHash;
        certificateTokenId = certificate.mintForPurchase(
            purchase.buyer,
            purchaseId,
            certificateUri
        );
        purchase.certificateTokenId = certificateTokenId;

        emit CompletionConfirmed(
            purchaseId,
            purchase.taskId,
            purchase.buyer,
            evidenceHash
        );
        emit CertificateMinted(
            purchaseId,
            certificateTokenId,
            purchase.buyer
        );
    }

    function getPurchase(
        uint256 purchaseId
    ) external view returns (Purchase memory) {
        return purchaseFor(purchaseId);
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

    function purchaseFor(
        uint256 purchaseId
    ) private view returns (Purchase storage purchase) {
        purchase = purchases[purchaseId];
        if (purchase.buyer == address(0)) {
            revert UnknownPurchase(purchaseId);
        }
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
