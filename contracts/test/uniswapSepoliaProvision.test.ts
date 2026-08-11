import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Sepolia Uniswap v3 delivery script", () => {
	it("uses official assets, bounded liquidity, and two real swaps", async () => {
		const source = await readFile(
			new URL("../scripts/provisionSepoliaUniswapV3.ts", import.meta.url),
			"utf8",
		);
		for (const required of [
			"0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
			"0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
			"0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
			"exactInputSingle",
			"swapInput",
			"swapOutput",
			"2026-08-11-uniswap-v3-pools.json",
		]) {
			assert.match(source, new RegExp(required));
		}
		assert.match(source, /UNISWAP_BABY_USDC_AMOUNT\?\.trim\(\) \|\| "6"/u);
		assert.match(source, /UNISWAP_USDC_AMOUNT\?\.trim\(\) \|\| "6"/u);
		assert.match(source, /UNISWAP_BABY_WETH_AMOUNT\?\.trim\(\) \|\| "6"/u);
		assert.match(source, /UNISWAP_WETH_AMOUNT\?\.trim\(\) \|\| "0\.003"/u);
	});
});
