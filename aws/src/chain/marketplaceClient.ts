import {
	type Address,
	encodeFunctionData,
	type Hex,
	type TransactionSerializableEIP1559,
} from "viem";
import { ConfirmCompletionError } from "../application/confirmCompletion.js";

export type PrepareConfirmCompletionInput = {
	purchaseId: bigint;
	evidenceHash: Hex;
	certificateUri: string;
	from: Address;
};

export interface MarketplaceClient {
	prepareConfirmCompletion(
		input: PrepareConfirmCompletionInput,
	): Promise<TransactionSerializableEIP1559>;
	broadcast(serializedTransaction: Hex): Promise<Hex>;
}

export interface PublicRpcLike {
	call(input: { account: Address; to: Address; data: Hex }): Promise<unknown>;
	getChainId(): Promise<number>;
	getTransactionCount(input: {
		address: Address;
		blockTag: "pending";
	}): Promise<number>;
	estimateFeesPerGas(): Promise<{
		maxFeePerGas?: bigint;
		maxPriorityFeePerGas?: bigint;
	}>;
	estimateGas(input: {
		account: Address;
		to: Address;
		data: Hex;
	}): Promise<bigint>;
	sendRawTransaction(input: { serializedTransaction: Hex }): Promise<Hex>;
}

const CONFIRM_COMPLETION_ABI = [
	{
		type: "function",
		name: "confirmCompletion",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "purchaseId", type: "uint256" },
			{ name: "evidenceHash", type: "bytes32" },
			{ name: "certificateUri", type: "string" },
		],
		outputs: [{ name: "certificateTokenId", type: "uint256" }],
	},
] as const;

export class ViemMarketplaceClient implements MarketplaceClient {
	constructor(
		private readonly rpc: PublicRpcLike,
		private readonly marketplaceAddress: Address,
	) {}

	async prepareConfirmCompletion(
		input: PrepareConfirmCompletionInput,
	): Promise<TransactionSerializableEIP1559> {
		const data = encodeFunctionData({
			abi: CONFIRM_COMPLETION_ABI,
			functionName: "confirmCompletion",
			args: [input.purchaseId, input.evidenceHash, input.certificateUri],
		});
		try {
			await this.rpc.call({
				account: input.from,
				to: this.marketplaceAddress,
				data,
			});
		} catch (error) {
			throw new ConfirmCompletionError(
				isTimeout(error) ? "RPC_TIMEOUT" : "SIMULATION_REVERTED",
			);
		}

		try {
			const [chainId, nonce, fees, gas] = await Promise.all([
				this.rpc.getChainId(),
				this.rpc.getTransactionCount({
					address: input.from,
					blockTag: "pending",
				}),
				this.rpc.estimateFeesPerGas(),
				this.rpc.estimateGas({
					account: input.from,
					to: this.marketplaceAddress,
					data,
				}),
			]);
			if (
				fees.maxFeePerGas === undefined ||
				fees.maxPriorityFeePerGas === undefined
			) {
				throw new Error("EIP1559_FEES_MISSING");
			}
			return {
				type: "eip1559",
				chainId,
				nonce,
				gas,
				maxFeePerGas: fees.maxFeePerGas,
				maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
				to: this.marketplaceAddress,
				data,
			};
		} catch (error) {
			if (error instanceof ConfirmCompletionError) throw error;
			throw new ConfirmCompletionError(
				isTimeout(error) ? "RPC_TIMEOUT" : "RPC_ERROR",
			);
		}
	}

	async broadcast(serializedTransaction: Hex): Promise<Hex> {
		try {
			return await this.rpc.sendRawTransaction({ serializedTransaction });
		} catch (error) {
			throw new ConfirmCompletionError(
				isTimeout(error) ? "RPC_TIMEOUT" : "BROADCAST_FAILED",
			);
		}
	}
}

function isTimeout(error: unknown) {
	return (
		error instanceof Error &&
		/(?:timeout|timed out|ETIMEDOUT|AbortError)/i.test(
			`${error.name} ${error.message}`,
		)
	);
}
