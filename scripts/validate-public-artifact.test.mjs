import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const fixtureRoot = await mkdtemp(join(tmpdir(), "babysteps-artifact-"));

after(async () => {
	await rm(fixtureRoot, { force: true, recursive: true });
});

test("rejects an unprefixed 64-hex secret assigned to a Vite variable", async () => {
	await writeFile(join(fixtureRoot, "index.html"), "<!doctype html><title>BabySteps</title>");
	await writeFile(
		join(fixtureRoot, "private-key-fixture.js"),
		'const VITE_WALLET_SECRET = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";',
	);

	const result = spawnSync(
		process.execPath,
		["scripts/validate-public-artifact.mjs", fixtureRoot],
		{ encoding: "utf8" },
	);
	const output = `${result.stdout}\n${result.stderr}`;

	assert.notEqual(result.status, 0, "the public artifact validator accepted a wallet secret");
	assert.match(
		output,
		/contains a 32-byte value assigned to a secret-like variable/,
		"the validator failed for an unrelated reason",
	);
});
