import { type Address, isAddress, parseAbi } from "viem";

export function parseOptionalContractAddress(
	value: string | undefined,
	label: string,
): Address | undefined {
	const normalized = value?.trim();
	if (!normalized) return undefined;
	if (!isAddress(normalized)) {
		throw new Error(
			`${label} address must be a valid deployed contract address.`,
		);
	}
	return normalized;
}

export const babyCoinAddress = parseOptionalContractAddress(
	import.meta.env.VITE_BABY_COIN_ADDRESS,
	"BabyCoin",
);

export const growthActivitiesAddress = parseOptionalContractAddress(
	import.meta.env.VITE_GROWTH_ACTIVITIES_ADDRESS,
	"GrowthActivities",
);

export const growthCertificateAddress = parseOptionalContractAddress(
	import.meta.env.VITE_GROWTH_CERTIFICATE_ADDRESS,
	"GrowthCertificate",
);

export const taskMarketplaceAddress = parseOptionalContractAddress(
	import.meta.env.VITE_TASK_MARKETPLACE_ADDRESS,
	"TaskMarketplace",
);

export const babyCoinAbi = parseAbi([
	"function balanceOf(address account) view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
	"function lifetimeEarned(address account) view returns (uint256)",
	"function growthStageOf(address account) view returns (uint8)",
]);

export const growthActivitiesAbi = parseAbi([
	"function recordActivity(uint8 activity)",
	"function getActivityAvailability(address account, uint8 activity) view returns (bool available, bool dailyLimitReached)",
]);

export const taskMarketplaceAbi = parseAbi([
	"function hasRole(bytes32 role, address account) view returns (bool)",
	"function nextTaskId() view returns (uint256)",
	"function getTask(uint256 taskId) view returns ((address provider, address payee, uint8 activityType, string metadataUri, uint256 requestId, uint256 price, uint64 opensAt, uint64 closesAt, bool active, bool paused) task)",
	"function hasPurchased(uint256 taskId, address buyer) view returns (bool)",
	"function createTask(address payee, uint8 activityType, string metadataUri) returns (uint256 taskId)",
	"function buy(uint256 taskId) returns (uint256 purchaseId)",
]);

export const growthCertificateAbi = parseAbi([
	"function tokenForPurchase(uint256 purchaseId) view returns (uint256)",
	"function ownerOf(uint256 tokenId) view returns (address)",
	"function tokenURI(uint256 tokenId) view returns (string)",
]);
