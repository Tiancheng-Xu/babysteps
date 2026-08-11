import { describe, expect, it } from "vitest";
import {
	type CompletionJob,
	type CompletionJobInput,
	decideClaim,
	transitionJob,
} from "../src/domain/completionJob.js";

const input: CompletionJobInput = {
	purchaseId: 7n,
	evidenceHash: `0x${"ab".repeat(32)}`,
	idempotencyKey: "completion-7-v1",
};

function pending(overrides: Partial<CompletionJob> = {}): CompletionJob {
	return {
		...input,
		status: "pending",
		attemptCount: 1,
		transactionHash: null,
		errorCode: null,
		...overrides,
	};
}

describe("completion job domain", () => {
	it("claims a new purchase", () => {
		expect(decideClaim(input, [])).toEqual({ kind: "claimed" });
	});

	it("returns the existing job for the exact idempotent replay", () => {
		const existing = pending();
		expect(decideClaim(input, [existing])).toEqual({
			kind: "existing",
			job: existing,
		});
	});

	it("conflicts when an idempotency key is reused with another payload", () => {
		const existing = pending({ purchaseId: 8n });
		expect(decideClaim(input, [existing])).toEqual({ kind: "conflict" });
	});

	it("conflicts when one purchase is submitted under a second key", () => {
		const existing = pending({ idempotencyKey: "completion-7-other" });
		expect(decideClaim(input, [existing])).toEqual({ kind: "conflict" });
	});

	it("allows only pending jobs to become submitted or failed", () => {
		const job = pending();
		const hash = `0x${"12".repeat(32)}` as const;
		expect(
			transitionJob(job, { type: "submitted", transactionHash: hash }),
		).toEqual({
			...job,
			status: "submitted",
			transactionHash: hash,
		});
		expect(
			transitionJob(job, { type: "failed", errorCode: "RPC_TIMEOUT" }),
		).toEqual({
			...job,
			status: "failed",
			errorCode: "RPC_TIMEOUT",
		});
		expect(() =>
			transitionJob(pending({ status: "submitted" }), {
				type: "failed",
				errorCode: "LATE_FAILURE",
			}),
		).toThrowError("INVALID_TRANSITION");
	});
});
