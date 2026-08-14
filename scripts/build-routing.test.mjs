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

test("the Web build produces one Cloudflare client and edge SSR artifact", async () => {
	const [pkg, clientConfig, workerConfig, buildScript, manifest] =
		await Promise.all([
			readFile("web/package.json", "utf8").then(JSON.parse),
			readFile("web/vite.config.ts", "utf8"),
			readFile("web/vite.ssr.config.ts", "utf8"),
			readFile("web/scripts/build-pages.mjs", "utf8"),
			readFile("web/public/rendering-manifest.json", "utf8").then(JSON.parse),
		]);
	assert.equal(pkg.scripts.build, "tsc -b && node scripts/build-pages.mjs");
	assert.match(clientConfig, /outDir: "dist-client"/);
	assert.match(workerConfig, /target: "webworker"/);
	assert.match(workerConfig, /entryFileNames: "_worker\.js"/);
	assert.match(buildScript, /verifyPagesOutput/);
	assert.match(buildScript, /browserOnlyRuntimeMarkers/);
	assert.match(
		buildScript,
		/Server bundle contains browser-only runtime marker/,
	);
	assert.match(buildScript, /validateBuiltRenderingRuntime/);
	assert.equal(manifest.rendering, "edge-ssr-hydration-csr-fallback");
	assert.equal(manifest.fallback.maximumClientRemounts, 1);
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
