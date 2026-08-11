import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [rootPackage, workspace, contractsPackage, webPackage, viteConfig] =
	await Promise.all([
		readFile("package.json", "utf8"),
		readFile("pnpm-workspace.yaml", "utf8"),
		readFile("contracts/package.json", "utf8"),
		readFile("web/package.json", "utf8"),
		readFile("web/vite.config.ts", "utf8"),
	]);

assert.match(rootPackage, /"name": "babysteps"/);
assert.match(workspace, /contracts/);
assert.match(workspace, /web/);
assert.match(contractsPackage, /@babysteps\/contracts/);
assert.match(webPackage, /@babysteps\/web/);
assert.doesNotMatch(
	`${rootPackage}\n${contractsPackage}\n${webPackage}`,
	/@course-delivery/,
);
assert.match(viteConfig, /VITE_BASE_PATH/);
assert.match(viteConfig, /\?\? "\.\/"/);

console.log("Standalone BabySteps validation passed.");
