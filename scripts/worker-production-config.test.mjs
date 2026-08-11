import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const config = JSON.parse(
	await readFile(new URL("../worker/wrangler.jsonc", import.meta.url), "utf8"),
);

test("Worker production config binds the verified Sepolia V2 deployment", () => {
	assert.equal(config.name, "babysteps-worker");
	assert.equal(config.vars.CHAIN_ID, "11155111");
	assert.equal(
		config.vars.OWNER_WALLET,
		"0x4D9Df519AbCBE51C0098649bCd0e17ac1548Fa88",
	);
	assert.equal(
		config.vars.MARKETPLACE_V2_ADDRESS,
		"0x2EE9fAFE99e143e5a1376805753D026bDac715de",
	);
	assert.equal(
		config.d1_databases[0].database_id,
		"82d96e36-2adc-44f7-93b2-aeb19c075d09",
	);
	assert.deepEqual(config.routes, [
		{
			pattern: "babysteps-api.baby2b.online",
			custom_domain: true,
		},
	]);
	assert.doesNotMatch(JSON.stringify(config.vars), /0x0{40}/u);
});
