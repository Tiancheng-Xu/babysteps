import type { MarketplaceClient } from "../chain/marketplaceClient.js";
import type { CompletionJobInput, Hex } from "../domain/completionJob.js";
import type { CompletionJobRepository } from "../repositories/completionJobs.js";
import type { EthereumSigner } from "../signing/ethereumSigner.js";

export type ConfirmCompletionErrorCode =
	| "SIMULATION_REVERTED"
	| "RPC_TIMEOUT"
	| "RPC_ERROR"
	| "SIGNING_FAILED"
	| "BROADCAST_FAILED"
	| "PERSISTENCE_FAILED";

export class ConfirmCompletionError extends Error {
	readonly code: ConfirmCompletionErrorCode;

	constructor(code: ConfirmCompletionErrorCode) {
		super(code);
		this.name = "ConfirmCompletionError";
		this.code = code;
	}
}

export type ConfirmCompletionDependencies = {
	repository: CompletionJobRepository;
	signer: EthereumSigner;
	marketplace: MarketplaceClient;
	certificateUriFor: (purchaseId: bigint) => string;
};

export type ConfirmCompletionResult =
	| { kind: "submitted"; transactionHash: Hex }
	| {
			kind: "existing";
			status: "pending" | "submitted" | "failed";
			transactionHash: Hex | null;
	  }
	| { kind: "conflict" };

export async function confirmCompletion(
	input: CompletionJobInput,
	dependencies: ConfirmCompletionDependencies,
): Promise<ConfirmCompletionResult> {
	let claim: Awaited<ReturnType<CompletionJobRepository["claim"]>>;
	try {
		claim = await dependencies.repository.claim(input);
	} catch {
		throw new ConfirmCompletionError("PERSISTENCE_FAILED");
	}

	if (claim.kind === "conflict") return { kind: "conflict" };
	if (claim.kind === "existing") {
		return {
			kind: "existing",
			status: claim.job.status,
			transactionHash: claim.job.transactionHash,
		};
	}

	try {
		const from = await dependencies.signer.getAddress();
		const transaction = await dependencies.marketplace.prepareConfirmCompletion(
			{
				purchaseId: input.purchaseId,
				evidenceHash: input.evidenceHash,
				certificateUri: dependencies.certificateUriFor(input.purchaseId),
				from,
			},
		);

		let signedTransaction: Hex;
		try {
			signedTransaction =
				await dependencies.signer.signTransaction(transaction);
		} catch {
			throw new ConfirmCompletionError("SIGNING_FAILED");
		}
		const transactionHash =
			await dependencies.marketplace.broadcast(signedTransaction);
		try {
			await dependencies.repository.markSubmitted(
				input.idempotencyKey,
				transactionHash,
			);
		} catch {
			throw new ConfirmCompletionError("PERSISTENCE_FAILED");
		}
		return { kind: "submitted", transactionHash };
	} catch (error) {
		const publicError =
			error instanceof ConfirmCompletionError
				? error
				: new ConfirmCompletionError("RPC_ERROR");
		if (publicError.code === "PERSISTENCE_FAILED") throw publicError;
		try {
			await dependencies.repository.markFailed(
				input.idempotencyKey,
				publicError.code,
			);
		} catch {
			throw new ConfirmCompletionError("PERSISTENCE_FAILED");
		}
		throw publicError;
	}
}
