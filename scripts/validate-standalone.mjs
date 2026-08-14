import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function validateStandaloneDelivery({
	rootPackage,
	workspace,
	contractsPackage,
	webPackage,
	viteConfig,
	renderingManifest,
}) {
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

	const manifest = JSON.parse(renderingManifest);
	if (manifest.delivery === "cloudflare-pages-advanced-worker") {
		assert.equal(manifest.rendering, "edge-ssr-hydration-csr-fallback");
		assert.match(viteConfig, /VITE_BASE_PATH \?\? loadedEnv\.VITE_BASE_PATH \?\? "\/"/);
		assert.doesNotMatch(viteConfig, /\?\? "\.\/"/);
		return;
	}

	assert.match(viteConfig, /\?\? "\.\/"/);
}

async function main() {
	const [
		rootPackage,
		workspace,
		contractsPackage,
		webPackage,
		viteConfig,
		renderingManifest,
	] = await Promise.all([
		readFile("package.json", "utf8"),
		readFile("pnpm-workspace.yaml", "utf8"),
		readFile("contracts/package.json", "utf8"),
		readFile("web/package.json", "utf8"),
		readFile("web/vite.config.ts", "utf8"),
		readFile("web/public/rendering-manifest.json", "utf8"),
	]);

	validateStandaloneDelivery({
		rootPackage,
		workspace,
		contractsPackage,
		webPackage,
		viteConfig,
		renderingManifest,
	});
	console.log("Standalone BabySteps delivery validation passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
