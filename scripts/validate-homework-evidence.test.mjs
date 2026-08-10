import assert from "node:assert/strict";
import { test } from "node:test";
import { validateHomeworkEvidence } from "./validate-homework-evidence.mjs";

const validArchitecture = `
# BabySteps Web3 architecture
## 运行时请求与数据流
现有：React。计划：Worker。待验证：Sepolia V2。
## 部署与 CI/CD
现有：Pages。计划：Worker preview。待验证：production。
## 权限与安全边界
现有：Owner。计划：KMS Relayer。待验证：IAM。
`;

function mapWith(headers, rows) {
	return `
# Web3 homework implementation map

| ${headers.join(" | ")} |
| ${headers.map(() => "---").join(" | ")} |
${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`;
}

const requiredHeaders = [
	"作业要求",
	"实现功能",
	"代码位置",
	"验证证据",
	"当前状态",
];

test("accepts a complete evidence mapping contract", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上与链下列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"测试待补",
			"`pending`",
		],
		[
			"Owner 与 Provider",
			"审核状态机",
			"`contracts/Task.sol`",
			"本地测试",
			"`partial`",
		],
	]);

	assert.deepEqual(validateHomeworkEvidence(validMap, validArchitecture), []);
});

test("rejects a map without the evidence column", () => {
	const invalidMap = mapWith(
		requiredHeaders.filter((header) => header !== "验证证据"),
		[["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "`pending`"]],
	);

	assert.match(
		validateHomeworkEvidence(invalidMap, validArchitecture)[0],
		/验证证据/,
	);
});

test("rejects an unsupported status", () => {
	const invalidMap = mapWith(requiredHeaders, [
		["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "测试待补", "`done`"],
	]);

	assert.match(
		validateHomeworkEvidence(invalidMap, validArchitecture).join("\n"),
		/invalid status: done/,
	);
});

test("rejects architecture without truthful status markers", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"测试待补",
			"`pending`",
		],
	]);

	assert.match(
		validateHomeworkEvidence(
			validMap,
			"# Architecture\n## 运行时请求与数据流\nReact to Sepolia",
		).join("\n"),
		/计划/,
	);
});
