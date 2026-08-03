import { type Address, isAddress, parseAbi } from "viem";

const configuredNotebookAddress = import.meta.env.VITE_ONCHAIN_NOTEBOOK_ADDRESS;

// A public address is still security-sensitive configuration: never substitute a fallback contract.
if (!configuredNotebookAddress || !isAddress(configuredNotebookAddress)) {
	throw new Error(
		"VITE_ONCHAIN_NOTEBOOK_ADDRESS must be a valid deployed contract address.",
	);
}

export const notebookAddress: Address = configuredNotebookAddress;

export const onchainNotebookAbi = parseAbi([
	"error NoteTooLong(uint256 actualLength, uint256 maximumLength)",
	"error ActivityCoolingDown(address account, uint8 activity)",
	"error DailyActivityLimitReached(address account, uint8 activity, uint256 utc8DayId)",
	"error InvalidTransferRecipient(address recipient)",
	"error CannotTransferToSelf()",
	"error InvalidTransferAmount()",
	"error InsufficientTransferableBalance(uint256 available, uint256 requested)",
	"event NoteUpdated(address indexed author, string note)",
	"event NoteCleared(address indexed author)",
	"event ActivityRecorded(address indexed account, uint8 indexed activity, uint256 indexed utc8DayId, uint256 reward, uint256 totalPoints, uint8 stage)",
	"event GrowthPointsTransferred(address indexed sender, address indexed recipient, uint256 amount, uint256 senderBalance, uint256 recipientBalance)",
	"function getNote(address author) view returns (string)",
	"function setNote(string note)",
	"function clearNote()",
	"function recordActivity(uint8 activity)",
	"function getGrowthPoints(address account) view returns (uint256)",
	"function getTransferableBalance(address account) view returns (uint256)",
	"function transferGrowthPoints(address recipient, uint256 amount)",
	"function getActivityAvailability(address account, uint8 activity) view returns (bool available, bool dailyLimitReached)",
	"function getGrowthStage(address account) view returns (uint8)",
	"function currentUtc8DayId() view returns (uint256)",
]);
