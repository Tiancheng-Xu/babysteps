import assert from "node:assert/strict";
import { describe, it } from "node:test";

const modulePath = "../scripts/lib/rpcComparison.js";

describe("Sepolia RPC comparison", () => {
	it("normalizes provider output before comparing independent RPCs", async () => {
		const subject = await import(modulePath).catch(() => undefined);
		assert.ok(subject, "rpc comparison module should exist");

		const normalized = subject.normalizeRpcObservation({
			provider: "public",
			latencyMs: 82,
			chainId: 11155111n,
			latestBlock: 11_500_123,
			balance: 500000000000000000n,
			transaction: {
				hash: `0x${"a".repeat(64)}`,
				blockNumber: 11_453_259,
				from: "0x4D9Df519AbCBE51C0098649bCd0e17ac1548Fa88",
				to: "0x2D1107610eBaBbFa7CD9569eb42eF315eb6F25BE",
				value: 0n,
			},
			receipt: {
				status: 1,
				blockNumber: 11_453_259,
				gasUsed: 123456n,
				logs: [
					{
						address: "0x2D1107610eBaBbFa7CD9569eb42eF315eb6F25BE",
						topics: [`0x${"b".repeat(64)}`],
						data: "0x",
					},
				],
			},
		});

		assert.deepEqual(normalized, {
			provider: "public",
			latencyMs: 82,
			chainId: "11155111",
			latestBlock: 11_500_123,
			balanceWei: "500000000000000000",
			transaction: {
				hash: `0x${"a".repeat(64)}`,
				blockNumber: 11_453_259,
				from: "0x4d9df519abcbe51c0098649bcd0e17ac1548fa88",
				to: "0x2d1107610ebabbfa7cd9569eb42ef315eb6f25be",
				valueWei: "0",
			},
			receipt: {
				status: 1,
				blockNumber: 11_453_259,
				gasUsed: "123456",
				logs: [
					{
						address: "0x2d1107610ebabbfa7cd9569eb42ef315eb6f25be",
						topics: [`0x${"b".repeat(64)}`],
						data: "0x",
					},
				],
			},
		});
	});

	it("compares facts while ignoring provider timing and latest-head drift", async () => {
		const subject = await import(modulePath).catch(() => undefined);
		assert.ok(subject, "rpc comparison module should exist");
		const base = {
			provider: "public",
			latencyMs: 40,
			chainId: "11155111",
			latestBlock: 100,
			balanceWei: "7",
			transaction: { hash: "0x1", blockNumber: 90 },
			receipt: { status: 1, blockNumber: 90, logs: [] },
		};

		assert.deepEqual(
			subject.compareRpcObservations([
				base,
				{ ...base, provider: "infura", latencyMs: 90, latestBlock: 101 },
				{ ...base, provider: "alchemy", latencyMs: 65, latestBlock: 102 },
			]),
			{ consistent: true, mismatches: [] },
		);
	});

	it("redacts RPC URLs and reports providers that are not configured", async () => {
		const subject = await import(modulePath).catch(() => undefined);
		assert.ok(subject, "rpc comparison module should exist");

		assert.deepEqual(
			subject.buildProviderTargets({
				PUBLIC_SEPOLIA_RPC_URL: "https://public.example",
				INFURA_SEPOLIA_RPC_URL: "https://sepolia.infura.io/v3/private-key",
			}),
			[
				{ name: "public", status: "configured", url: "https://public.example" },
				{
					name: "infura",
					status: "configured",
					url: "https://sepolia.infura.io/v3/private-key",
				},
				{ name: "alchemy", status: "not-configured" },
			],
		);
		assert.equal(
			subject.redactRpcUrl("https://sepolia.infura.io/v3/private-key"),
			"https://sepolia.infura.io/v3/[redacted]",
		);
	});

	it("reads one transaction and its receipt through a provider boundary", async () => {
		const subject = await import(modulePath);
		const provider = {
			getNetwork: async () => ({ chainId: 11155111n }),
			getBlockNumber: async () => 11500123,
			getBalance: async () => 7n,
			getTransaction: async () => ({
				hash: `0x${"c".repeat(64)}`,
				blockNumber: 11453259,
				from: "0x4D9Df519AbCBE51C0098649bCd0e17ac1548Fa88",
				to: "0x2D1107610eBaBbFa7CD9569eb42eF315eb6F25BE",
				value: 0n,
			}),
			getTransactionReceipt: async () => ({
				status: 1,
				blockNumber: 11453259,
				gasUsed: 456n,
				logs: [
					{
						address: "0x2D1107610eBaBbFa7CD9569eb42eF315eb6F25BE",
						topics: [`0x${"d".repeat(64)}`],
						data: "0x",
					},
				],
			}),
		};
		const clock = [1_000, 1_047];

		const result = await subject.readRpcObservation(
			"public",
			provider,
			`0x${"c".repeat(64)}`,
			"0x4D9Df519AbCBE51C0098649bCd0e17ac1548Fa88",
			() => clock.shift() ?? 0,
		);

		assert.equal(result?.latencyMs, 47);
		assert.equal(result?.receipt.gasUsed, 456n);
		assert.equal(result?.transaction.blockNumber, 11453259);
	});
});
