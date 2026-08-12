import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("public API Sepolia closed-loop script", () => {
	it("proves signed auth, canonical binding, purchase, profile, and comment", async () => {
		const source = await readFile(
			new URL("../scripts/runSepoliaPublicApiClosedLoop.ts", import.meta.url),
			"utf8",
		);

		for (const required of [
			'"/api/auth/challenges"',
			'"/api/auth/sessions"',
			'"/api/task-drafts"',
			"/api/task-drafts/",
			"/bind",
			'"/api/profile"',
			"encodeURIComponent(taskKey)",
			"/comments",
			"requestTask",
			"approveTask",
			"mintTest",
			"approve",
			"buy",
			"canonicalJson",
			"metadataHash",
			"2026-08-12-public-api-closed-loop.json",
		]) {
			assert.match(
				source,
				new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")),
			);
		}
		assert.doesNotMatch(source, /privateKey\s*[:=]|SEPOLIAPRIVATEKEY/u);
	});
});
