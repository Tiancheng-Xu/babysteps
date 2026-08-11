import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDeliveryEvidence } from "./validate-delivery-evidence.mjs";

const validArchitecture = `
# BabySteps Web3 architecture
## 运行时请求与数据流
现有：React。Worker/D1 本地已验证。计划：Privy。待验证：Sepolia V2。
## 部署与 CI/CD
现有：Pages。计划：Worker preview。待验证：production。
## 权限与安全边界
现有：Owner。计划：KMS Relayer。待验证：IAM。
`;

const validWorkerEvidence = `
# Worker/D1 Phase 2 evidence
Stable task key: chainId:marketplaceAddress:taskId
Replay-safe nonce and session tests: passed
D1 migrations: seven tables applied
Purchase gate: purchaseIdForBuyer must be non-zero
Boundary: local only; no remote D1 or Worker deployment
`;

function mapWith(headers, rows) {
	return `
# Web3 delivery implementation map

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

	assert.deepEqual(
		validateDeliveryEvidence(validMap, validArchitecture, validWorkerEvidence),
		[],
	);
});

test("rejects a map without the evidence column", () => {
	const invalidMap = mapWith(
		requiredHeaders.filter((header) => header !== "验证证据"),
		[["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "`pending`"]],
	);

	assert.match(
		validateDeliveryEvidence(invalidMap, validArchitecture, validWorkerEvidence)[0],
		/验证证据/,
	);
});

test("rejects an unsupported status", () => {
	const invalidMap = mapWith(requiredHeaders, [
		["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "测试待补", "`done`"],
	]);

	assert.match(
		validateDeliveryEvidence(
			invalidMap,
			validArchitecture,
			validWorkerEvidence,
		).join("\n"),
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
		validateDeliveryEvidence(
			validMap,
			"# Architecture\n## 运行时请求与数据流\nReact to Sepolia",
			validWorkerEvidence,
		).join("\n"),
		/计划/,
	);
});

test("rejects missing Worker and D1 Phase 2 proof", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"本地测试",
			"`partial`",
		],
	]);

	assert.match(
		validateDeliveryEvidence(validMap, validArchitecture, "").join("\n"),
		/Phase 2 evidence/,
	);
});
