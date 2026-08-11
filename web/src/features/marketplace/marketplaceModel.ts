import { type Address, formatUnits, type Hash } from "viem";

export type MarketplaceActivity = "meal" | "walk" | "read";
export type MarketplaceTaskState =
	| "pending-review"
	| "pending-randomness"
	| "active"
	| "paused"
	| "expired"
	| "rejected";

export type MarketplaceContractTask = {
	provider: Address;
	payee: Address;
	activityType: number;
	metadataUri: string;
	metadataHash: Hash;
	rejectionReasonHash: Hash;
	requestId: bigint;
	price: bigint;
	opensAt: bigint;
	closesAt: bigint;
	status: number;
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
		typeof task.metadataHash === "string" &&
		typeof task.rejectionReasonHash === "string" &&
		typeof task.requestId === "bigint" &&
		typeof task.price === "bigint" &&
		typeof task.opensAt === "bigint" &&
		typeof task.closesAt === "bigint" &&
		typeof task.status === "number" &&
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

	let state: MarketplaceTaskState;
	if (task.status === 1) state = "pending-review";
	else if (task.status === 2) state = "pending-randomness";
	else if (task.status === 4) state = "rejected";
	else if (task.status !== 3) {
		throw new Error(`Unknown marketplace task status: ${task.status}`);
	} else if (task.paused) state = "paused";
	else if (now >= task.closesAt) state = "expired";
	else state = "active";

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
