import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [workflow, rootPackage, productionEnv] = await Promise.all([
	readFile(".github/workflows/pages.yml", "utf8"),
	readFile("package.json", "utf8"),
	readFile("web/.env.production", "utf8"),
]);

for (const fragment of [
	"name: BabySteps GitHub Pages",
	"branches:",
	"- main",
	"pages: write",
	"id-token: write",
	"pnpm check",
	"pnpm test",
	"pnpm typecheck",
	"pnpm build",
	"pnpm validate:public-artifact",
	"actions/upload-pages-artifact@v4",
	"path: web/dist",
	"actions/deploy-pages@v4",
	"pnpm install --frozen-lockfile",
	"node-version: 22",
	"version: 11.17.0",
]) {
	assert.ok(workflow.includes(fragment), `Missing Pages workflow contract: ${fragment}`);
}

const topLevelPermissions = workflow.match(/^permissions:\n(?:  .+\n)+/m)?.[0] ?? "";
const buildJob = workflow.match(/  build:[\s\S]*?(?=\n  deploy:)/)?.[0] ?? "";
const deployJob = workflow.match(/  deploy:[\s\S]*/)?.[0] ?? "";

assert.doesNotMatch(topLevelPermissions, /pages: write|id-token: write/);
assert.match(buildJob, /permissions:\n      contents: read/);
assert.match(deployJob, /permissions:\n      pages: write\n      id-token: write/);
assert.match(deployJob, /needs: build/);
assert.doesNotMatch(
	workflow,
	/(?:SEPOLIAPRIVATEKEY|ETHERSCANAPIKEY|SEPOLIARPCURL|VITE_(?:ONCHAIN_NOTEBOOK|BABY_COIN|GROWTH_ACTIVITIES|GROWTH_CERTIFICATE|TASK_MARKETPLACE)_ADDRESS)/,
	"The Pages build must not receive contract-deployment credentials.",
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

console.log("GitHub Pages workflow validation passed.");
