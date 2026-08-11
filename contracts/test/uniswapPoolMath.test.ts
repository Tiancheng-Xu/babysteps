import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	encodeSqrtRatioX96,
	minimumAmountOut,
	sortPairAmounts,
} from "../scripts/lib/uniswapPoolMath.js";

describe("Uniswap v3 pool preparation math", () => {
	it("encodes a 1:1 raw-unit price as Q96", () => {
		assert.equal(encodeSqrtRatioX96(1n, 1n), 2n ** 96n);
	});

	it("sorts tokens and their desired amounts together", () => {
		assert.deepEqual(
			sortPairAmounts(
				"0x2222222222222222222222222222222222222222",
				"0x1111111111111111111111111111111111111111",
				2n,
				1n,
			),
			{
				token0: "0x1111111111111111111111111111111111111111",
				token1: "0x2222222222222222222222222222222222222222",
				amount0: 1n,
				amount1: 2n,
			},
		);
	});

	it("applies a bounded slippage floor to a test swap", () => {
		assert.equal(minimumAmountOut(100n, 500), 95n);
		assert.throws(() => minimumAmountOut(100n, 10_001), /basis points/u);
	});
});
