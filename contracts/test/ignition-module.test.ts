import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import OnchainNotebookModule from "../ignition/modules/OnchainNotebook.js";

describe("OnchainNotebook Ignition module", () => {
	it("exports the notebook module and deploys only OnchainNotebook", () => {
		assert.equal(OnchainNotebookModule.id, "OnchainNotebookModule");
		assert.deepEqual(Object.keys(OnchainNotebookModule.results), ["notebook"]);
		assert.equal(OnchainNotebookModule.futures.size, 1);
		assert.equal(
			OnchainNotebookModule.results.notebook.contractName,
			"OnchainNotebook",
		);
	});

	it("documents secret variable names and both Sepolia deployment commands", async () => {
		const readme = await readFile(
			new URL("../../README.md", import.meta.url),
			"utf8",
		);

		for (const variable of [
			"SEPOLIA_RPC_URL",
			"SEPOLIA_PRIVATE_KEY",
			"ETHERSCAN_API_KEY",
		]) {
			assert.match(readme, new RegExp(variable));
		}

		assert.match(
			readme,
			/pnpm --filter @course-homework\/web3-contracts deploy:sepolia/,
		);
		assert.match(
			readme,
			/pnpm --filter @course-homework\/web3-contracts deploy:verify:sepolia/,
		);
		assert.doesNotMatch(readme, /https?:\/\//i);
		assert.doesNotMatch(
			readme,
			/(?:private.?key|api.?key|rpc.?url)\s*=\s*.{12,}/i,
		);
	});
});
