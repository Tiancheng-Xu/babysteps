import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

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
