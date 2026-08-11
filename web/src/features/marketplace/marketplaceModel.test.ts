import type { Address, Hash } from "viem";
import { describe, expect, it } from "vitest";

import { toMarketplaceTask } from "./marketplaceModel";

const provider = "0x1111111111111111111111111111111111111111" as Address;
const payee = "0x2222222222222222222222222222222222222222" as Address;

function task(overrides: Record<string, unknown> = {}) {
	return {
		provider,
		payee,
		activityType: 1,
		metadataUri: "ipfs://task-1",
		metadataHash: `0x${"1".repeat(64)}` as Hash,
		rejectionReasonHash: `0x${"0".repeat(64)}` as Hash,
		requestId: 91n,
		price: 3n * 10n ** 18n,
		opensAt: 1_000n,
		closesAt: 10_000n,
		status: 3,
		paused: false,
		...overrides,
	};
}

describe("marketplace task model", () => {
	it("maps verified contract fields into an active task card", () => {
		expect(toMarketplaceTask(7n, task(), 5_000n)).toEqual({
			id: 7n,
			provider,
			payee,
			activity: "walk",
			activityLabel: "户外陪伴",
			metadataUri: "ipfs://task-1",
			requestId: 91n,
			price: 3n * 10n ** 18n,
			priceLabel: "3 BABY",
			opensAt: 1_000n,
			closesAt: 10_000n,
			state: "active",
		});
	});

	it("distinguishes pending randomness, paused, and expired states", () => {
		expect(
			toMarketplaceTask(1n, task({ status: 2, price: 0n }), 5_000n).state,
		).toBe("pending-randomness");
		expect(toMarketplaceTask(2n, task({ paused: true }), 5_000n).state).toBe(
			"paused",
		);
		expect(toMarketplaceTask(3n, task(), 10_000n).state).toBe("expired");
	});

	it("rejects an unknown activity instead of displaying a false category", () => {
		expect(() =>
			toMarketplaceTask(1n, task({ activityType: 9 }), 5_000n),
		).toThrow("Unknown marketplace activity: 9");
	});
});
