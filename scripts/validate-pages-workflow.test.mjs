import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("uses Cloudflare Git Integration as the only production publisher", () => {
	assert.equal(existsSync(".github/workflows/pages.yml"), false);

	const manifest = readFileSync(".github/baby2b-publish.yml", "utf8");
	const verifier = readFileSync(
		".github/workflows/verify-baby2b-project.yml",
		"utf8",
	);
	assert.match(manifest, /^production-branch: main$/m);
	assert.match(manifest, /^pages-project: babysteps$/m);
	assert.match(manifest, /^output-directory: web\/dist$/m);
	assert.match(
		manifest,
		/^evidence-url: https:\/\/babysteps\.baby2b\.online\/evidence\/$/m,
	);
	assert.match(verifier, /permissions:\n  contents: read/);
	assert.match(
		verifier,
		/Tiancheng-Xu\/.github\/.github\/workflows\/verify-project\.yml@main/,
	);
	for (const contract of [
		"static-first-output: web/dist",
		"static-first-mode: edge-ssr",
		"static-first-rendering-manifest: web/public/rendering-manifest.json",
		"static-first-server-artifact: web/dist/_worker.js",
		"static-first-runtime-command: pnpm validate:rendering-runtime",
	]) {
		assert.ok(verifier.includes(contract), `Missing Static-First contract: ${contract}`);
	}

	const workflowText = [
		readFileSync(".github/workflows/repository-policy.yml", "utf8"),
		verifier,
	].join("\n");
	assert.doesNotMatch(workflowText, /actions\/deploy-pages|wrangler pages deploy/);
});

test("keeps reciprocal navigation available without JavaScript", () => {
	const html = readFileSync("web/index.html", "utf8");
	assert.match(html, /<noscript>/);
	assert.match(html, /https:\/\/baby2b\.online\//);
	assert.match(html, /https:\/\/babysteps\.baby2b\.online\//);
	assert.match(html, /https:\/\/evidence\.baby2b\.online\/babysteps\//);
	assert.match(html, /作品集首页[\s\S]*项目主页[\s\S]*工作证明/);
});
