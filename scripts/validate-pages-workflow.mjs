import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const [manifest, verifier, workflowNames, rootPackage, productionEnv] =
	await Promise.all([
		readFile(".github/baby2b-publish.yml", "utf8"),
		readFile(".github/workflows/verify-baby2b-project.yml", "utf8"),
		readdir(".github/workflows"),
	readFile("package.json", "utf8"),
	readFile("web/.env.production", "utf8"),
]);

assert.ok(!workflowNames.includes("pages.yml"), "GitHub Pages publisher must be removed.");
for (const fragment of [
	"production-branch: main",
	"build-command: pnpm --filter @babysteps/web build",
	"output-directory: web/dist",
	"pages-project: babysteps",
	"production-url: https://babysteps.baby2b.online/",
	"evidence-url: https://babysteps.baby2b.online/evidence/",
]) {
	assert.ok(manifest.includes(fragment), `Missing Cloudflare publishing contract: ${fragment}`);
}

assert.match(verifier, /permissions:\n  contents: read/);
assert.match(
	verifier,
	/Tiancheng-Xu\/.github\/.github\/workflows\/verify-project\.yml@main/,
);
for (const fragment of [
	"static-first-output: web/dist",
	"static-first-routes: /,/tasks,/keepsakes,/evidence,/parent,/provider,/exchange,/profile,/performance",
	"static-first-mode: edge-ssr",
	"static-first-rendering-manifest: web/public/rendering-manifest.json",
	"static-first-server-artifact: web/dist/_worker.js",
	"static-first-runtime-command: pnpm validate:rendering-runtime",
]) {
	assert.ok(verifier.includes(fragment), `Missing Static-First contract: ${fragment}`);
}
assert.doesNotMatch(
	verifier,
	/actions\/deploy-pages|wrangler pages deploy|pages: write/,
	"GitHub Actions verifies but must not publish the Cloudflare production site.",
);
assert.doesNotMatch(
	verifier,
	/(?:SEPOLIAPRIVATEKEY|ETHERSCANAPIKEY|SEPOLIARPCURL|VITE_(?:ONCHAIN_NOTEBOOK|BABY_COIN|GROWTH_ACTIVITIES|GROWTH_CERTIFICATE|TASK_MARKETPLACE)_ADDRESS)/,
	"The shared verification workflow must not receive deployment credentials.",
);
assert.doesNotMatch(
	rootPackage,
	/VITE_(?:ONCHAIN_NOTEBOOK|BABY_COIN|GROWTH_ACTIVITIES|GROWTH_CERTIFICATE|TASK_MARKETPLACE)_ADDRESS=/,
	"The build command must not override the committed production address.",
);

const productionAddresses = Object.fromEntries(
	productionEnv
		.trim()
		.split("\n")
		.map((line) => line.split("=", 2)),
);
for (const variable of [
	"VITE_ONCHAIN_NOTEBOOK_ADDRESS",
	"VITE_BABY_COIN_ADDRESS",
	"VITE_GROWTH_ACTIVITIES_ADDRESS",
	"VITE_GROWTH_CERTIFICATE_ADDRESS",
	"VITE_TASK_MARKETPLACE_ADDRESS",
]) {
	assert.match(
		productionAddresses[variable] ?? "",
		/^0x[0-9a-fA-F]{40}$/,
		`${variable} must contain one deployed contract address.`,
	);
}

console.log("Cloudflare Git Integration publishing contract validation passed.");
