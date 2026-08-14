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

	it("deploys a fresh Sepolia notebook with the two keepsake contracts", () => {
		assert.equal(
			StarBuddyKeepsakesSepoliaModule.id,
			"StarBuddyKeepsakesSepoliaModule",
		);
		const moduleFutures = futures(StarBuddyKeepsakesSepoliaModule);
		assert.deepEqual(
			moduleFutures
				.filter((future) => future.type.includes("CONTRACT_DEPLOYMENT"))
				.map((future) => future.contractName)
				.sort(),
			["OnchainNotebook", "StarBuddyKeepsakeSBT", "StarBuddyKeepsakes"],
		);
		assert.equal(
			moduleFutures.some((future) => future.type.includes("CONTRACT_AT")),
			false,
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
			"verify:starbuddy:sepolia",
		]) {
			assert.ok(packageJson.scripts[script]);
		}
		assert.match(
			packageJson.scripts["deploy:starbuddy:sepolia"] ?? "",
			/--deployment-id babysteps-starbuddy-sepolia/u,
		);
		assert.match(
			packageJson.scripts["verify:starbuddy:sepolia"] ?? "",
			/runSepoliaStarBuddyClosedLoop\.ts --network sepoliaPublic/u,
		);
		const closedLoopScript = await readFile(
			new URL("../scripts/runSepoliaStarBuddyClosedLoop.ts", import.meta.url),
			"utf8",
		);
		assert.match(closedLoopScript, /addConsumer/u);
		assert.match(closedLoopScript, /requestDraw/u);
		assert.match(closedLoopScript, /readPreviousEvidence/u);
		assert.match(closedLoopScript, /transferableBalanceBeforeDraw/u);
		assert.match(closedLoopScript, /findIndex\(\(item\) => item\.hash/u);
		assert.match(
			closedLoopScript,
			/2026-08-14-starbuddy-sepolia-closed-loop\.json/u,
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

		for (let series = 0; series < 4; series += 1) {
			for (let rarity = 0; rarity < 4; rarity += 1) {
				const metadata = JSON.parse(
					await readFile(
						new URL(
							`../../web/public/metadata/keepsakes/${series}-${rarity}.json`,
							import.meta.url,
						),
						"utf8",
					),
				) as {
					name?: string;
					image?: string;
					attributes?: Array<{ trait_type: string; value: string }>;
				};
				assert.match(metadata.name ?? "", /星宝/u);
				assert.equal(
					metadata.image,
					"https://babysteps.baby2b.online/media/starbuddy-certificate.jpg",
				);
				assert.equal(metadata.attributes?.length, 3);
			}
		}
	});
});
