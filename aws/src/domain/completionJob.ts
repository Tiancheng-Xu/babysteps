export type Hex = `0x${string}`;
export type CompletionJobStatus = "pending" | "submitted" | "failed";

export type CompletionJobInput = {
	purchaseId: bigint;
	evidenceHash: Hex;
	idempotencyKey: string;
};

export type CompletionJob = CompletionJobInput & {
	status: CompletionJobStatus;
	attemptCount: number;
	transactionHash: Hex | null;
	errorCode: string | null;
};

export type ClaimDecision =
	| { kind: "claimed" }
	| { kind: "existing"; job: CompletionJob }
	| { kind: "conflict" };

export type CompletionJobTransition =
	| { type: "submitted"; transactionHash: Hex }
	| { type: "failed"; errorCode: string };

export function decideClaim(
	input: CompletionJobInput,
	existingJobs: readonly CompletionJob[],
): ClaimDecision {
	const byKey = existingJobs.find(
		(job) => job.idempotencyKey === input.idempotencyKey,
	);
	if (byKey) {
		return byKey.purchaseId === input.purchaseId &&
			byKey.evidenceHash === input.evidenceHash
			? { kind: "existing", job: byKey }
			: { kind: "conflict" };
	}

	if (existingJobs.some((job) => job.purchaseId === input.purchaseId)) {
		return { kind: "conflict" };
	}

	return { kind: "claimed" };
}

export function transitionJob(
	job: CompletionJob,
	transition: CompletionJobTransition,
): CompletionJob {
	if (job.status !== "pending") throw new Error("INVALID_TRANSITION");

	if (transition.type === "submitted") {
		return {
			...job,
			status: "submitted",
			transactionHash: transition.transactionHash,
		};
	}

	return {
		...job,
		status: "failed",
		errorCode: transition.errorCode,
	};
}
