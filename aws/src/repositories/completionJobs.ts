import type {
	ClaimDecision,
	CompletionJob,
	CompletionJobInput,
	Hex,
} from "../domain/completionJob.js";

export type ClaimResult =
	| { kind: "claimed"; job: CompletionJob }
	| Exclude<ClaimDecision, { kind: "claimed" }>;

export interface CompletionJobRepository {
	claim(input: CompletionJobInput): Promise<ClaimResult>;
	markSubmitted(idempotencyKey: string, transactionHash: Hex): Promise<void>;
	markFailed(idempotencyKey: string, errorCode: string): Promise<void>;
}
