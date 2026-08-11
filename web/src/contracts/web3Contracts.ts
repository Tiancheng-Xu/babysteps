import { type Address, isAddress, parseAbi } from "viem";

export const uniswapV3Sepolia = {
	factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
	quoterV2: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
	swapRouter02: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
	usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
	weth: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
	fee: 3_000,
} as const satisfies {
	factory: Address;
	quoterV2: Address;
	swapRouter02: Address;
	usdc: Address;
	weth: Address;
	fee: 3_000;
};

export type PublicAppConfig = {
	privyAppId?: string;
	apiUrl?: string;
};

export function parsePublicAppConfig(input: PublicAppConfig): PublicAppConfig {
	const privyAppId = input.privyAppId?.trim() || undefined;
	if (
		privyAppId &&
		/(?:secret|private[_-]?key|api[_-]?key)/iu.test(privyAppId)
	) {
		throw new Error("Privy app ID must be a public application identifier.");
	}

	let apiUrl: string | undefined;
	if (input.apiUrl?.trim()) {
		const parsed = new URL(input.apiUrl.trim());
		const isLocalhost = parsed.hostname === "localhost";
		if (
			parsed.protocol !== "https:" &&
			!(isLocalhost && parsed.protocol === "http:")
		) {
			throw new Error("BabySteps API URL must use HTTPS outside localhost.");
		}
		apiUrl = parsed.toString().replace(/\/$/u, "");
	}

	return { privyAppId, apiUrl };
}

export const publicAppConfig = parsePublicAppConfig({
	privyAppId: import.meta.env.VITE_PRIVY_APP_ID,
	apiUrl: import.meta.env.VITE_BABYSTEPS_API_URL,
});

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
