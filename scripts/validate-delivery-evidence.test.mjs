import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDeliveryEvidence } from "./validate-delivery-evidence.mjs";

const validArchitecture = `
# BabySteps Web3 architecture
## 系统上下文
现有：家长、Provider、Owner 与 BabySteps。
\`\`\`mermaid
flowchart LR
    User --> BabySteps
\`\`\`
## 运行时请求与数据流
现有：React。Worker/D1 本地已验证。计划：Privy。待验证：Sepolia V2。
## 链上与链下事实所有权
链上保存购买与证书，D1 保存富内容。
## 组件、职责、存储与外部服务
React、Worker、D1、Sepolia、The Graph 与三 RPC。
## 核心业务时序
\`\`\`mermaid
sequenceDiagram
    Provider->>Worker: 保存草稿
    Parent->>Marketplace: approve + buy
\`\`\`
## 部署与 CI/CD
现有：Pages。计划：Worker preview。待验证：production。
## 权限与安全边界
现有：Owner。计划：KMS Relayer。待验证：IAM。
## 失败恢复与 Evidence
失败时停止，独立读回后写入 Evidence。
## 预览环境生命周期与清理
PR preview 关闭后只清理本 preview_id，保护共享资源。
`;

const remotelyVerifiedArchitecture = validArchitecture.replace(
	"Worker/D1 本地已验证",
	"Worker/D1 公开 API 已验证",
);

const validWorkerEvidence = `
# Worker/D1 Phase 2 evidence
Stable task key: chainId:marketplaceAddress:taskId
Replay-safe nonce and session tests: passed
D1 migrations: seven tables applied
Purchase gate: purchaseIdForBuyer must be non-zero
Boundary: local only; no remote D1 or Worker deployment
`;

const validEvidencePage = `
import globalArchitecture from "../../../docs/architecture/starbuddy-web3-global-architecture.svg";
import businessSequence from "../../../docs/architecture/starbuddy-web3-business-sequence.svg";
<section aria-labelledby="global-architecture-title">
  <h2 id="global-architecture-title">全局架构图</h2>
  <a href={globalArchitecture}>查看全局架构原图</a>
  <img src={globalArchitecture} alt="BabySteps 全局架构图" width="1600" height="1000" />
  <p><strong>看哪里</strong>：四层信任边界。</p>
  <p><strong>证明什么</strong>：运行、数据、部署和清理路径完整。</p>
</section>
<section aria-labelledby="business-sequence-title">
  <h2 id="business-sequence-title">核心业务时序图</h2>
  <a href={businessSequence}>查看业务时序原图</a>
  <img src={businessSequence} alt="BabySteps 核心业务时序图" width="1600" height="1000" />
  <p><strong>看哪里</strong>：Provider 到 SBT 的编号步骤。</p>
  <p><strong>证明什么</strong>：成功和失败路径均有边界。</p>
</section>
`;

const validAssetFacts = [
	{
		path: "docs/architecture/starbuddy-web3-global-architecture.svg",
		exists: true,
		bytes: 12000,
	},
	{
		path: "docs/architecture/starbuddy-web3-business-sequence.svg",
		exists: true,
		bytes: 11000,
	},
];

function validate(
	mapText,
	architectureText = validArchitecture,
	workerEvidenceText = validWorkerEvidence,
	evidencePageText = validEvidencePage,
	assetFacts = validAssetFacts,
) {
	return validateDeliveryEvidence(
		mapText,
		architectureText,
		workerEvidenceText,
		evidencePageText,
		assetFacts,
	);
}

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
		validate(validMap),
		[],
	);
});

test("accepts stronger remote Worker and D1 verification", () => {
	const validMap = mapWith(requiredHeaders, [
		["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "远程闭环", "`complete`"],
	]);

	assert.deepEqual(
		validate(
			validMap,
			remotelyVerifiedArchitecture,
		),
		[],
	);
});

test("rejects a map without the evidence column", () => {
	const invalidMap = mapWith(
		requiredHeaders.filter((header) => header !== "验证证据"),
		[["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "`pending`"]],
	);

	assert.match(
		validate(invalidMap)[0],
		/验证证据/,
	);
});

test("rejects an unsupported status", () => {
	const invalidMap = mapWith(requiredHeaders, [
		["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "测试待补", "`done`"],
	]);

	assert.match(
		validate(
			invalidMap,
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
		validate(
			validMap,
			"# Architecture\n## 运行时请求与数据流\nReact to Sepolia",
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
		validate(validMap, validArchitecture, "").join("\n"),
		/Phase 2 evidence/,
	);
});

test("rejects architecture without a sequence diagram", () => {
	const validMap = mapWith(requiredHeaders, [
		["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "远程闭环", "`complete`"],
	]);
	const withoutSequence = validArchitecture.replace("sequenceDiagram", "flowchart LR");

	assert.match(validate(validMap, withoutSequence).join("\n"), /sequenceDiagram/);
});

test("rejects architecture without failure recovery and cleanup lifecycle", () => {
	const validMap = mapWith(requiredHeaders, [
		["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "远程闭环", "`complete`"],
	]);
	const incomplete = validArchitecture
		.replace("## 失败恢复与 Evidence", "## 运行说明")
		.replace("## 预览环境生命周期与清理", "## 附录");

	assert.match(validate(validMap, incomplete).join("\n"), /失败恢复与 Evidence/);
	assert.match(validate(validMap, incomplete).join("\n"), /预览环境生命周期与清理/);
});

test("rejects an Evidence page that does not publish both diagram images", () => {
	const validMap = mapWith(requiredHeaders, [
		["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "远程闭环", "`complete`"],
	]);
	const oneImageOnly = validEvidencePage.replaceAll(
		"starbuddy-web3-business-sequence.svg",
		"starbuddy-web3-global-architecture.svg",
	);

	assert.match(validate(validMap, validArchitecture, validWorkerEvidence, oneImageOnly).join("\n"), /business sequence image/);
});

test("rejects missing or empty public diagram assets", () => {
	const validMap = mapWith(requiredHeaders, [
		["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "远程闭环", "`complete`"],
	]);
	const invalidAssets = [
		{ ...validAssetFacts[0], exists: false, bytes: 0 },
		{ ...validAssetFacts[1], bytes: 0 },
	];

	const errors = validate(
		validMap,
		validArchitecture,
		validWorkerEvidence,
		validEvidencePage,
		invalidAssets,
	).join("\n");
	assert.match(errors, /global architecture image is missing/);
	assert.match(errors, /business sequence image is empty/);
});
