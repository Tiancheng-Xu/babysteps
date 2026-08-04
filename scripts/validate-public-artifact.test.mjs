import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { after, test } from "node:test";

const fixturePath = "web/dist/private-key-fixture.js";

after(async () => {
	await rm(fixturePath, { force: true });
});

test("rejects an unprefixed 64-hex secret assigned to a Vite variable", async () => {
	await writeFile(
		fixturePath,
		'const VITE_WALLET_SECRET = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";',
	);

	const result = spawnSync(process.execPath, ["scripts/validate-public-artifact.mjs"], {
		encoding: "utf8",
	});

	assert.notEqual(result.status, 0, "the public artifact validator accepted a wallet secret");
});
