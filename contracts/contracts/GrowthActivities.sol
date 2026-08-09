// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BabyCoin} from "./BabyCoin.sol";

contract GrowthActivities {
    uint256 private constant UTC8_OFFSET = 8 hours;

    enum ActivityType {
        Meal,
        Walk,
        Read
    }

    struct ActivityProgress {
        uint64 nextClaimAt;
        uint64 totalClaims;
        uint32 utc8DayMarker;
        uint16 claimsToday;
    }

    BabyCoin public immutable babyCoin;

    mapping(address account => mapping(ActivityType activity => ActivityProgress progress))
        private activityProgress;

    error ActivityCoolingDown(address account, ActivityType activity);
    error DailyActivityLimitReached(
        address account,
        ActivityType activity,
        uint256 utc8DayId
    );

    event ActivityRecorded(
        address indexed account,
        ActivityType indexed activity,
        uint256 indexed utc8DayId,
        uint256 reward,
        uint256 lifetimeEarned,
        uint8 stage
    );

    constructor(address babyCoinAddress) {
        babyCoin = BabyCoin(babyCoinAddress);
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

        uint256 rewardAmount = rewardFor(activity);
        uint64 claimNumber = progress.totalClaims + 1;
        uint256 cooldown = cooldownFor(activity, claimNumber);

        progress.nextClaimAt = uint64(block.timestamp + cooldown);
        progress.totalClaims = claimNumber;
        progress.utc8DayMarker = uint32(dayId + 1);
        progress.claimsToday = currentClaimsToday + 1;

        babyCoin.reward(msg.sender, rewardAmount);
        uint256 earned = babyCoin.lifetimeEarned(msg.sender);

        emit ActivityRecorded(
            msg.sender,
            activity,
            dayId,
            rewardAmount,
            earned,
            growthStageFor(earned)
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
        return (block.timestamp >= progress.nextClaimAt, false);
    }

    function currentUtc8DayId() public view returns (uint256) {
        return (block.timestamp + UTC8_OFFSET) / 1 days;
    }

    function rewardFor(ActivityType activity) private pure returns (uint256) {
        if (activity == ActivityType.Meal) return 3 ether;
        if (activity == ActivityType.Walk) return 5 ether;
        return 7 ether;
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

    function growthStageFor(uint256 earned) private pure returns (uint8) {
        if (earned >= 15 ether) return 3;
        if (earned >= 8 ether) return 2;
        if (earned >= 3 ether) return 1;
        return 0;
    }
}
