import { type Address, formatUnits } from "viem";

export type MarketplaceActivity = "meal" | "walk" | "read";
export type MarketplaceTaskState =
	| "pending-randomness"
	| "active"
	| "paused"
	| "expired";

export type MarketplaceContractTask = {
	provider: Address;
	payee: Address;
	activityType: number;
	metadataUri: string;
	requestId: bigint;
	price: bigint;
	opensAt: bigint;
	closesAt: bigint;
	active: boolean;
	paused: boolean;
};

export type MarketplaceTask = {
	id: bigint;
	provider: Address;
	payee: Address;
	activity: MarketplaceActivity;
	activityLabel: string;
	metadataUri: string;
	requestId: bigint;
	price: bigint;
	priceLabel: string;
	opensAt: bigint;
	closesAt: bigint;
	state: MarketplaceTaskState;
};

const ACTIVITIES = [
	{ id: "meal", label: "喂养陪伴" },
	{ id: "walk", label: "户外陪伴" },
	{ id: "read", label: "亲子共读" },
] as const;

export function isMarketplaceContractTask(
	value: unknown,
): value is MarketplaceContractTask {
	if (!value || typeof value !== "object") return false;
	const task = value as Record<string, unknown>;
	return (
		typeof task.provider === "string" &&
		typeof task.payee === "string" &&
		typeof task.activityType === "number" &&
		typeof task.metadataUri === "string" &&
		typeof task.requestId === "bigint" &&
		typeof task.price === "bigint" &&
		typeof task.opensAt === "bigint" &&
		typeof task.closesAt === "bigint" &&
		typeof task.active === "boolean" &&
		typeof task.paused === "boolean"
	);
}

export function toMarketplaceTask(
	id: bigint,
	task: MarketplaceContractTask,
	now: bigint,
): MarketplaceTask {
	const activity = ACTIVITIES[task.activityType];
	if (!activity) {
		throw new Error(`Unknown marketplace activity: ${task.activityType}`);
	}

	let state: MarketplaceTaskState = "active";
	if (!task.active) state = "pending-randomness";
	else if (task.paused) state = "paused";
	else if (now >= task.closesAt) state = "expired";

	return {
		id,
		provider: task.provider,
		payee: task.payee,
		activity: activity.id,
		activityLabel: activity.label,
		metadataUri: task.metadataUri,
		requestId: task.requestId,
		price: task.price,
		priceLabel: `${formatUnits(task.price, 18)} BABY`,
		opensAt: task.opensAt,
		closesAt: task.closesAt,
		state,
	};
}
