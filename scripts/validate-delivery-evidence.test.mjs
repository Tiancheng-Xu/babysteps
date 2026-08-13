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
  <p><strong>看哪里</strong>：六列责任边界、四条数据带与六条编号流，支持跨层追踪。</p>
  <p><strong>证明什么</strong>：运行、数据、部署和清理路径完整。</p>
</section>
<section aria-labelledby="business-sequence-title">
  <h2 id="business-sequence-title">核心业务时序图</h2>
  <a href={businessSequence}>查看业务时序原图</a>
  <img src={businessSequence} alt="BabySteps 核心业务时序图" width="1600" height="1000" />
  <p><strong>看哪里</strong>：五段完整闭环包含登录与会话、Uniswap 获币、Router / Pool、上架与审核、购买与结算、完课与证书。</p>
  <p><strong>证明什么</strong>：成功和失败路径均有边界。</p>
</section>
`;

const validAssetFacts = [
	{
		path: "docs/architecture/starbuddy-web3-global-architecture.svg",
		exists: true,
		bytes: 24000,
		width: 2400,
		height: 1500,
		text: `
			<svg width="2400" height="1500">
				<text>01 登录会话流</text><text>02 兑换获币流</text>
				<text>03 上架激活流</text><text>04 购买结算流</text>
				<text>05 完课证书流</text><text>06 交付回滚流</text>
				<text>用户与角色</text><text>React Web</text><text>Cloudflare</text>
				<text>Ethereum Sepolia</text><text>Web3 外部依赖</text><text>交付与 AWS</text>
				<text>用户运行与认证</text><text>任务内容与事实所有权</text>
				<text>代币购买随机与证书</text><text>CI/CD 安全可观测与清理</text>
				<text>HTTPS</text><text>JSON-RPC</text><text>GraphQL</text><text>OIDC</text>
				<text>已验证</text><text>已实现待验证</text><text>计划 / 延后</text>
				<text>请求流</text><text>数据流</text><text>链上交易</text>
				<text>异步事件</text><text>计划路径</text>
				<text>Quote → Approve → Router → Pool → BABY</text>
				<text>transferFrom → Provider payee</text>
				<text>失败保持上一有效部署</text>
			</svg>`,
	},
	{
		path: "docs/architecture/starbuddy-web3-business-sequence.svg",
		exists: true,
		bytes: 22000,
		width: 2400,
		height: 1800,
		text: `
			<svg width="2400" height="1800">
				<text>02A 获取报价</text><text>02B 授权配对资产</text>
				<text>02C Router 路由到 Pool</text><text>02D receipt 后刷新 BABY</text>
				<text>04A 读取任务与余额</text><text>04B 精确授权 BABY</text>
				<text>04C buy 写入购买</text><text>04D Provider 收款</text>
				<text>04E 事件与独立读回</text>
				<text>登录会话</text><text>Uniswap 获得 BABY</text>
				<text>Provider 上架与 Owner 审核</text><text>家长购买结算</text>
				<text>完课与证书</text><text>签名过期</text><text>滑点 / 余额不足</text>
				<text>哈希冲突</text><text>VRF pending</text><text>allowance / receipt 失败</text>
				<text>Relayer 重试</text><text>Graph 延迟</text>
				<text>Worker verify</text><text>rejectTask</text>
				<text>Coordinator 回调 Marketplace</text>
				<text>Relayer → Marketplace.confirmCompletion</text>
				<text>Marketplace → SBT.mintForPurchase</text><text>RPC 不一致</text>
			</svg>`,
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

	assert.deepEqual(validate(validMap), []);
});

test("accepts stronger remote Worker and D1 verification", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"远程闭环",
			"`complete`",
		],
	]);

	assert.deepEqual(validate(validMap, remotelyVerifiedArchitecture), []);
});

test("rejects a map without the evidence column", () => {
	const invalidMap = mapWith(
		requiredHeaders.filter((header) => header !== "验证证据"),
		[["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "`pending`"]],
	);

	assert.match(validate(invalidMap)[0], /验证证据/);
});

test("rejects an unsupported status", () => {
	const invalidMap = mapWith(requiredHeaders, [
		["链上列表", "taskId 映射", "`worker/src/tasks.ts`", "测试待补", "`done`"],
	]);

	assert.match(validate(invalidMap).join("\n"), /invalid status: done/);
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
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"远程闭环",
			"`complete`",
		],
	]);
	const withoutSequence = validArchitecture.replace(
		"sequenceDiagram",
		"flowchart LR",
	);

	assert.match(
		validate(validMap, withoutSequence).join("\n"),
		/sequenceDiagram/,
	);
});

test("rejects architecture without failure recovery and cleanup lifecycle", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"远程闭环",
			"`complete`",
		],
	]);
	const incomplete = validArchitecture
		.replace("## 失败恢复与 Evidence", "## 运行说明")
		.replace("## 预览环境生命周期与清理", "## 附录");

	assert.match(
		validate(validMap, incomplete).join("\n"),
		/失败恢复与 Evidence/,
	);
	assert.match(
		validate(validMap, incomplete).join("\n"),
		/预览环境生命周期与清理/,
	);
});

test("rejects an Evidence page that does not publish both diagram images", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"远程闭环",
			"`complete`",
		],
	]);
	const oneImageOnly = validEvidencePage.replaceAll(
		"starbuddy-web3-business-sequence.svg",
		"starbuddy-web3-global-architecture.svg",
	);

	assert.match(
		validate(
			validMap,
			validArchitecture,
			validWorkerEvidence,
			oneImageOnly,
		).join("\n"),
		/business sequence image/,
	);
});

test("rejects missing or empty public diagram assets", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"远程闭环",
			"`complete`",
		],
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

test("rejects a compact global image without expanded responsibility and protocol detail", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"远程闭环",
			"`complete`",
		],
	]);
	const compactAssets = [
		{
			...validAssetFacts[0],
			width: 1600,
			height: 1000,
			text: "<svg><text>Cloudflare</text><text>Ethereum Sepolia</text></svg>",
		},
		validAssetFacts[1],
	];

	const errors = validate(
		validMap,
		validArchitecture,
		validWorkerEvidence,
		validEvidencePage,
		compactAssets,
	).join("\n");
	assert.match(errors, /global architecture image canvas/);
	assert.match(errors, /用户与角色/);
	assert.match(errors, /JSON-RPC/);
});

test("rejects a sequence image without all five business phases and bounded failures", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"远程闭环",
			"`complete`",
		],
	]);
	const incompleteAssets = [
		validAssetFacts[0],
		{
			...validAssetFacts[1],
			text: "<svg><text>家长购买结算</text><text>完课与证书</text></svg>",
		},
	];

	const errors = validate(
		validMap,
		validArchitecture,
		validWorkerEvidence,
		validEvidencePage,
		incompleteAssets,
	).join("\n");
	assert.match(errors, /登录会话/);
	assert.match(errors, /Uniswap 获得 BABY/);
	assert.match(errors, /Relayer 重试/);
	assert.match(errors, /Worker verify/);
	assert.match(errors, /rejectTask/);
	assert.match(errors, /Coordinator 回调 Marketplace/);
	assert.match(errors, /Relayer → Marketplace\.confirmCompletion/);
	assert.match(errors, /Marketplace → SBT\.mintForPurchase/);
});
