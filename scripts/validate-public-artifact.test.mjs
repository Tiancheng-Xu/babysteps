import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const fixtureRoot = await mkdtemp(join(tmpdir(), "babysteps-artifact-"));
const forbiddenProductLabel = String.fromCodePoint(
	0x68,
	0x6f,
	0x6d,
	0x65,
	0x77,
	0x6f,
	0x72,
	0x6b,
);

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

test("ignores non-product copy inside a dependency chunk", async () => {
	await rm(join(fixtureRoot, "private-key-fixture.js"), { force: true });
	await mkdir(join(fixtureRoot, "assets"), { recursive: true });
	await writeFile(
		join(fixtureRoot, "index.html"),
		'<!doctype html><script type="module" src="./assets/index-safe.js"></script>',
	);
	await writeFile(
		join(fixtureRoot, "assets", "index-safe.js"),
		'import "./ConnectWalletView-vendor.js"; console.log("BabySteps");',
	);
	await writeFile(
		join(fixtureRoot, "assets", "ConnectWalletView-vendor.js"),
		'const internalDependencyLabel = "assignment";',
	);

	const result = spawnSync(
		process.execPath,
		["scripts/validate-public-artifact.mjs", fixtureRoot],
		{ encoding: "utf8" },
	);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("still rejects non-product copy in the application entry chunk", async () => {
	await mkdir(join(fixtureRoot, "assets"), { recursive: true });
	await writeFile(
		join(fixtureRoot, "index.html"),
		'<!doctype html><script type="module" src="./assets/index-entry.js"></script>',
	);
	await writeFile(
		join(fixtureRoot, "assets", "index-entry.js"),
		`console.log("${forbiddenProductLabel}");`,
	);

	const result = spawnSync(
		process.execPath,
		["scripts/validate-public-artifact.mjs", fixtureRoot],
		{ encoding: "utf8" },
	);
	assert.notEqual(result.status, 0);
	assert.match(`${result.stdout}\n${result.stderr}`, /non-product public copy/);
});

test("allows a dependency cryptography constant but still rejects its secret assignments", async () => {
	await rm(join(fixtureRoot, "assets", "index-entry.js"), { force: true });
	const vendorPath = join(fixtureRoot, "assets", "crypto-vendor.js");
	await writeFile(
		vendorPath,
		'const fieldPrime = "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed";',
	);

	let result = spawnSync(
		process.execPath,
		["scripts/validate-public-artifact.mjs", fixtureRoot],
		{ encoding: "utf8" },
	);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

	await writeFile(
		vendorPath,
		'const VITE_WALLET_SECRET = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";',
	);
	result = spawnSync(
		process.execPath,
		["scripts/validate-public-artifact.mjs", fixtureRoot],
		{ encoding: "utf8" },
	);
	assert.notEqual(result.status, 0);
	assert.match(
		`${result.stdout}\n${result.stderr}`,
		/32-byte value assigned to a secret-like variable/,
	);
});

test("allows generic dependency terminology in a bundled application entry", async () => {
	await rm(join(fixtureRoot, "assets", "crypto-vendor.js"), { force: true });
	await writeFile(
		join(fixtureRoot, "assets", "index-entry.js"),
		'console.log("assignment");',
	);

	const result = spawnSync(
		process.execPath,
		["scripts/validate-public-artifact.mjs", fixtureRoot],
		{ encoding: "utf8" },
	);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
