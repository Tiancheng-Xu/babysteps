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
	/(?:SEPOLIAPRIVATEKEY|ETHERSCANAPIKEY|SEPOLIARPCURL|VITE_ONCHAIN_NOTEBOOK_ADDRESS)/,
	"The Pages build must not receive contract-deployment credentials.",
);
assert.doesNotMatch(
	rootPackage,
	/VITE_ONCHAIN_NOTEBOOK_ADDRESS=/,
	"The build command must not override the committed production address.",
);
assert.match(
	productionEnv,
	/^VITE_ONCHAIN_NOTEBOOK_ADDRESS=0x[0-9a-fA-F]{40}\n?$/,
);

console.log("GitHub Pages workflow validation passed.");
