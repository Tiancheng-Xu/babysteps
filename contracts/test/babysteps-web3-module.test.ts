import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import BabyStepsWeb3Module from "../ignition/modules/BabyStepsWeb3.js";

type FutureView = {
	id: string;
	type: string;
	contractName?: string;
	functionName?: string;
	args?: Array<{ id?: string } | string | bigint | number>;
};

describe("BabySteps Web3 Ignition module", () => {
	it("deploys the four-contract graph and wires internal plus demo operator roles", () => {
		assert.equal(BabyStepsWeb3Module.id, "BabyStepsWeb3Module");
		assert.deepEqual(Object.keys(BabyStepsWeb3Module.results), [
			"babyCoin",
			"growthActivities",
			"growthCertificate",
			"taskMarketplace",
		]);

		const futures = [...BabyStepsWeb3Module.futures] as FutureView[];
		const deployments = futures
			.filter((future) => future.contractName !== undefined)
			.map((future) => future.contractName)
			.sort();
		assert.deepEqual(deployments, [
			"BabyCoin",
			"GrowthActivities",
			"GrowthCertificate",
			"TaskMarketplace",
		]);

		const roleGrants = futures.filter(
			(future) =>
				future.type === "CONTRACT_CALL" && future.functionName === "grantRole",
		);
		assert.equal(roleGrants.length, 4);
		const roleReads = futures.filter(
			(future) =>
				future.type === "STATIC_CALL" &&
				["REWARD_ROLE", "MINTER_ROLE", "PROVIDER_ROLE", "ORACLE_ROLE"].includes(
					future.functionName ?? "",
				),
		);
		assert.equal(roleReads.length, 4);
		assert.deepEqual(
			roleGrants
				.map((future) => {
					const recipient = future.args?.[1];
					return typeof recipient === "object" ? recipient.id : undefined;
				})
				.filter((recipient) => recipient !== undefined)
				.sort(),
			[
				"BabyStepsWeb3Module#GrowthActivities",
				"BabyStepsWeb3Module#TaskMarketplace",
			],
		);
	});

	it("exposes safe deployment scripts and frontend address placeholders", async () => {
		const packageJson = JSON.parse(
			await readFile(new URL("../package.json", import.meta.url), "utf8"),
		) as { scripts: Record<string, string> };
		for (const script of [
			"deploy:web3:local",
			"deploy:web3:sepolia",
			"deploy:web3:verify:sepolia",
			"inspect:sepolia",
			"prepare:vrf:sepolia",
			"configure:vrf:sepolia",
			"deploy:web3:closed-loop:sepolia",
			"finalize:web3:sepolia",
		]) {
			assert.ok(packageJson.scripts[script]);
		}
		assert.match(
			packageJson.scripts["prepare:vrf:sepolia"],
			/--network sepoliaPublic$/,
		);

		const vrfPreparation = await readFile(
			new URL("../scripts/prepareSepoliaVrf.ts", import.meta.url),
			"utf8",
		);
		assert.match(
			vrfPreparation,
			/TARGET_NATIVE_BALANCE = parseEther\("0\.5"\)/,
		);

		const envExample = await readFile(
			new URL("../../web/.env.example", import.meta.url),
			"utf8",
		);
		for (const variable of [
			"VITE_BABY_COIN_ADDRESS",
			"VITE_GROWTH_ACTIVITIES_ADDRESS",
			"VITE_GROWTH_CERTIFICATE_ADDRESS",
			"VITE_TASK_MARKETPLACE_ADDRESS",
		]) {
			assert.match(envExample, new RegExp(`^${variable}=`, "m"));
		}
	});

	it("exposes a resumable Sepolia business closed-loop runner", async () => {
		const packageJson = JSON.parse(
			await readFile(new URL("../package.json", import.meta.url), "utf8"),
		) as { scripts: Record<string, string> };
		assert.ok(packageJson.scripts["business:closed-loop:sepolia"]);

		const runner = await readFile(
			new URL("../scripts/runSepoliaBusinessClosedLoop.ts", import.meta.url),
			"utf8",
		);
		for (const checkpoint of [
			"createTask",
			"waitForTaskActivation",
			"recordActivity",
			"approve",
			"buy",
			"confirmCompletion",
			"verifyClosedLoop",
		]) {
			assert.match(runner, new RegExp(checkpoint));
		}
		assert.doesNotMatch(
			runner,
			/(?:privateKey|mnemonic|SEPOLIA_DEPLOYER_PRIVATE_KEY)/i,
		);
	});
});
