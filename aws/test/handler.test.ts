import { describe, expect, it, vi } from "vitest";
import { ConfirmCompletionError } from "../src/application/confirmCompletion.js";
import { WebhookAuthError } from "../src/auth/webhook.js";
import { createHandler } from "../src/handler.js";

const validPayload = {
	purchaseId: "7",
	evidenceHash: `0x${"ab".repeat(32)}`,
	idempotencyKey: "completion-7-v1",
};

function event(body: unknown = validPayload) {
	return {
		body: JSON.stringify(body),
		isBase64Encoded: false,
		headers: {
			"x-babysteps-timestamp": "1786384800",
			"x-babysteps-nonce": "nonce-01",
			"x-babysteps-signature": "a".repeat(64),
		},
	};
}

describe("completion relayer HTTP handler", () => {
	it("returns 202 for a newly submitted completion", async () => {
		const verify = vi.fn(async () => ({ timestamp: 1, nonce: "nonce-01" }));
		const confirm = vi.fn(async () => ({
			kind: "submitted" as const,
			transactionHash: `0x${"12".repeat(32)}` as const,
		}));
		const handler = createHandler({
			verifyWebhook: verify,
			confirmCompletion: confirm,
		});

		const response = await handler(event());
		expect(response.statusCode).toBe(202);
		expect(JSON.parse(response.body)).toEqual({
			status: "submitted",
			transactionHash: `0x${"12".repeat(32)}`,
		});
		expect(confirm).toHaveBeenCalledWith({
			purchaseId: 7n,
			evidenceHash: validPayload.evidenceHash,
			idempotencyKey: validPayload.idempotencyKey,
		});
	});

	it("maps authentication, conflict, and public application failures", async () => {
		const cases = [
			{
				error: new WebhookAuthError("AUTH_INVALID"),
				status: 401,
				code: "AUTH_INVALID",
			},
			{
				result: { kind: "conflict" as const },
				status: 409,
				code: "IDEMPOTENCY_CONFLICT",
			},
			{
				error: new ConfirmCompletionError("RPC_TIMEOUT"),
				status: 503,
				code: "RPC_TIMEOUT",
			},
		];

		for (const testCase of cases) {
			const handler = createHandler({
				verifyWebhook:
					testCase.error instanceof WebhookAuthError
						? vi.fn(async () => {
								throw testCase.error;
							})
						: vi.fn(async () => ({ timestamp: 1, nonce: "nonce-01" })),
				confirmCompletion:
					testCase.error instanceof ConfirmCompletionError
						? vi.fn(async () => {
								throw testCase.error;
							})
						: vi.fn(
								async () => testCase.result ?? { kind: "conflict" as const },
							),
			});
			const response = await handler(event());
			expect(response.statusCode).toBe(testCase.status);
			expect(JSON.parse(response.body)).toEqual({ error: testCase.code });
		}
	});

	it("rejects malformed JSON and never returns internal error text", async () => {
		const handler = createHandler({
			verifyWebhook: vi.fn(async () => ({ timestamp: 1, nonce: "nonce" })),
			confirmCompletion: vi.fn(async () => {
				throw new Error("password=secret private-host.internal");
			}),
		});
		const malformed = await handler({ ...event(), body: "{" });
		expect(malformed.statusCode).toBe(400);
		expect(malformed.body).toBe('{"error":"INVALID_REQUEST"}');

		const internal = await handler(event());
		expect(internal.statusCode).toBe(500);
		expect(internal.body).toBe('{"error":"INTERNAL_ERROR"}');
		expect(internal.body).not.toContain("secret");
	});
});
