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
import keepsakeDesktop from "../../../docs/evidence/screenshots/2026-08-14-starbuddy-sepolia/keepsake-gallery-sepolia-desktop-1440.png";
import keepsakeMobile from "../../../docs/evidence/screenshots/2026-08-14-starbuddy-sepolia/keepsake-gallery-sepolia-mobile-390.png";
import performanceArchitecture from "../../../docs/architecture/starbuddy-performance-global-architecture.svg";
import performanceSequence from "../../../docs/architecture/starbuddy-performance-pipeline-sequence.svg";
import performanceDesktop from "../../../docs/evidence/screenshots/2026-08-13-performance/performance-dashboard-desktop-1920.png";
import performanceMobile from "../../../docs/evidence/screenshots/2026-08-13-performance/performance-dashboard-mobile-390.png";
import performanceSnapshotDesktop from "../../../docs/evidence/screenshots/2026-08-23-performance-verified-snapshot/performance-verified-snapshot-desktop-1440.png";
import performanceSnapshotMobile from "../../../docs/evidence/screenshots/2026-08-23-performance-verified-snapshot/performance-verified-snapshot-mobile-390.png";
import performanceSnapshotVideo from "../../../docs/evidence/recordings/2026-08-23-performance-verified-snapshot/performance-verified-snapshot-walkthrough.mp4";
import renderingArchitecture from "../../../docs/architecture/starbuddy-rendering-global-architecture.svg";
import renderingSequence from "../../../docs/architecture/starbuddy-rendering-resilience-sequence.svg";
import renderingDesktop from "../../../docs/evidence/screenshots/2026-08-14-rendering-resilience/rendering-evidence-desktop-1440.png";
import renderingMobile from "../../../docs/evidence/screenshots/2026-08-14-rendering-resilience/rendering-evidence-mobile-390.png";
import productClosureDesktop from "../../../docs/evidence/screenshots/2026-08-20-web3-product-closure/evidence-product-closure-desktop-1440.png";
import providerConsoleMobile from "../../../docs/evidence/screenshots/2026-08-20-web3-product-closure/provider-console-mobile-390.png";
<section>
  <p>WEB3 PRODUCT CLOSURE · CLOUDFLARE DEPLOYED</p>
  <p>Provider requestTask → Owner approve/reject → VRF</p>
  <p>会话 + purchaseIdForBuyer 双门禁</p>
  <p>D1 证据申请 → Owner 钱包 → confirmCompletion → SBT</p>
  <p>核心交付已验证 · 生产增强待复核</p>
  <p>Sepolia Provider → Owner → VRF 已有真实交易；新版 UI 新交易为增强复核</p>
  <p>链上 + D1 ID 绑定与评论已闭环；新版已购内容接口为增强复核</p>
  <p>真实 confirmCompletion 与锁定 SBT #1；新版 D1 completion UI 为增强复核</p>
  <img src={productClosureDesktop} alt="Web3 产品闭环 Evidence 桌面端本地验证" />
  <img src={providerConsoleMobile} alt="Provider 与 Owner 控制台 390 像素本地验证" />
  <p>只读状态不冒充钱包角色或链上交易成功</p>
</section>
<section>
  <h2>边缘渲染与故障降级</h2>
  <p>边缘 SSR → 精确水合 → 纯 CSR 降级</p>
  <p>生产部署已验证 · 2026-08-14</p>
  <p>生产发布闭环 · Run 31789478284 · 5f4a39e0-0fc5-4bd2-87a2-25158fe2111b</p>
  <a href={renderingArchitecture}>查看渲染架构原图</a>
  <img src={renderingArchitecture} alt="BabySteps 边缘渲染架构图" />
  <a href={renderingSequence}>查看渲染时序原图</a>
  <img src={renderingSequence} alt="BabySteps SSR、水合与 CSR 降级时序图" />
  <p>AWS 增量成本 $0 · 钱包与身份只在客户端激活</p>
  <img src={renderingDesktop} alt="本地 SSR 水合桌面端验证" />
  <img src={renderingMobile} alt="本地 SSR 水合 390 像素手机端验证" />
  <p>375 / 390 / 430 / 1440 均无横向溢出</p>
