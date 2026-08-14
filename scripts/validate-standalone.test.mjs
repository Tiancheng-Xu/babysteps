import assert from "node:assert/strict";
import { test } from "node:test";
import { validateStandaloneDelivery } from "./validate-standalone.mjs";

const baseInput = {
	rootPackage: '{"name": "babysteps"}',
	workspace: "packages:\n  - contracts\n  - web",
	contractsPackage: '{"name": "@babysteps/contracts"}',
	webPackage: '{"name": "@babysteps/web"}',
	VITE_BASE_PATH: "",
};

test("requires root-relative assets for the Pages Advanced Worker", () => {
	assert.doesNotThrow(() =>
		validateStandaloneDelivery({
			...baseInput,
			viteConfig:
				'const base = process.env.VITE_BASE_PATH ?? loadedEnv.VITE_BASE_PATH ?? "/";',
			renderingManifest: JSON.stringify({
				delivery: "cloudflare-pages-advanced-worker",
				rendering: "edge-ssr-hydration-csr-fallback",
			}),
		}),
	);
});

test("rejects relative asset bases that break History API deep links", () => {
	assert.throws(
		() =>
			validateStandaloneDelivery({
				...baseInput,
				viteConfig:
					'const base = process.env.VITE_BASE_PATH ?? loadedEnv.VITE_BASE_PATH ?? "./";',
				renderingManifest: JSON.stringify({
					delivery: "cloudflare-pages-advanced-worker",
					rendering: "edge-ssr-hydration-csr-fallback",
				}),
			}),
		/loadedEnv\.VITE_BASE_PATH/u,
	);
});

test("keeps relative bases valid for explicitly static-only delivery", () => {
	assert.doesNotThrow(() =>
		validateStandaloneDelivery({
			...baseInput,
			viteConfig:
				'const base = process.env.VITE_BASE_PATH ?? loadedEnv.VITE_BASE_PATH ?? "./";',
			renderingManifest: JSON.stringify({
				delivery: "static-files",
				rendering: "csr",
			}),
		}),
	);
});
