import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runBuild, selectBuildTargets } from "./build.mjs";

test("Cloudflare Pages builds only the Web workspace", () => {
	assert.deepEqual(selectBuildTargets({ CF_PAGES: "1" }), ["@babysteps/web"]);
});

test("other environments keep the complete ordered build", () => {
	assert.deepEqual(selectBuildTargets({}), [
		"@babysteps/aws",
		"@babysteps/contracts",
		"@babysteps/web",
		"@babysteps/worker",
		"@babysteps/subgraph",
	]);
});

test("the root build delegates to the routing entry point", async () => {
	const pkg = JSON.parse(await readFile("package.json", "utf8"));
	assert.equal(pkg.scripts.build, "node scripts/build.mjs");
});

test("stops at the first failed workspace build", () => {
	const calls = [];
	const status = runBuild(["first", "second"], (_command, args) => {
		calls.push(args[1]);
		return { status: args[1] === "first" ? 7 : 0 };
	});

	assert.equal(status, 7);
	assert.deepEqual(calls, ["first"]);
});
