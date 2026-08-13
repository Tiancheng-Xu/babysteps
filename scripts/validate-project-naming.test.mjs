import assert from "node:assert/strict";
import { test } from "node:test";
import {
	trackedText,
	validateProjectNaming,
} from "./validate-project-naming.mjs";

const aliases = [
	String.fromCodePoint(0x68, 0x6f, 0x6d, 0x65, 0x77, 0x6f, 0x72, 0x6b),
	String.fromCodePoint(0x79, 0x69, 0x64, 0x65, 0x6e, 0x67),
	String.fromCodePoint(0x79, 0x64),
];

test("rejects academic tokens in project paths, refs, and ordinary content", () => {
	const violations = validateProjectNaming({
		contents: new Map([["README.md", `A ${aliases[0]} platform`]]),
		paths: [`docs/${aliases[0]}/map.md`],
		refs: [`feature/${aliases[2]}-market`, `feature/${aliases[1]}-release`],
	});

	assert.deepEqual(
		violations.map(({ scope }) => scope).sort(),
		["content", "path", "ref", "ref"],
	);
});

test("allows only exact protected AWS legacy identifiers in approved files", () => {
	const violations = validateProjectNaming({
		contents: new Map([
			[
				"aws/bootstrap.yaml",
				`Default: babysteps-${aliases[0]}-readiness\nTag: ${aliases[0]}-readiness`,
			],
			[
				"docs/evidence/deployment/2026-08-11-aws-pausable.json",
				`{"stack":"babysteps-${aliases[0]}-readiness","db":"babysteps-${aliases[0]}-readiness-postgres"}`,
			],
		]),
		paths: [],
		refs: [],
	});

	assert.deepEqual(violations, []);
});

test("rejects protected identifiers outside the exact allowlisted files", () => {
	const violations = validateProjectNaming({
		contents: new Map([
			["README.md", `babysteps-${aliases[0]}-readiness`],
			["docs/notes.md", `${aliases[0]}-readiness`],
		]),
		paths: [],
		refs: [],
	});

	assert.deepEqual(
		violations.map(({ path }) => path),
		["README.md", "docs/notes.md"],
	);
});

test("ignores a tracked file deleted by the current candidate change", () => {
	assert.deepEqual(
		trackedText([".github/workflows/pages.yml-does-not-exist"]),
		new Map(),
	);
});
