// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BabyCoin} from "./BabyCoin.sol";
import {GrowthCertificate} from "./GrowthCertificate.sol";
import {IVRFCoordinatorV2Plus} from "./vrf/IVRFCoordinatorV2Plus.sol";
import {VRFConsumerBaseV2Plus} from "./vrf/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "./vrf/VRFV2PlusClient.sol";

contract TaskMarketplace is
    AccessControl,
    ReentrancyGuard,
    VRFConsumerBaseV2Plus
{
    using SafeERC20 for IERC20;

    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    enum ActivityType {
        Meal,
        Walk,
        Read
    }

    struct Task {
        address provider;
        address payee;
        ActivityType activityType;
        string metadataUri;
        uint256 requestId;
        uint256 price;
        uint64 opensAt;
        uint64 closesAt;
        bool active;
        bool paused;
    }

    struct Purchase {
        address buyer;
        uint256 taskId;
        uint256 price;
        uint64 purchasedAt;
        bool completed;
        uint256 certificateTokenId;
    }

    BabyCoin public immutable babyCoin;
    GrowthCertificate public immutable certificate;
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
    mapping(uint256 taskId => mapping(address buyer => bool purchased))
        public hasPurchased;

    error InvalidPayee(address payee);
    error UnknownTask(uint256 taskId);
    error UnknownRequest(uint256 requestId);
    error TaskAlreadyActivated(uint256 taskId);
    error InvalidRandomWords(uint256 actualLength);
    error TaskNotActive(uint256 taskId);
    error TaskIsPaused(uint256 taskId);
    error TaskExpired(uint256 taskId, uint256 closesAt);
    error TaskAlreadyPurchased(uint256 taskId, address buyer);
    error UnknownPurchase(uint256 purchaseId);
    error PurchaseAlreadyCompleted(uint256 purchaseId);

    event TaskCreated(
        uint256 indexed taskId,
        uint256 indexed requestId,
        address indexed provider,
        address payee,
        ActivityType activityType,
        string metadataUri
    );
    event TaskActivated(
        uint256 indexed taskId,
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
    event TaskCompleted(
        uint256 indexed purchaseId,
        uint256 indexed taskId,
        address indexed buyer
    );
    event CertificateMinted(
        uint256 indexed purchaseId,
        uint256 indexed certificateTokenId,
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
        certificate = GrowthCertificate(certificateAddress);
        coordinator = IVRFCoordinatorV2Plus(coordinatorAddress);
        subscriptionId = vrfSubscriptionId;
        keyHash = vrfKeyHash;
        requestConfirmations = vrfRequestConfirmations;
        callbackGasLimit = vrfCallbackGasLimit;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function createTask(
        address payee,
        ActivityType activityType,
        string calldata metadataUri
    ) external onlyRole(PROVIDER_ROLE) nonReentrant returns (uint256 taskId) {
        if (payee == address(0)) revert InvalidPayee(payee);

        taskId = nextTaskId++;
        Task storage task = tasks[taskId];
        task.provider = msg.sender;
        task.payee = payee;
        task.activityType = activityType;
        task.metadataUri = metadataUri;

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

        emit TaskCreated(
            taskId,
            requestId,
            msg.sender,
            payee,
            activityType,
            metadataUri
        );
    }

    function setTaskPaused(
        uint256 taskId,
        bool paused
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Task storage task = taskFor(taskId);
        task.paused = paused;
        emit TaskPauseChanged(taskId, paused);
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        Task storage task = taskFor(taskId);
        return task;
    }

    function buy(
        uint256 taskId
    ) external nonReentrant returns (uint256 purchaseId) {
        Task storage task = taskFor(taskId);
        if (!task.active) revert TaskNotActive(taskId);
        if (task.paused) revert TaskIsPaused(taskId);
        if (block.timestamp >= task.closesAt) {
            revert TaskExpired(taskId, task.closesAt);
        }
        if (hasPurchased[taskId][msg.sender]) {
            revert TaskAlreadyPurchased(taskId, msg.sender);
        }

        purchaseId = nextPurchaseId++;
        hasPurchased[taskId][msg.sender] = true;
        purchases[purchaseId] = Purchase({
            buyer: msg.sender,
            taskId: taskId,
            price: task.price,
            purchasedAt: uint64(block.timestamp),
            completed: false,
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
        string calldata certificateUri
    ) external onlyRole(ORACLE_ROLE) nonReentrant {
        Purchase storage purchase = purchaseFor(purchaseId);
        if (purchase.completed) {
            revert PurchaseAlreadyCompleted(purchaseId);
        }

        purchase.completed = true;
        uint256 tokenId = certificate.mintForPurchase(
            purchase.buyer,
            purchaseId,
            certificateUri
        );
        purchase.certificateTokenId = tokenId;

        emit TaskCompleted(purchaseId, purchase.taskId, purchase.buyer);
        emit CertificateMinted(purchaseId, tokenId, purchase.buyer);
    }

    function getPurchase(
        uint256 purchaseId
    ) external view returns (Purchase memory) {
        Purchase storage purchase = purchaseFor(purchaseId);
        return purchase;
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        uint256 taskId = requestToTaskId[requestId];
        if (taskId == 0) revert UnknownRequest(requestId);
        Task storage task = tasks[taskId];
        if (task.active) revert TaskAlreadyActivated(taskId);
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
        task.active = true;

        emit TaskActivated(taskId, price, task.opensAt, task.closesAt);
    }

    function taskFor(uint256 taskId) private view returns (Task storage task) {
        task = tasks[taskId];
        if (task.provider == address(0)) revert UnknownTask(taskId);
    }

    function purchaseFor(
        uint256 purchaseId
    ) private view returns (Purchase storage purchase) {
        purchase = purchases[purchaseId];
        if (purchase.buyer == address(0)) {
            revert UnknownPurchase(purchaseId);
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
