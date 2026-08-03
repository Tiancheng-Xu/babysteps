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

    mapping(address author => string note) private notes;
    mapping(address account => uint256 points) private growthPoints;
    mapping(address account => mapping(ActivityType activity => uint256 marker))
        private lastRecordedDayMarker;

    error NoteTooLong(uint256 actualLength, uint256 maximumLength);
    error ActivityAlreadyRecordedToday(
        address account,
        ActivityType activity,
        uint256 utc8DayId
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
        uint256 dayId = currentUtc8DayId();
        if (lastRecordedDayMarker[msg.sender][activity] == dayId + 1) {
            revert ActivityAlreadyRecordedToday(msg.sender, activity, dayId);
        }

        uint256 reward = rewardFor(activity);
        uint256 totalPoints = growthPoints[msg.sender] + reward;

        // Store dayId + 1 so the mapping's zero value always means "never recorded".
        lastRecordedDayMarker[msg.sender][activity] = dayId + 1;
        growthPoints[msg.sender] = totalPoints;

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

    function hasRecordedToday(
        address account,
        ActivityType activity
    ) external view returns (bool) {
        return
            lastRecordedDayMarker[account][activity] ==
            currentUtc8DayId() + 1;
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

    function growthStageFor(
        uint256 points
    ) private pure returns (GrowthStage) {
        if (points >= 15) return GrowthStage.Star;
        if (points >= 8) return GrowthStage.Explorer;
        if (points >= 3) return GrowthStage.Sprout;
        return GrowthStage.Egg;
    }
}
