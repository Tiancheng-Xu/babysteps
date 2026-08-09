import { encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";

import {
	babyCoinAbi,
	parseOptionalContractAddress,
	taskMarketplaceAbi,
} from "./web3Contracts";

describe("web3 contract configuration", () => {
	it("keeps an unconfigured deployment explicitly absent", () => {
		expect(parseOptionalContractAddress(undefined, "BabyCoin")).toBeUndefined();
		expect(parseOptionalContractAddress("   ", "BabyCoin")).toBeUndefined();
	});

	it("accepts a valid public contract address", () => {
		expect(
			parseOptionalContractAddress(
				"0x1111111111111111111111111111111111111111",
				"BabyCoin",
			),
		).toBe("0x1111111111111111111111111111111111111111");
	});

	it("rejects invalid configured values without echoing them", () => {
		expect(() =>
			parseOptionalContractAddress("private-looking-value", "BabyCoin"),
		).toThrow("BabyCoin address must be a valid deployed contract address.");
	});

	it("encodes the exact approve and buy calls used by the two-step purchase", () => {
		const marketplace = "0x2222222222222222222222222222222222222222";
		expect(
			encodeFunctionData({
				abi: babyCoinAbi,
				functionName: "approve",
				args: [marketplace, 3n * 10n ** 18n],
			}),
		).toMatch(/^0x095ea7b3/);
		expect(
			encodeFunctionData({
				abi: taskMarketplaceAbi,
				functionName: "buy",
				args: [7n],
			}),
		).toMatch(/^0x/);
	});
});
