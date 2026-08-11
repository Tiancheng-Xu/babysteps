import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	type NonceStore,
	verifyWebhook,
	WebhookAuthError,
} from "../src/auth/webhook.js";

const NOW = new Date("2026-08-10T18:00:00.000Z");
const SECRET = "test-only-hmac-secret";
const RAW_BODY = JSON.stringify({ purchaseId: "1", evidenceHash: "0x1234" });

class MemoryNonceStore implements NonceStore {
	readonly consumed = new Map<string, Date>();

	async consume(nonce: string, expiresAt: Date): Promise<boolean> {
		if (this.consumed.has(nonce)) return false;
		this.consumed.set(nonce, expiresAt);
		return true;
	}
}

function signature(timestamp: string, nonce: string, body = RAW_BODY) {
	return createHmac("sha256", SECRET)
		.update(`${timestamp}.${nonce}.${body}`)
		.digest("hex");
}

async function expectCode(promise: Promise<unknown>, code: string) {
	await expect(promise).rejects.toMatchObject({
		code,
		name: WebhookAuthError.name,
	});
}

describe("verifyWebhook", () => {
	it("accepts a valid signature and consumes the nonce until expiry", async () => {
		const nonceStore = new MemoryNonceStore();
		const timestamp = String(Math.floor(NOW.getTime() / 1000));
		const nonce = "nonce-01";

		await expect(
			verifyWebhook(
				{
					rawBody: RAW_BODY,
					timestamp,
					nonce,
					signature: signature(timestamp, nonce),
				},
				{ secret: SECRET, nonceStore, now: () => NOW },
			),
		).resolves.toEqual({ timestamp: Number(timestamp), nonce });

		expect(nonceStore.consumed.get(nonce)?.toISOString()).toBe(
			"2026-08-10T18:05:00.000Z",
		);
	});

	it("rejects a signature when the request body was changed", async () => {
		const timestamp = String(Math.floor(NOW.getTime() / 1000));
		const nonce = "nonce-02";
		const nonceStore = new MemoryNonceStore();

		await expectCode(
			verifyWebhook(
				{
					rawBody: `${RAW_BODY} `,
					timestamp,
					nonce,
					signature: signature(timestamp, nonce),
				},
				{ secret: SECRET, nonceStore, now: () => NOW },
			),
			"AUTH_INVALID",
		);
		expect(nonceStore.consumed.size).toBe(0);
	});

	it.each([
		["too old", -301],
		["too far in the future", 301],
	])("rejects a timestamp that is %s", async (_label, offsetSeconds) => {
		const timestamp = String(Math.floor(NOW.getTime() / 1000) + offsetSeconds);
		const nonce = `nonce-${offsetSeconds}`;

		await expectCode(
			verifyWebhook(
				{
					rawBody: RAW_BODY,
					timestamp,
					nonce,
					signature: signature(timestamp, nonce),
				},
				{
					secret: SECRET,
					nonceStore: new MemoryNonceStore(),
					now: () => NOW,
				},
			),
			"AUTH_EXPIRED",
		);
	});

	it("rejects a replayed nonce after the first valid request", async () => {
		const timestamp = String(Math.floor(NOW.getTime() / 1000));
		const nonce = "nonce-replayed";
		const nonceStore = new MemoryNonceStore();
		const input = {
			rawBody: RAW_BODY,
			timestamp,
			nonce,
			signature: signature(timestamp, nonce),
		};

		await verifyWebhook(input, { secret: SECRET, nonceStore, now: () => NOW });
		await expectCode(
			verifyWebhook(input, { secret: SECRET, nonceStore, now: () => NOW }),
			"AUTH_REPLAYED",
		);
	});

	it.each(["timestamp", "nonce", "signature"] as const)(
		"rejects a missing %s",
		async (field) => {
			const timestamp = String(Math.floor(NOW.getTime() / 1000));
			const nonce = "nonce-missing";
			const input = {
				rawBody: RAW_BODY,
				timestamp,
				nonce,
				signature: signature(timestamp, nonce),
			};
			delete input[field];

			await expectCode(
				verifyWebhook(input, {
					secret: SECRET,
					nonceStore: new MemoryNonceStore(),
					now: () => NOW,
				}),
				"AUTH_MISSING",
			);
		},
	);
});
