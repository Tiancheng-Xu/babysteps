import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [readme, html, app, footer] = await Promise.all([
	readFile("README.md", "utf8"),
	readFile("web/index.html", "utf8"),
	readFile("web/src/App.tsx", "utf8"),
	readFile("web/src/components/CourseEvidenceFooter.tsx", "utf8"),
]);

assert.match(readme, /^# BabySteps · 成长星球/m);
assert.match(readme, /https:\/\/babysteps\.baby2b\.online\//);
assert.doesNotMatch(readme, /周日.*作业|课程只计划|课程实验/);
assert.doesNotMatch(
	`${html}\n${app}\n${footer}`,
	/作业|课程|老师|验收|homework|assignment/i,
);

console.log("Public BabySteps copy validation passed.");
