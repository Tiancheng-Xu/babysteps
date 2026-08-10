import type { TransactionSerializableEIP1559 } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
	ConfirmCompletionError,
	confirmCompletion,
} from "../src/application/confirmCompletion.js";
import type { MarketplaceClient } from "../src/chain/marketplaceClient.js";
import type { CompletionJob } from "../src/domain/completionJob.js";
import type {
	ClaimResult,
	CompletionJobRepository,
} from "../src/repositories/completionJobs.js";
import type { EthereumSigner } from "../src/signing/ethereumSigner.js";

const input = {
	purchaseId: 7n,
	evidenceHash: `0x${"ab".repeat(32)}` as const,
	idempotencyKey: "completion-7-v1",
};
const transactionHash = `0x${"12".repeat(32)}` as const;
const rawTransaction = "0x02aabb" as const;
const transaction: TransactionSerializableEIP1559 = {
	type: "eip1559",
	chainId: 11_155_111,
	nonce: 3,
	maxFeePerGas: 2n,
	maxPriorityFeePerGas: 1n,
	gas: 150_000n,
	to: "0x000000000000000000000000000000000000dEaD",
	data: "0x1234",
};

function job(overrides: Partial<CompletionJob> = {}): CompletionJob {
	return {
		...input,
		status: "pending",
		attemptCount: 1,
		transactionHash: null,
		errorCode: null,
		...overrides,
	};
}

function setup(claimResult: ClaimResult = { kind: "claimed", job: job() }) {
	const repository: CompletionJobRepository = {
		claim: vi.fn(async () => claimResult),
		markSubmitted: vi.fn(async () => undefined),
		markFailed: vi.fn(async () => undefined),
	};
	const signTransaction = vi.fn(
		async (): Promise<`0x${string}`> => rawTransaction,
	);
	const signer: EthereumSigner = {
		getAddress: vi.fn(
			async () => "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf" as const,
		),
		signTransaction,
	};
	const marketplace: MarketplaceClient = {
		prepareConfirmCompletion: vi.fn(async () => transaction),
		broadcast: vi.fn(async () => transactionHash),
	};
	return { repository, signer, marketplace };
}

describe("confirmCompletion application", () => {
	it("claims, simulates, KMS-signs, broadcasts once, and persists the hash", async () => {
		const dependencies = setup();
		await expect(
			confirmCompletion(input, {
				...dependencies,
				certificateUriFor: (purchaseId) => `ipfs://fixture/${purchaseId}.json`,
			}),
		).resolves.toEqual({ kind: "submitted", transactionHash });

		expect(
			dependencies.marketplace.prepareConfirmCompletion,
		).toHaveBeenCalledWith({
			purchaseId: 7n,
			evidenceHash: input.evidenceHash,
			certificateUri: "ipfs://fixture/7.json",
			from: "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
		});
		expect(dependencies.signer.signTransaction).toHaveBeenCalledOnce();
		expect(dependencies.marketplace.broadcast).toHaveBeenCalledWith(
			rawTransaction,
		);
		expect(dependencies.repository.markSubmitted).toHaveBeenCalledWith(
			input.idempotencyKey,
			transactionHash,
		);
	});

	it("returns an exact replay without a second signature or broadcast", async () => {
		const dependencies = setup({
			kind: "existing",
			job: job({ status: "submitted", transactionHash }),
		});
		await expect(
			confirmCompletion(input, {
				...dependencies,
				certificateUriFor: () => "ipfs://unused",
			}),
		).resolves.toEqual({
			kind: "existing",
			status: "submitted",
			transactionHash,
		});
		expect(dependencies.signer.signTransaction).not.toHaveBeenCalled();
		expect(dependencies.marketplace.broadcast).not.toHaveBeenCalled();
	});

	it("returns a payload conflict without touching the chain", async () => {
		const dependencies = setup({ kind: "conflict" });
		await expect(
			confirmCompletion(input, {
				...dependencies,
				certificateUriFor: () => "ipfs://unused",
			}),
		).resolves.toEqual({ kind: "conflict" });
		expect(
			dependencies.marketplace.prepareConfirmCompletion,
		).not.toHaveBeenCalled();
	});

	it.each(["SIMULATION_REVERTED", "RPC_TIMEOUT"] as const)(
		"marks a failed job with stable code %s",
		async (code) => {
			const dependencies = setup();
			vi.mocked(
				dependencies.marketplace.prepareConfirmCompletion,
			).mockRejectedValue(new ConfirmCompletionError(code));
			await expect(
				confirmCompletion(input, {
					...dependencies,
					certificateUriFor: () => "ipfs://fixture/7.json",
				}),
			).rejects.toMatchObject({ code, message: code });
			expect(dependencies.repository.markFailed).toHaveBeenCalledWith(
				input.idempotencyKey,
				code,
			);
		},
	);

	it("reports a redacted persistence failure after a successful broadcast", async () => {
		const dependencies = setup();
		vi.mocked(dependencies.repository.markSubmitted).mockRejectedValue(
			new Error("postgres://user:password@private-host/internal"),
		);

		await expect(
			confirmCompletion(input, {
				...dependencies,
				certificateUriFor: () => "ipfs://fixture/7.json",
			}),
		).rejects.toEqual(new ConfirmCompletionError("PERSISTENCE_FAILED"));
	});
});
