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
	"event NoteUpdated(address indexed author, string note)",
	"event NoteCleared(address indexed author)",
	"function getNote(address author) view returns (string)",
	"function setNote(string note)",
	"function clearNote()",
]);
