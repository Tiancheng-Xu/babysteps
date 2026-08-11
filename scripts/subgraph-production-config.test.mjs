import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const manifest = await readFile(
	new URL("../subgraph/subgraph.yaml", import.meta.url),
	"utf8",
);

test("Subgraph starts at the verified V2 marketplace deployment", () => {
	assert.match(
		manifest,
		/address: "0x2EE9fAFE99e143e5a1376805753D026bDac715de"/u,
	);
	assert.match(manifest, /startBlock: 11467677/u);
	assert.doesNotMatch(manifest, /address: "0x0{40}"/u);
});