</section>
<section aria-labelledby="global-architecture-title">
  <h2 id="global-architecture-title">全局架构图</h2>
  <a href={globalArchitecture}>查看全局架构原图</a>
  <img src={globalArchitecture} alt="BabySteps 全局架构图" width="1600" height="1000" />
  <p><strong>看哪里</strong>：六列责任边界、四条数据带与七条编号流，支持跨层追踪。</p>
  <p><strong>证明什么</strong>：运行、数据、部署和清理路径完整。</p>
</section>
<section aria-labelledby="business-sequence-title">
  <h2 id="business-sequence-title">核心业务时序图</h2>
  <a href={businessSequence}>查看业务时序原图</a>
  <img src={businessSequence} alt="BabySteps 核心业务时序图" width="1600" height="1000" />
  <p><strong>看哪里</strong>：六段完整闭环包含登录与会话、Uniswap 获币、Router / Pool、上架与审核、购买与结算、成长任务完成与证书。</p>
  <p><strong>证明什么</strong>：成功和失败路径均有边界。</p>
</section>
<section>
  <h2>性能观测架构图</h2>
  <img src={performanceArchitecture} alt="性能观测架构图" />
  <h3>性能事件闭环时序图</h3>
  <img src={performanceSequence} alt="性能事件闭环时序图" />
  <img src={performanceDesktop} alt="性能统计页桌面端" />
  <img src={performanceMobile} alt="性能统计页手机端" />
  <h3>要求、实现与证据映射</h3>
	<p>浏览器 SDK → Worker → AWS · 真实样本数与 p50 / p75 / p95 · 历史闭环已验证 · 新合同待云端复验</p>
	<p>PR #36 · 0301a670 + a355227</p>
	<p>Run 32626397427 · sampleCount=1，p50=p75=p95=321 · 项目 ECS Cluster 为 0</p>
	<a>查看机器可读证据</a>
	<p>无演示数据兜底 · 历史云端结果由 Run 证明 · 新合同仍待云端复验</p>
	<p>关闭收费资源后的可复核页面 · 历史快照 · 非实时</p>
	<img src={performanceSnapshotDesktop} alt="性能历史快照桌面端真实页面截图" />
	<img src={performanceSnapshotMobile} alt="性能历史快照 390 像素手机端真实页面截图" />
	<video aria-label="性能历史快照页面滚动走读录屏"><source src={performanceSnapshotVideo} /></video>
	<p>应反向优化的共享能力</p>
</section>
<section>
  <h2>StarBuddy 纪念卡抽取与融合</h2>
  <img src={keepsakeDesktop} alt="StarBuddy 纪念馆桌面端本地验证" />
  <img src={keepsakeMobile} alt="StarBuddy 纪念馆 390 像素移动端本地验证" />
  <p>固定 12 成长星 · StarBuddy Sepolia 已验证 · 24 小时未回调可恢复</p>
  <p>真实融合等待自然积累三张匹配卡</p>
