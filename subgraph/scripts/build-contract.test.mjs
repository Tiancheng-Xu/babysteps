import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("subgraph ABI export compiles the contract in a clean checkout", async () => {
	const packageJson = JSON.parse(
		await readFile(new URL("../package.json", import.meta.url), "utf8"),
	);
	assert.match(
		packageJson.scripts.abi,
		/pnpm --filter @babysteps\/contracts exec hardhat compile/u,
	);
	assert.match(packageJson.scripts.abi, /node scripts\/export-abi\.mjs/u);
});
