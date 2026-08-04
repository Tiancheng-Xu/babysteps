import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/pages.yml", "utf8");

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
]) {
	assert.ok(workflow.includes(fragment), `Missing Pages workflow contract: ${fragment}`);
}

assert.doesNotMatch(
	workflow,
	/(?:SEPOLIAPRIVATEKEY|ETHERSCANAPIKEY|SEPOLIARPCURL)/,
	"The Pages build must not receive contract-deployment credentials.",
);

console.log("GitHub Pages workflow validation passed.");
