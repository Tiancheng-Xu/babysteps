import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("subgraph test runner is pinned to the matchstick dependency version", async () => {
	const manifest = JSON.parse(
		await readFile(new URL("../subgraph/package.json", import.meta.url), "utf8"),
	);
	const version = manifest.devDependencies["matchstick-as"];
	assert.equal(typeof version, "string");
	assert.match(manifest.scripts.test, new RegExp(`graph test -v ${version}$`));
});
