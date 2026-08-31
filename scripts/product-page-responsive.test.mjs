import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);

test("wide diagrams and hashes cannot expand the product page grid", async () => {
	const styles = await readFile("web/src/styles.css", "utf8");
	for (const selector of [
		"product-page",
		"performance-panel",
		"evidence-feature-proof",
		"evidence-diagrams",
		"evidence-diagram-card",
	]) {
		assert.match(
			styles,
			new RegExp(
				`\\.${selector}\\s*\\{[^}]*grid-template-columns:\\s*minmax\\(0,\\s*1fr\\)`,
				"su",
			),
		);
	}
	assert.match(
		styles,
		/\.evidence-screenshot-grid img\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%/su,
	);
	assert.match(
		styles,
		/\.performance-kpis\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/su,
	);
	assert.match(
		styles,
		/\.performance-kpis small\s*\{[^}]*overflow-wrap:\s*anywhere/su,
	);
	assert.match(
		styles,
		/\.performance-kpis strong,\s*\.performance-kpis small\s*\{[^}]*overflow-wrap:\s*anywhere/su,
	);
	assert.match(
		styles,
		/\.performance-kpis article\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/su,
	);
});

test("deep Evidence cards stay full width and downloadable proof links use emitted assets", async () => {
	const [styles, evidencePage, visualReadyScript] = await Promise.all([
		readFile("web/src/styles.css", "utf8"),
		readFile("web/src/pages/EvidencePage.tsx", "utf8"),
		readFile("backstop_data/engine_scripts/playwright/onReady.cjs", "utf8"),
	]);

	assert.match(
		styles,
		/\.evidence-requirement-map\s*>\s*div\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(280px,\s*1fr\)\)/su,
		"Evidence requirement cards must expand according to their actual count",
	);
	assert.match(
		styles,
		/\.evidence-requirement-map\s+article\s*\{[^}]*grid-template-columns:\s*minmax\(120px,\s*180px\)\s+minmax\(0,\s*1fr\)/su,
		"Evidence requirement labels must not consume the value column",
	);
	assert.match(
		evidencePage,
		/2026-08-30-implemented-feature-live-journey\.json\?url&no-inline/u,
		"machine evidence must be emitted as a navigable file instead of a data URL",
	);
	assert.match(
		evidencePage,
		/2026-08-30-implemented-feature-live-journey\.md\?url&no-inline/u,
		"implementation notes must be emitted as a navigable file instead of a data URL",
	);

	const backstop = require("../backstop.config.cjs");
	for (const scenario of backstop.scenarios.filter(({ label }) =>
		label.startsWith("product-route-"),
	)) {
		assert.deepEqual(
			scenario.selectors,
			["document"],
			`${scenario.label} must capture the full route, not only its first viewport`,
		);
	}
	assert.match(
		visualReadyScript,
		/animation:\s*none\s*!important/u,
		"visual captures must freeze animation before measuring the page",
	);
	assert.match(
		visualReadyScript,
		/setAttribute\("loading",\s*"eager"\)/u,
		"full-page captures must request lazy images before measuring the page",
	);
	assert.match(
		visualReadyScript,
		/\.decode\(\)/u,
		"full-page captures must wait for image decoding",
	);
	assert.match(
		visualReadyScript,
		/waitForLoadState\("networkidle"/u,
		"visual captures must wait for async product reads to settle",
	);
	assert.match(
		visualReadyScript,
		/font-family:\s*Arial,\s*"PingFang SC",\s*sans-serif\s*!important/u,
		"visual captures must use a pinned local font stack",
	);
});
