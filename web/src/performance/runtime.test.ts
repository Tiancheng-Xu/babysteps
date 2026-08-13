import { describe, expect, it, vi } from "vitest";
import { measurePerformance, setPerformanceClient } from "./runtime";
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
});
