import { describe, expect, it, vi } from "vitest";
import {
	measureBusinessPerformance,
	measurePerformance,
	recordPerformance,
	setPerformanceClient,
} from "./runtime";
import type { PerformanceClient } from "./types";

describe("performance runtime bridge", () => {
	it("measures a real product operation through the configured client", async () => {
		const markOperation = vi.fn(async (_name, operation) => operation());
		setPerformanceClient({ markOperation } as unknown as PerformanceClient);

		await expect(
			measurePerformance("web3.uniswap.quote", async () => "quoted"),
		).resolves.toBe("quoted");
		expect(markOperation).toHaveBeenCalledWith(
			"web3.uniswap.quote",
			expect.any(Function),
		);
	});

	it("forwards a route metric without exposing route text through the bridge", () => {
		const record = vi.fn();
		setPerformanceClient({
			record,
			markOperation: vi.fn(),
		} as unknown as PerformanceClient);
		recordPerformance({
			type: "custom",
			name: "spa.route.duration",
			value: 24,
			unit: "ms",
		});
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ name: "spa.route.duration", value: 24 }),
		);
	});

	it("measures a bounded business operation through the configured client", async () => {
		const markBusinessOperation = vi.fn(async (_name, operation) =>
			operation(),
		);
		setPerformanceClient({
			markOperation: vi.fn(),
			markBusinessOperation,
			record: vi.fn(),
		} as unknown as PerformanceClient);

		await expect(
			measureBusinessPerformance("business.profile.write", async () => "saved"),
		).resolves.toBe("saved");
		expect(markBusinessOperation).toHaveBeenCalledWith(
			"business.profile.write",
			expect.any(Function),
		);
	});
});
