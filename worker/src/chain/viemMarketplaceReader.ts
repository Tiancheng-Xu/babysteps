import {
	createPublicClient,
	decodeEventLog,
	getAddress,
	http,
	parseAbi,
} from "viem";
import { sepolia } from "viem/chains";
import type { AppConfig } from "../config";
import { readConfig } from "../config";
import {
	buildTaskKey,
	parseTaskKey,
	type TaskKey,
} from "../domain/taskIdentity";
import type {
	BindingInput,
	ChainTaskStatus,
	ChainTaskView,
	MarketplaceReader,
	VerifiedTaskBinding,
} from "./marketplaceReader";

const marketplaceAbi = parseAbi([
	"function PROVIDER_ROLE() view returns (bytes32)",
	"function hasRole(bytes32 role, address account) view returns (bool)",
	"function getTask(uint256 taskId) view returns ((address provider,address payee,uint8 activityType,string metadataUri,bytes32 metadataHash,bytes32 rejectionReasonHash,uint256 requestId,uint256 price,uint64 opensAt,uint64 closesAt,uint8 status,bool paused))",
	"function purchaseIdForBuyer(uint256 taskId,address buyer) view returns (uint256)",
	"event TaskRequested(uint256 indexed taskId,address indexed provider,address indexed payee,uint8 activityType,string metadataUri,bytes32 metadataHash)",
]);

const activityNames = ["Meal", "Walk", "Read"] as const;
const statusNames = [
	"None",
	"PendingReview",
	"PendingRandomness",
	"Active",
	"Rejected",
] as const;

export class ViemMarketplaceReader implements MarketplaceReader {
	private readonly client;

	constructor(private readonly config: AppConfig) {
		this.client = createPublicClient({
			chain: sepolia,
			transport: http(config.rpcUrl),
		});
	}

	async hasProviderRole(wallet: `0x${string}`): Promise<boolean> {
		const role = await this.client.readContract({
			address: this.config.marketplaceAddress,
			abi: marketplaceAbi,
			functionName: "PROVIDER_ROLE",
		});

		return this.client.readContract({
			address: this.config.marketplaceAddress,
			abi: marketplaceAbi,
			functionName: "hasRole",
			args: [role, wallet],
		});
	}

	async verifyTaskBinding(input: BindingInput): Promise<VerifiedTaskBinding> {
		if (input.chainId !== this.config.chainId) {
			throw new Error("chain mismatch");
		}
		const receipt = await this.client.getTransactionReceipt({
			hash: input.transactionHash,
		});
		if (
			receipt.status !== "success" ||
			receipt.to?.toLowerCase() !== input.marketplaceAddress.toLowerCase()
		) {
			throw new Error("transaction receipt mismatch");
		}

		const requested = receipt.logs
			.filter(
				(log) =>
					log.address.toLowerCase() === input.marketplaceAddress.toLowerCase(),
			)
			.flatMap((log) => {
				try {
					const event = decodeEventLog({
						abi: marketplaceAbi,
						eventName: "TaskRequested",
						data: log.data,
						topics: log.topics,
					});
					return [event.args];
				} catch {
					return [];
				}
			})
			.find(
				(args) =>
					args.taskId === input.taskId &&
					args.provider.toLowerCase() === input.expectedProvider.toLowerCase(),
			);
		if (!requested || requested.metadataHash !== input.expectedMetadataHash) {
			throw new Error("TaskRequested event mismatch");
		}

		const task = await this.readTask(
			buildTaskKey(input.chainId, input.marketplaceAddress, input.taskId),
		);
		if (
			task.provider.toLowerCase() !== input.expectedProvider.toLowerCase() ||
			task.metadataHash !== input.expectedMetadataHash ||
			task.payee.toLowerCase() !== requested.payee.toLowerCase() ||
			task.activityType !== activityNames[Number(requested.activityType)] ||
			task.metadataUri !== requested.metadataUri
		) {
			throw new Error("current task state mismatch");
		}

		return { transactionHash: input.transactionHash, task };
	}

	async readTask(taskKey: TaskKey): Promise<ChainTaskView> {
		const parsed = parseTaskKey(taskKey);
		if (parsed.chainId !== this.config.chainId) {
			throw new Error("chain mismatch");
		}
		const task = await this.client.readContract({
			address: parsed.marketplaceAddress,
			abi: marketplaceAbi,
			functionName: "getTask",
			args: [parsed.taskId],
		});
		const activityType = activityNames[Number(task.activityType)];
		const status = statusNames[Number(task.status)];
		if (!activityType || !status || status === "None") {
			throw new Error("unsupported task state");
		}

		return {
			taskKey,
			chainId: parsed.chainId,
			marketplaceAddress: parsed.marketplaceAddress,
			taskId: parsed.taskId,
			provider: getAddress(task.provider).toLowerCase() as `0x${string}`,
			payee: getAddress(task.payee).toLowerCase() as `0x${string}`,
			activityType,
			metadataUri: task.metadataUri,
			metadataHash: task.metadataHash,
			status: status as ChainTaskStatus,
			paused: task.paused,
			priceWei: task.price,
			opensAt: task.opensAt,
			closesAt: task.closesAt,
		};
	}

	async purchaseIdForBuyer(
		taskKey: TaskKey,
		wallet: `0x${string}`,
	): Promise<bigint> {
		const parsed = parseTaskKey(taskKey);
		return this.client.readContract({
			address: parsed.marketplaceAddress,
			abi: marketplaceAbi,
			functionName: "purchaseIdForBuyer",
			args: [parsed.taskId, wallet],
		});
	}
}

export function createViemMarketplaceReader(env: Env): MarketplaceReader {
	return new ViemMarketplaceReader(readConfig(env));
}
