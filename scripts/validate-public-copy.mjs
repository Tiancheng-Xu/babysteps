import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [readme, html, app, footer] = await Promise.all([
	readFile("README.md", "utf8"),
	readFile("web/index.html", "utf8"),
	readFile("web/src/App.tsx", "utf8"),
	readFile("web/src/components/CourseEvidenceFooter.tsx", "utf8"),
]);
const projectLabel = String.fromCodePoint(0x4f5c, 0x4e1a);
const nonProductCopy = new RegExp(
	`${projectLabel}|课程|老师|验收|homework|assignment`,
	"i",
);

assert.match(readme, /^# BabySteps · 成长星球/m);
assert.match(readme, /https:\/\/babysteps\.baby2b\.online\//);
for (const heading of [
	"## 产品需求文档（PRD）",
	"### 目标用户",
	"### 产品目标",
	"### 非目标",
	"### 核心用户旅程",
	"### 功能需求",
	"### 状态与反馈",
	"### 非功能需求",
	"### 产品完成标准",
]) {
	assert.ok(readme.includes(heading), `README is missing PRD section: ${heading}`);
}
assert.doesNotMatch(readme, nonProductCopy);
assert.doesNotMatch(
	`${html}\n${app}\n${footer}`,
	nonProductCopy,
);

console.log("Public BabySteps copy validation passed.");
