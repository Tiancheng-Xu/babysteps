// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract OnchainNotebook {
    uint256 private constant MAX_NOTE_BYTES = 280;
    uint256 private constant UTC8_OFFSET = 8 hours;

    enum ActivityType {
        Meal,
        Walk,
        Read
    }

    enum GrowthStage {
        Egg,
        Sprout,
        Explorer,
        Star
    }

    struct ActivityProgress {
        uint64 nextClaimAt;
        uint64 totalClaims;
        uint32 utc8DayMarker;
        uint16 claimsToday;
    }

    mapping(address author => string note) private notes;
    mapping(address account => uint256 points) private growthPoints;
    mapping(address account => uint256 balance) private transferableBalances;
    mapping(address account => mapping(ActivityType activity => ActivityProgress progress))
        private activityProgress;

    error NoteTooLong(uint256 actualLength, uint256 maximumLength);
    error ActivityCoolingDown(address account, ActivityType activity);
    error DailyActivityLimitReached(
        address account,
        ActivityType activity,
        uint256 utc8DayId
    );
    error InvalidTransferRecipient(address recipient);
    error CannotTransferToSelf();
    error InvalidTransferAmount();
    error InsufficientTransferableBalance(
        uint256 available,
        uint256 requested
    );

    event NoteUpdated(address indexed author, string note);
    event NoteCleared(address indexed author);
    event ActivityRecorded(
        address indexed account,
        ActivityType indexed activity,
        uint256 indexed utc8DayId,
        uint256 reward,
        uint256 totalPoints,
        GrowthStage stage
    );
    event GrowthPointsTransferred(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 senderBalance,
        uint256 recipientBalance
    );

    function getNote(address author) external view returns (string memory) {
        return notes[author];
    }

    function setNote(string calldata note) external {
        uint256 noteLength = bytes(note).length;
        // Solidity bytes length is UTF-8 byte length, matching the frontend TextEncoder.
        if (noteLength > MAX_NOTE_BYTES) {
            revert NoteTooLong(noteLength, MAX_NOTE_BYTES);
        }

        notes[msg.sender] = note;
        emit NoteUpdated(msg.sender, note);
    }

    function clearNote() external {
        delete notes[msg.sender];
        emit NoteCleared(msg.sender);
    }

    function recordActivity(ActivityType activity) external {
        ActivityProgress storage progress = activityProgress[msg.sender][
            activity
        ];
        uint256 dayId = currentUtc8DayId();
        uint16 currentClaimsToday = claimsTodayFor(progress, dayId);
        if (currentClaimsToday >= dailyLimitFor(activity)) {
            revert DailyActivityLimitReached(msg.sender, activity, dayId);
        }
        if (block.timestamp < progress.nextClaimAt) {
            revert ActivityCoolingDown(msg.sender, activity);
        }

        uint256 reward = rewardFor(activity);
        uint256 totalPoints = growthPoints[msg.sender] + reward;
        uint64 claimNumber = progress.totalClaims + 1;
        uint256 cooldown = cooldownFor(activity, claimNumber);

        progress.nextClaimAt = uint64(block.timestamp + cooldown);
        progress.totalClaims = claimNumber;
        progress.utc8DayMarker = uint32(dayId + 1);
        progress.claimsToday = currentClaimsToday + 1;
        growthPoints[msg.sender] = totalPoints;
        transferableBalances[msg.sender] += reward;

        emit ActivityRecorded(
            msg.sender,
            activity,
            dayId,
            reward,
            totalPoints,
            growthStageFor(totalPoints)
        );
    }

    function getGrowthPoints(address account) external view returns (uint256) {
        return growthPoints[account];
    }

    function getTransferableBalance(
        address account
    ) external view returns (uint256) {
        return transferableBalances[account];
    }

    function transferGrowthPoints(address recipient, uint256 amount) external {
        if (recipient == address(0)) {
            revert InvalidTransferRecipient(recipient);
        }
        if (recipient == msg.sender) revert CannotTransferToSelf();
        if (amount == 0) revert InvalidTransferAmount();

        uint256 senderBalance = transferableBalances[msg.sender];
        if (senderBalance < amount) {
            revert InsufficientTransferableBalance(senderBalance, amount);
        }

        senderBalance -= amount;
        uint256 recipientBalance = transferableBalances[recipient] + amount;
        transferableBalances[msg.sender] = senderBalance;
        transferableBalances[recipient] = recipientBalance;

        emit GrowthPointsTransferred(
            msg.sender,
            recipient,
            amount,
            senderBalance,
            recipientBalance
        );
    }

    function getActivityAvailability(
        address account,
        ActivityType activity
    ) external view returns (bool available, bool dailyLimitReached) {
        ActivityProgress storage progress = activityProgress[account][activity];
        uint16 currentClaimsToday = claimsTodayFor(
            progress,
            currentUtc8DayId()
        );
        if (currentClaimsToday >= dailyLimitFor(activity)) {
            return (false, true);
        }
        return (
            block.timestamp >= progress.nextClaimAt,
            false
        );
    }

    function getGrowthStage(
        address account
    ) external view returns (GrowthStage) {
        return growthStageFor(growthPoints[account]);
    }

    function currentUtc8DayId() public view returns (uint256) {
        return (block.timestamp + UTC8_OFFSET) / 1 days;
    }

    function rewardFor(
        ActivityType activity
    ) private pure returns (uint256) {
        if (activity == ActivityType.Meal) return 3;
        if (activity == ActivityType.Walk) return 5;
        return 7;
    }

    function cooldownFor(
        ActivityType activity,
        uint256 claimNumber
    ) private view returns (uint256) {
        (uint256 minimum, uint256 span) = cooldownRange(activity);
        uint256 entropy = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.timestamp,
                    msg.sender,
                    activity,
                    claimNumber
                )
            )
        );
        return minimum + (entropy % (span + 1));
    }

    function cooldownRange(
        ActivityType activity
    ) private pure returns (uint256 minimum, uint256 span) {
        if (activity == ActivityType.Meal) return (3 hours, 1 hours);
        if (activity == ActivityType.Walk) return (8 hours, 4 hours);
        return (4 hours, 2 hours);
    }

    function dailyLimitFor(
        ActivityType activity
    ) private pure returns (uint16) {
        if (activity == ActivityType.Meal) return 6;
        if (activity == ActivityType.Walk) return 2;
        return 3;
    }

    function claimsTodayFor(
        ActivityProgress storage progress,
        uint256 dayId
    ) private view returns (uint16) {
        if (progress.utc8DayMarker != dayId + 1) return 0;
        return progress.claimsToday;
    }

    function growthStageFor(
        uint256 points
    ) private pure returns (GrowthStage) {
        if (points >= 15) return GrowthStage.Star;
        if (points >= 8) return GrowthStage.Explorer;
        if (points >= 3) return GrowthStage.Sprout;
        return GrowthStage.Egg;
    }
}