</section>
`;

const validAssetFacts = [
	{
		path: "docs/evidence/screenshots/2026-08-20-web3-product-closure/evidence-product-closure-desktop-1440.png",
		exists: true,
		bytes: 567722,
		sha256: "9da97c7141a2431cc8d8a067a1f59d8d150d54217a9b782837153f6cad1abe65",
		width: 0,
		height: 0,
		text: "",
	},
	{
		path: "docs/evidence/screenshots/2026-08-20-web3-product-closure/provider-console-mobile-390.png",
		exists: true,
		bytes: 297645,
		sha256: "50063a6c93420227d9b5441ff598a828b374c62926a14d2d74ecdb07ef60edb1",
		width: 0,
		height: 0,
		text: "",
	},
	{
		path: "docs/evidence/screenshots/2026-08-14-rendering-resilience/rendering-evidence-desktop-1440.png",
		exists: true,
		bytes: 166349,
		sha256: "d65cd50e6ef8dbad9a21d1a6349dbbdb331fb5791c54ca848f8afb9f6d7b5f47",
		width: 0,
		height: 0,
		text: "",
	},
	{
		path: "docs/evidence/screenshots/2026-08-14-rendering-resilience/rendering-evidence-mobile-390.png",
		exists: true,
		bytes: 73265,
		sha256: "f19910c676d15c2d4c0a45abe544490e9cf84462bf8e962f62adf3bba1c2314b",
		width: 0,
		height: 0,
		text: "",
	},
	{
		path: "docs/architecture/starbuddy-rendering-global-architecture.svg",
		exists: true,
		bytes: 15000,
		width: 2000,
		height: 1200,
		text: `<svg width="2000" height="1200">
			<text>Cloudflare Pages Edge</text><text>React Web Streams SSR</text>
			<text>BrowserRouter + hydrateRoot</text><text>Privy / wagmi client-only</text>
			<text>纯 CSR 降级</text><text>静态资源直通</text><text>安全状态白名单</text>
			<text>本地双端构建已验证</text><text>生产部署已验证</text><text>AWS 增量成本 $0</text>
		</svg>`,
	},
	{
		path: "docs/architecture/starbuddy-rendering-resilience-sequence.svg",
		exists: true,
		bytes: 15000,
		width: 2000,
		height: 1300,
		text: `<svg width="2000" height="1300">
			<text>01 文档请求</text><text>02 Edge SSR</text><text>03 精确水合</text>
			<text>04 客户端激活</text><text>05 SSR 超时 / 异常</text><text>06 水合致命失败</text>
			<text>最多一次 CSR 重挂载</text><text>404 保留状态码</text>
			<text>不序列化钱包 / 用户状态</text><text>production / TLS / 深链通过</text>
		</svg>`,
	},
	{
		path: "docs/architecture/starbuddy-performance-global-architecture.svg",
		exists: true,
		bytes: 18000,
		width: 2400,
		height: 1600,
		text: `<svg width="2400" height="1600">
			<text>Browser SDK</text><text>Cloudflare Worker</text><text>Origin Token</text>
			<text>API Gateway</text><text>SQS 主队列</text><text>SQS DLQ</text>
			<text>一次性 ECS Fargate Cleaner</text><text>共享 PostgreSQL</text>
			<text>p50 / p75 / p95</text><text>GitHub Actions + OIDC</text>
			<text>项目栈自动清理</text><text>历史闭环已验证</text><text>新性能合同云端待验证</text><text>Run 32626397427</text>
		</svg>`,
	},
	{
		path: "docs/architecture/starbuddy-performance-pipeline-sequence.svg",
		exists: true,
		bytes: 16000,
		width: 2400,
		height: 1600,
		text: `<svg width="2400" height="1600">
			<text>01 采集</text><text>02 批量上报</text><text>03 异步入队</text>
			<text>04 ECS 清洗</text><text>05 真实统计</text><text>06 Evidence 与清理</text>
			<text>sendBeacon</text><text>失败静默</text><text>maxReceiveCount = 3</text>
			<text>幂等写入</text><text>sampleCount</text><text>DROP SCHEMA</text><text>delete-stack</text>
			<text>Run 32626397427</text><text>ECS exitCode=0</text>
		</svg>`,
	},
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
				<text>05 成长任务完成证书流</text><text>06 交付回滚流</text>
				<text>07 纪念卡抽取融合流</text><text>固定扣 12 成长星</text>
				<text>失败烧 1 / 解锁 2</text><text>真实 VRF 抽卡 · SBT #1</text>
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
				<text>成长任务完成与证书</text><text>签名过期</text><text>滑点 / 余额不足</text>
				<text>哈希冲突</text><text>VRF pending</text><text>allowance / receipt 失败</text>
				<text>purchaseId 唯一</text><text>Graph 延迟</text>
				<text>Worker verify</text><text>rejectTask</text>
				<text>Coordinator 回调 Marketplace</text>
				<text>Owner 授权钱包 → Marketplace.confirmCompletion</text>
				<text>Marketplace → SBT.mintForPurchase</text><text>RPC 不一致</text>
				<text>06 纪念卡</text><text>spendTransferable(12)</text>
				<text>70/22/7/1</text><text>24h recover</text>
				<text>迟到 VRF 回调忽略</text>
			</svg>`,
	},
	{
		path: "docs/evidence/screenshots/2026-08-14-starbuddy-sepolia/keepsake-gallery-sepolia-desktop-1440.png",
		exists: true,
		bytes: 182184,
		width: 0,
		height: 0,
		text: "",
		sha256: "e2cfe48542ae367332ac73ef6c960014e69ee6f5f58eb053b2508f290771aa45",
	},
	{
		path: "docs/evidence/screenshots/2026-08-14-starbuddy-sepolia/keepsake-gallery-sepolia-mobile-390.png",
		exists: true,
		bytes: 137551,
		width: 0,
		height: 0,
		text: "",
		sha256: "5d40847d687edb07dc0157e71d7a0a96f67b50fe29cdd6ff4effb775f530a98b",
	},
	{
		path: "docs/evidence/screenshots/2026-08-13-performance/performance-dashboard-desktop-1920.png",
		exists: true,
		bytes: 95710,
		width: 0,
		height: 0,
		text: "",
		sha256: "54d204fe68e1de477c70bfcca0fb311954e4e186109abd2d9ef607e70359930b",
	},
	{
		path: "docs/evidence/screenshots/2026-08-13-performance/performance-dashboard-mobile-390.png",
		exists: true,
		bytes: 66133,
		width: 0,
		height: 0,
		text: "",
		sha256: "47286d2140cb03a53d8ce4d4f01294b36f3af5c2bf9985a2d6210a70036e85a7",
	},
	{
		path: "docs/evidence/screenshots/2026-08-23-performance-verified-snapshot/performance-verified-snapshot-desktop-1440.png",
		exists: true,
		bytes: 576886,
		width: 0,
		height: 0,
		text: "",
		sha256: "e4718c5f4ea52e3094a32c381e444c80f6461ae599e7a2e2263fdaf6341a22bd",
	},
	{
		path: "docs/evidence/screenshots/2026-08-23-performance-verified-snapshot/performance-verified-snapshot-mobile-390.png",
		exists: true,
		bytes: 378111,
		width: 0,
		height: 0,
		text: "",
		sha256: "f035b7080962738a0d20db39ff67b0a0ac952cde14198493436e08cdd41bb97b",
	},
	{
		path: "docs/evidence/recordings/2026-08-23-performance-verified-snapshot/performance-verified-snapshot-walkthrough.mp4",
		exists: true,
		bytes: 1297104,
		width: 0,
		height: 0,
		text: "",
		sha256: "4734e52dd36d6cedf4b99d8987f282e1e8ad5f21561da1abc24d832bbb57bf9c",
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

test("rejects a BabySteps map when a teacher requirement remains partial", () => {
	const requirements = [
		"1. 链上任务列表 + 链下数据库",
		"2. Owner 管理商家/老师",
		"3. 发行 ERC-20 平台币",
		"4. Uniswap 池",
		"5. 点击购买",
		"6. Chainlink 随机性",
		"7. 个人中心使用 Privy 登录",
	];
	const map = mapWith(
		requiredHeaders,
		requirements.map((requirement, index) => [
			requirement,
			"实现",
			"`src/example.ts`",
			"真实证据",
			index === 1 ? "`partial`" : "`complete`",
		]),
	).replace(
		"# Web3 delivery implementation map",
		"# BabySteps Web3 作业实现映射",
	);

	assert.match(
		validate(map).join("\n"),
		/teacher requirement must be complete: 2\./,
	);
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
	const invalidAssets = validAssetFacts.map((asset) => {
		if (asset.path.endsWith("starbuddy-web3-global-architecture.svg")) {
			return { ...asset, exists: false, bytes: 0 };
		}
		if (asset.path.endsWith("starbuddy-web3-business-sequence.svg")) {
			return { ...asset, bytes: 0 };
		}
		return asset;
	});

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
	const compactAssets = validAssetFacts.map((asset) =>
		asset.path.endsWith("starbuddy-web3-global-architecture.svg")
			? {
					...asset,
					width: 1600,
					height: 1000,
					text: "<svg><text>Cloudflare</text><text>Ethereum Sepolia</text></svg>",
				}
			: asset,
	);

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

test("rejects a sequence image without all six business phases and bounded failures", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"链上列表",
			"taskId 映射",
			"`worker/src/tasks.ts`",
			"远程闭环",
			"`complete`",
		],
	]);
	const incompleteAssets = validAssetFacts.map((asset) =>
		asset.path.endsWith("starbuddy-web3-business-sequence.svg")
			? {
					...asset,
					text: "<svg><text>家长购买结算</text><text>完课与证书</text></svg>",
				}
			: asset,
	);

	const errors = validate(
		validMap,
		validArchitecture,
		validWorkerEvidence,
		validEvidencePage,
		incompleteAssets,
	).join("\n");
	assert.match(errors, /登录会话/);
	assert.match(errors, /Uniswap 获得 BABY/);
	assert.match(errors, /purchaseId 唯一/);
	assert.match(errors, /Worker verify/);
	assert.match(errors, /rejectTask/);
	assert.match(errors, /Coordinator 回调 Marketplace/);
	assert.match(errors, /Owner 授权钱包 → Marketplace\.confirmCompletion/);
	assert.match(errors, /Marketplace → SBT\.mintForPurchase/);
});

