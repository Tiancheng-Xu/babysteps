import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import StarBuddyKeepsakesLocalModule from "../ignition/modules/StarBuddyKeepsakesLocal.js";
import StarBuddyKeepsakesSepoliaModule from "../ignition/modules/StarBuddyKeepsakesSepolia.js";

type FutureView = {
	id: string;
	type: string;
	contractName?: string;
	functionName?: string;
	args?: Array<{ id?: string } | string | bigint | number | boolean>;
};

function futures(module: { futures: Set<unknown> }) {
	return [...module.futures] as FutureView[];
}

describe("StarBuddy keepsake Ignition modules", () => {
	it("deploys an isolated local notebook, SBT, coordinator, and VRF mock", () => {
		assert.equal(
			StarBuddyKeepsakesLocalModule.id,
			"StarBuddyKeepsakesLocalModule",
		);
		assert.deepEqual(Object.keys(StarBuddyKeepsakesLocalModule.results), [
			"notebook",
			"keepsakeToken",
			"vrfCoordinator",
			"keepsakes",
		]);
		assert.deepEqual(
			futures(StarBuddyKeepsakesLocalModule)
				.filter((future) => future.type.includes("CONTRACT_DEPLOYMENT"))
				.map((future) => future.contractName)
				.sort(),
			[
				"MockVrfCoordinator",
				"OnchainNotebook",
				"StarBuddyKeepsakeSBT",
				"StarBuddyKeepsakes",
			],
		);
	});

	it("attaches to a configured Sepolia notebook and deploys only keepsake contracts", () => {
		assert.equal(
			StarBuddyKeepsakesSepoliaModule.id,
			"StarBuddyKeepsakesSepoliaModule",
		);
		const moduleFutures = futures(StarBuddyKeepsakesSepoliaModule);
		assert.ok(
			moduleFutures.some(
				(future) =>
					future.contractName === "OnchainNotebook" &&
					future.type.includes("CONTRACT_AT"),
			),
		);
		assert.deepEqual(
			moduleFutures
				.filter((future) => future.type.includes("CONTRACT_DEPLOYMENT"))
				.map((future) => future.contractName)
				.sort(),
			["StarBuddyKeepsakeSBT", "StarBuddyKeepsakes"],
		);
	});

	it("grants mint and burn roles and authorizes the coordinator to spend stars", () => {
		for (const module of [
			StarBuddyKeepsakesLocalModule,
			StarBuddyKeepsakesSepoliaModule,
		]) {
			const moduleFutures = futures(module);
			assert.deepEqual(
				moduleFutures
					.filter((future) => future.type === "STATIC_CALL")
					.map((future) => future.functionName)
					.sort(),
				["BURNER_ROLE", "MINTER_ROLE"],
			);
			assert.equal(
				moduleFutures.filter(
					(future) =>
						future.type === "CONTRACT_CALL" &&
						future.functionName === "grantRole",
				).length,
				2,
			);
			assert.equal(
				moduleFutures.some(
					(future) =>
						future.type === "CONTRACT_CALL" &&
						future.functionName === "setGrowthStarConsumer" &&
						future.args?.[1] === true,
				),
				true,
			);
		}
	});

	it("exposes resumable scripts, public parameters, and frontend placeholders", async () => {
		const packageJson = JSON.parse(
			await readFile(new URL("../package.json", import.meta.url), "utf8"),
		) as { scripts: Record<string, string> };
		for (const script of [
			"deploy:starbuddy:local",
			"deploy:starbuddy:sepolia",
		]) {
			assert.ok(packageJson.scripts[script]);
		}
		assert.match(
			packageJson.scripts["deploy:starbuddy:sepolia"] ?? "",
			/--deployment-id babysteps-starbuddy-sepolia/u,
		);

		const parameters = JSON.parse(
			await readFile(
				new URL(
					"../ignition/parameters/babysteps-web3-v2.sepolia.example.json",
					import.meta.url,
				),
				"utf8",
			),
		) as Record<string, Record<string, string | number>>;
		assert.equal(
			parameters.StarBuddyKeepsakesSepoliaModule?.metadataBaseUri,
			"https://babysteps.baby2b.online/metadata/keepsakes/",
		);
		assert.doesNotMatch(JSON.stringify(parameters), /private|mnemonic|rpcUrl/i);

		const envExample = await readFile(
			new URL("../../web/.env.example", import.meta.url),
			"utf8",
		);
		for (const variable of [
			"VITE_STARBUDDY_KEEPSAKE_SBT_ADDRESS",
			"VITE_STARBUDDY_KEEPSAKES_ADDRESS",
		]) {
			assert.match(envExample, new RegExp(`^${variable}=`, "m"));
		}
	});
});
