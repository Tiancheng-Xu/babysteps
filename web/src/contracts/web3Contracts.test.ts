import { encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";

import * as contractConfig from "./web3Contracts";
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

	it("pins the official Sepolia Uniswap v3 and test-token addresses", () => {
		expect(
			(contractConfig as Record<string, unknown>).uniswapV3Sepolia,
		).toEqual({
			factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
			quoterV2: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
			swapRouter02: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
			usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
			weth: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
			fee: 3_000,
		});
	});

	it("normalizes public app configuration without accepting secret material", () => {
		const parsePublicAppConfig = (contractConfig as Record<string, unknown>)
			.parsePublicAppConfig as
			| ((input: { privyAppId?: string; apiUrl?: string }) => unknown)
			| undefined;

		expect(
			parsePublicAppConfig?.({
				privyAppId: "  client-public-id  ",
				apiUrl: "https://api.babysteps.example/",
			}),
		).toEqual({
			privyAppId: "client-public-id",
			apiUrl: "https://api.babysteps.example",
		});
		expect(() =>
			parsePublicAppConfig?.({
				privyAppId: "secret-value",
				apiUrl: "http://localhost:8787",
			}),
		).toThrow("Privy app ID must be a public application identifier.");
	});
});
