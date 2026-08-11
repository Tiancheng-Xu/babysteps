import type { TaskKey } from "../domain/taskIdentity";

export type ChainTaskStatus =
	| "PendingReview"
	| "PendingRandomness"
	| "Active"
	| "Rejected";

export type ChainTaskView = {
	taskKey: TaskKey;
	chainId: number;
	marketplaceAddress: `0x${string}`;
	taskId: bigint;
	provider: `0x${string}`;
	payee: `0x${string}`;
	activityType: "Meal" | "Walk" | "Read";
	metadataUri: string;
	metadataHash: `0x${string}`;
	status: ChainTaskStatus;
	paused: boolean;
	priceWei: bigint;
	opensAt: bigint;
	closesAt: bigint;
};

export type BindingInput = {
	chainId: number;
	marketplaceAddress: `0x${string}`;
	taskId: bigint;
	transactionHash: `0x${string}`;
	expectedProvider: `0x${string}`;
	expectedMetadataHash: `0x${string}`;
};

export type VerifiedTaskBinding = {
	transactionHash: `0x${string}`;
	task: ChainTaskView;
};

export interface MarketplaceReader {
	hasProviderRole(wallet: `0x${string}`): Promise<boolean>;
	verifyTaskBinding(input: BindingInput): Promise<VerifiedTaskBinding>;
	readTask(taskKey: TaskKey): Promise<ChainTaskView>;
	purchaseIdForBuyer(taskKey: TaskKey, wallet: `0x${string}`): Promise<bigint>;
}

export type MarketplaceReaderFactory = (env: Env) => MarketplaceReader;
