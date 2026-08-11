import { describe, expect, it } from "vitest";

import {
	applySlippageFloor,
	buildExactInputSingle,
	finiteApprovalAmount,
} from "./uniswapModel";

describe("Uniswap v3 swap model", () => {
	it("applies a deterministic minimum output instead of accepting any price", () => {
		expect(applySlippageFloor(1_000_000n, 100)).toBe(990_000n);
		expect(() => applySlippageFloor(1_000_000n, 10_000)).toThrow(/slippage/u);
	});

	it("uses a finite approval equal to the selected input amount", () => {
		expect(finiteApprovalAmount(4n * 10n ** 18n)).toBe(4n * 10n ** 18n);
		expect(() => finiteApprovalAmount(0n)).toThrow(/positive/u);
	});

	it("builds an expiring exact-input swap with the quoted floor", () => {
		expect(
			buildExactInputSingle({
				tokenIn: "0x1111111111111111111111111111111111111111",
				tokenOut: "0x2222222222222222222222222222222222222222",
				fee: 3_000,
				recipient: "0x3333333333333333333333333333333333333333",
				amountIn: 4n * 10n ** 18n,
				quotedAmountOut: 4_000_000n,
				slippageBps: 100,
			}),
		).toMatchObject({
			amountIn: 4n * 10n ** 18n,
			amountOutMinimum: 3_960_000n,
			sqrtPriceLimitX96: 0n,
		});
	});
});