test("rejects Evidence that omits the locally verified keepsake flow or screenshots", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"纪念卡",
			"抽卡融合",
			"`contracts/StarBuddy.sol`",
			"本地测试",
			"`partial`",
		],
	]);
	const withoutKeepsakes = validEvidencePage
		.replaceAll("StarBuddy 纪念卡抽取与融合", "普通展示")
		.replaceAll(
			"keepsake-gallery-sepolia-desktop-1440.png",
			"missing-desktop.png",
		);
	const assetsWithoutDesktop = validAssetFacts.filter(
		(asset) =>
			!asset.path.endsWith("keepsake-gallery-sepolia-desktop-1440.png"),
	);

	const errors = validate(
		validMap,
		validArchitecture,
		validWorkerEvidence,
		withoutKeepsakes,
		assetsWithoutDesktop,
	).join("\n");
	assert.match(errors, /StarBuddy 纪念卡抽取与融合/);
	assert.match(errors, /keepsake desktop screenshot/);
});

test("rejects a screenshot whose recorded proof hash no longer matches", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"纪念卡",
			"抽卡融合",
			"`contracts/StarBuddy.sol`",
			"本地测试",
			"`partial`",
		],
	]);
	const changedAssets = validAssetFacts.map((asset) =>
		asset.path.endsWith("keepsake-gallery-sepolia-desktop-1440.png")
			? { ...asset, sha256: "changed" }
			: asset,
	);

	assert.match(
		validate(
			validMap,
			validArchitecture,
			validWorkerEvidence,
			validEvidencePage,
			changedAssets,
		).join("\n"),
		/keepsake desktop screenshot SHA-256 mismatch/,
	);
});

test("rejects performance Evidence without the post-cleanup recording", () => {
	const validMap = mapWith(requiredHeaders, [
		[
			"性能观测",
			"历史快照",
			"`web/src/pages/PerformanceDashboardPage.tsx`",
			"截图与录屏",
			"`complete`",
		],
	]);
	const withoutVideo = validEvidencePage.replaceAll(
		"performance-verified-snapshot-walkthrough.mp4",
		"missing-recording.mp4",
	);
	const assetsWithoutVideo = validAssetFacts.filter(
		(asset) =>
			!asset.path.endsWith("performance-verified-snapshot-walkthrough.mp4"),
	);

	assert.match(
		validate(
			validMap,
			validArchitecture,
			validWorkerEvidence,
			withoutVideo,
			assetsWithoutVideo,
		).join("\n"),
		/performance snapshot recording/,
	);
});
