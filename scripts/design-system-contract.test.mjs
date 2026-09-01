import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { validateDesignSystem } from "./validate-design-system.mjs";

test("the shipped stylesheet satisfies the BabySteps design-system contract", () => {
	const result = spawnSync(
		process.execPath,
		["scripts/validate-design-system.mjs", "web/src/styles.css"],
		{
			cwd: process.cwd(),
			encoding: "utf8",
		},
	);

	assert.equal(
		result.status,
		0,
		`design-system validation failed:\n${result.stdout}${result.stderr}`,
	);
	assert.match(result.stdout, /DESIGN_SYSTEM_PASS/u);
});

test("the validator rejects touch targets smaller than 44 pixels", async () => {
	const styles = await readFile("web/src/styles.css", "utf8");
	const undersizedButton = styles.replace(
		/min-height:\s*48px/u,
		"min-height: 40px",
	);

	assert.ok(
		validateDesignSystem(undersizedButton).includes(
			"primary controls must keep a 44px minimum touch target",
		),
	);
});

test("the validator rejects a state label that loses WCAG AA contrast", async () => {
	const styles = await readFile("web/src/styles.css", "utf8");
	const unreadableWarning = styles.replace(
		/--color-state-warning-text:\s*#[0-9a-f]{6}/iu,
		"--color-state-warning-text: #f8dfc6",
	);

	assert.match(
		validateDesignSystem(unreadableWarning).join("\n"),
		/--color-state-warning-text on --color-state-warning-surface has 1\.00:1 contrast/u,
	);
});

test("the validator requires a primary action color with readable text", async () => {
	const styles = await readFile("web/src/styles.css", "utf8");
	const missingPrimaryAction = styles.replace(
		/^\s*--color-action-primary:[^;]+;\s*$/mu,
		"",
	);

	assert.ok(
		validateDesignSystem(missingPrimaryAction).includes(
			"missing semantic token --color-action-primary",
		),
	);
});
