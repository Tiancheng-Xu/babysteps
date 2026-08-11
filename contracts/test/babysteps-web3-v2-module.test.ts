import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import BabyStepsWeb3V2Module from "../ignition/modules/BabyStepsWeb3V2.js";
import BabyStepsWeb3V2LocalModule from "../ignition/modules/BabyStepsWeb3V2Local.js";

type FutureView = {
	id: string;
	type: string;
	contractName?: string;
	functionName?: string;
	args?: Array<{ id?: string } | string | bigint | number>;
};

function futureViews(module: { futures: Set<unknown> }) {
	return [...module.futures] as FutureView[];
}

describe("BabySteps Web3 V2 Ignition modules", () => {
	it("attaches to the existing BabyCoin and deploys only the V2 contracts", () => {
		assert.equal(BabyStepsWeb3V2Module.id, "BabyStepsWeb3V2Module");
		assert.deepEqual(Object.keys(BabyStepsWeb3V2Module.results), [
			"babyCoin",
			"growthCertificateSBT",
			"taskMarketplaceV2",
		]);

		const futures = futureViews(BabyStepsWeb3V2Module);
		assert.ok(
			futures.some(
				(future) =>
					future.id === "BabyStepsWeb3V2Module#BabyCoin" &&
					future.type.includes("CONTRACT_AT"),
			),
		);
		assert.deepEqual(
			futures
				.filter((future) => future.type.includes("CONTRACT_DEPLOYMENT"))
				.map((future) => future.contractName)
				.sort(),
			["GrowthCertificateSBT", "TaskMarketplaceV2"],
		);
		assert.equal(
			futures.some((future) => future.contractName === "BabyCoin"),
			true,
		);
	});

	it("deploys an isolated local graph with a local token and mock coordinator", () => {
		assert.equal(BabyStepsWeb3V2LocalModule.id, "BabyStepsWeb3V2LocalModule");
		assert.deepEqual(Object.keys(BabyStepsWeb3V2LocalModule.results), [
			"coordinator",
			"babyCoin",
			"growthCertificateSBT",
			"taskMarketplaceV2",
		]);
		assert.deepEqual(
			futureViews(BabyStepsWeb3V2LocalModule)
				.filter((future) => future.type.includes("CONTRACT_DEPLOYMENT"))
				.map((future) => future.contractName)
				.sort(),
			[
				"BabyCoin",
				"GrowthCertificateSBT",
				"MockVrfCoordinator",
				"TaskMarketplaceV2",
			],
		);
	});

	it("grants only the SBT minter role inside each module", () => {
		for (const module of [BabyStepsWeb3V2Module, BabyStepsWeb3V2LocalModule]) {
			const futures = futureViews(module);
			const roleReads = futures.filter(
				(future) =>
					future.type === "STATIC_CALL" &&
					["MINTER_ROLE", "PROVIDER_ROLE", "COMPLETION_RELAYER_ROLE"].includes(
						future.functionName ?? "",
					),
			);
			assert.deepEqual(
				roleReads.map((future) => future.functionName),
				["MINTER_ROLE"],
			);
			const roleGrants = futures.filter(
				(future) =>
					future.type === "CONTRACT_CALL" &&
					future.functionName === "grantRole",
			);
			assert.equal(roleGrants.length, 1);
			assert.equal(
				(roleGrants[0]?.args?.[1] as { id?: string })?.id,
				`${module.id}#TaskMarketplaceV2`,
			);
		}
	});

	it("exposes safe scripts, public parameters, and frontend placeholders", async () => {
		const packageJson = JSON.parse(
			await readFile(new URL("../package.json", import.meta.url), "utf8"),
		) as { scripts: Record<string, string> };
		for (const script of [
			"deploy:web3:v2:local",
			"deploy:web3:v2:sepolia",
			"deploy:web3:v2:verify:sepolia",
			"finalize:web3:v2:sepolia",
		]) {
			assert.ok(packageJson.scripts[script]);
		}
		for (const script of [
			"deploy:web3:v2:sepolia",
			"deploy:web3:v2:verify:sepolia",
		]) {
			assert.match(
				packageJson.scripts[script] ?? "",
				/--deployment-id babysteps-sepolia-v2/u,
			);
		}
		const finalizeSource = await readFile(
			new URL("../scripts/finalizeSepoliaV2.ts", import.meta.url),
			"utf8",
		);
		assert.match(
			finalizeSource,
			/ignition\/deployments\/babysteps-sepolia-v2\/deployed_addresses\.json/u,
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
			parameters.BabyStepsWeb3V2Module?.babyCoinAddress,
			"0x108a55217011983b93C3A95aD8D3B3343Bd5471b",
		);
		assert.equal(parameters.BabyStepsWeb3V2Module?.vrfSubscriptionId, "0");
		assert.doesNotMatch(JSON.stringify(parameters), /private|mnemonic|rpcUrl/i);

		const envExample = await readFile(
			new URL("../../web/.env.example", import.meta.url),
			"utf8",
		);
		for (const variable of [
			"VITE_GROWTH_CERTIFICATE_SBT_ADDRESS",
			"VITE_TASK_MARKETPLACE_V2_ADDRESS",
		]) {
			assert.match(envExample, new RegExp(`^${variable}=`, "m"));
		}
	});

	it("defines a resumable Sepolia V2 business loop with temporary relayer access", async () => {
		const packageJson = JSON.parse(
			await readFile(new URL("../package.json", import.meta.url), "utf8"),
		) as { scripts: Record<string, string> };
		assert.match(
			packageJson.scripts["business:closed-loop:v2:sepolia"] ?? "",
			/runSepoliaV2BusinessClosedLoop\.ts --network sepoliaPublic/u,
		);

		const businessSource = await readFile(
			new URL("../scripts/runSepoliaV2BusinessClosedLoop.ts", import.meta.url),
			"utf8",
		);
		for (const requiredSource of [
			"ignition/deployments/babysteps-sepolia-v2/deployed_addresses.json",
			"requestTask",
			"approveTask",
			"COMPLETION_RELAYER_ROLE",
			"grantRole",
			"revokeRole",
			"finally",
			"2026-08-11-sepolia-v2-business.json",
		]) {
			assert.match(businessSource, new RegExp(requiredSource));
		}
	});
});
