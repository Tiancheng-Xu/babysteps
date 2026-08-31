import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import journeyManifest from "./performance-journey.manifest.json" with {
	type: "json",
};

const requiredHeaders = [
	"作业要求",
	"实现功能",
	"代码位置",
	"验证证据",
	"当前状态",
];
const allowedStatuses = new Set(["complete", "partial", "pending", "blocked"]);
const allowedJourneyStages = new Set([
	"local-verified",
	"sepolia-verified",
	"aws-live-verified",
	"production-verified",
	"blocked",
]);
const allowedRoleStatuses = new Set([
	"implemented",
	"sepolia-verified",
	"production-verified",
	"cloud-verified",
	"historical",
	"readiness-only",
	"deferred",
]);
const expectedRoleBoundaryIds = [
	"public-visitor",
	"privy-identity",
	"wallet-siwe-session",
	"parent-buyer",
	"token-recipient",
	"provider-operator",
	"owner-admin",
	"completion-review-operator",
	"child-domain-subject",
	"babycoin-admin",
	"babycoin-reward",
	"marketplace-v2-admin",
	"marketplace-v2-provider",
	"marketplace-v2-completion-relayer",
	"certificate-admin",
	"certificate-minter",
	"keepsake-admin",
	"keepsake-minter",
	"keepsake-burner",
	"chainlink-vrf-coordinator",
	"cloudflare-worker-runtime",
	"d1-wallet-session-boundary",
	"performance-control-github-app",
	"performance-callback-producer",
	"performance-callback-verifier",
	"uniswap-external-dependency",
	"github-actions-oidc-deploy",
	"cloudformation-execution",
	"ecs-service-linked-role",
	"performance-ecs-execution",
	"performance-cleaner-task",
	"performance-db-admin-task",
	"performance-query-lambda",
	"performance-ingest-lambda",
	"marketplace-v1-oracle",
	"legacy-certificate-minter",
	"readiness-github-pipeline",
	"readiness-cloudformation",
	"readiness-codebuild",
	"readiness-stop-db",
	"readiness-probe",
	"relayer-execution-deferred",
];
const roleEvidencePageMarkers = [
	"全角色与权限边界",
	"babysteps-role-boundaries.html",
	"2026-08-30-role-boundary-inventory.json",
	"allow-scripts allow-downloads",
];
const expectedImplementedJourneyIds =
	journeyManifest.implementedFeatureJourneys.map(({ journeyId }) => journeyId);
const teacherRequirementPrefixes = [
	"1. 链上任务列表",
	"2. Owner 管理商家/老师",
	"3. 发行 ERC-20 平台币",
	"4. Uniswap 池",
	"5. 点击购买",
	"6. Chainlink 随机性",
	"7. 个人中心使用 Privy 登录",
];
const architectureSections = [
	"系统上下文",
	"运行时请求与数据流",
	"链上与链下事实所有权",
	"组件、职责、存储与外部服务",
	"部署与 CI/CD",
	"权限与安全边界",
	"失败恢复与 Evidence",
	"预览环境生命周期与清理",
];
const architectureMarkers = ["现有", "计划", "待验证"];
const architectureDiagramMarkers = ["flowchart", "sequenceDiagram"];
const expectedDiagramAssets = [
	{
		kind: "rendering architecture image",
		path: "docs/architecture/starbuddy-rendering-global-architecture.svg",
		minimumWidth: 1800,
		minimumHeight: 1100,
		markers: [
			"Cloudflare Pages Edge",
			"React Web Streams SSR",
			"BrowserRouter + hydrateRoot",
			"Privy / wagmi client-only",
			"纯 CSR 降级",
			"静态资源直通",
			"安全状态白名单",
			"本地双端构建已验证",
			"生产部署已验证",
			"AWS 增量成本 $0",
		],
	},
	{
		kind: "rendering resilience sequence image",
		path: "docs/architecture/starbuddy-rendering-resilience-sequence.svg",
		minimumWidth: 1800,
		minimumHeight: 1200,
		markers: [
			"01 文档请求",
			"02 Edge SSR",
			"03 精确水合",
			"04 客户端激活",
			"05 SSR 超时 / 异常",
			"06 水合致命失败",
			"最多一次 CSR 重挂载",
			"404 保留状态码",
			"不序列化钱包 / 用户状态",
			"production / TLS / 深链通过",
		],
	},
	{
		kind: "rendering desktop screenshot",
		path: "docs/evidence/screenshots/2026-08-14-rendering-resilience/rendering-evidence-desktop-1440.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 166349,
		expectedSha256:
			"d65cd50e6ef8dbad9a21d1a6349dbbdb331fb5791c54ca848f8afb9f6d7b5f47",
	},
	{
		kind: "rendering mobile screenshot",
		path: "docs/evidence/screenshots/2026-08-14-rendering-resilience/rendering-evidence-mobile-390.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 73265,
		expectedSha256:
			"f19910c676d15c2d4c0a45abe544490e9cf84462bf8e962f62adf3bba1c2314b",
	},
	{
		kind: "performance architecture image",
		path: "docs/architecture/starbuddy-performance-global-architecture.svg",
		minimumWidth: 2200,
		minimumHeight: 1400,
		markers: [
			"Browser SDK",
			"Cloudflare Worker 合同",
			"Origin Token",
			"API Gateway",
			"SQS 主队列",
			"SQS DLQ",
			"一次性 ECS Fargate Cleaner",
			"共享 PostgreSQL",
			"p50 / p75 / p95",
			"GitHub Actions + OIDC",
			"项目栈自动清理",
			"临时 AWS 闭环已验证",
			"零残留",
			"Run 33370197607",
			"232 collected / 232 inserted",
			"SQS / DLQ 全量排空",
			"12 类项目资源归零",
		],
	},
	{
		kind: "performance sequence image",
		path: "docs/architecture/starbuddy-performance-pipeline-sequence.svg",
		minimumWidth: 2200,
		minimumHeight: 1400,
		markers: [
			"01 采集",
			"02 批量上报",
			"03 异步入队",
			"04 ECS 清洗",
			"05 真实统计",
			"06 Evidence 与清理",
			"sendBeacon",
			"失败静默",
			"maxReceiveCount = 3",
			"幂等写入",
			"sampleCount",
			"DROP SCHEMA",
			"delete-stack",
			"Run 33370197607",
			"232 / 232 事件已验证",
			"LCP / CLS / INP / FCP / TTFB",
			"SQS / DLQ / Schema / Stack / 12 类资源归零",
			"12 类项目资源全部为 0",
		],
	},
	{
		kind: "global architecture image",
		path: "docs/architecture/starbuddy-web3-global-architecture.svg",
		minimumWidth: 2200,
		minimumHeight: 1400,
		markers: [
			"01 登录会话流",
			"02 兑换获币流",
			"03 上架激活流",
			"04 购买结算流",
			"05 成长任务完成证书流",
			"06 交付回滚流",
			"07 纪念卡抽取融合流",
			"固定扣 12 成长星",
			"失败烧 1 / 解锁 2",
			"真实 VRF 抽卡 · SBT #1",
			"用户与角色",
			"React Web",
			"Cloudflare",
			"Ethereum Sepolia",
			"Web3 外部依赖",
			"交付与 AWS",
			"用户运行与认证",
			"任务内容与事实所有权",
			"代币购买随机与证书",
			"CI/CD 安全可观测与清理",
			"HTTPS",
			"JSON-RPC",
			"GraphQL",
			"OIDC",
			"已验证",
			"已实现待验证",
			"计划 / 延后",
			"请求流",
			"数据流",
			"链上交易",
			"异步事件",
			"计划路径",
			"Quote → Approve → Router → Pool → BABY",
			"transferFrom → Provider payee",
			"失败保持上一有效部署",
		],
	},
	{
		kind: "business sequence image",
		path: "docs/architecture/starbuddy-web3-business-sequence.svg",
		minimumWidth: 2200,
		minimumHeight: 1600,
		markers: [
			"02A 获取报价",
			"02B 授权配对资产",
			"02C Router 路由到 Pool",
			"02D receipt 后刷新 BABY",
			"04A 读取任务与余额",
			"04B 精确授权 BABY",
			"04C buy 写入购买",
			"04D Provider 收款",
			"04E 事件与独立读回",
			"登录会话",
			"Uniswap 获得 BABY",
			"Provider 上架与 Owner 审核",
			"家长购买结算",
			"成长任务完成与证书",
			"签名过期",
			"滑点 / 余额不足",
			"哈希冲突",
			"VRF pending",
			"allowance / receipt 失败",
			"purchaseId 唯一",
			"Graph 延迟",
			"Worker verify",
			"rejectTask",
			"Coordinator 回调 Marketplace",
			"Owner 授权钱包 → Marketplace.confirmCompletion",
			"Marketplace → SBT.mintForPurchase",
			"RPC 不一致",
			"06 纪念卡",
			"spendTransferable(12)",
			"70/22/7/1",
			"24h recover",
			"迟到 VRF 回调忽略",
		],
	},
	{
		kind: "web3 product closure desktop screenshot",
		path: "docs/evidence/screenshots/2026-08-20-web3-product-closure/evidence-product-closure-desktop-1440.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 567722,
		expectedSha256:
			"9da97c7141a2431cc8d8a067a1f59d8d150d54217a9b782837153f6cad1abe65",
	},
	{
		kind: "provider console mobile screenshot",
		path: "docs/evidence/screenshots/2026-08-20-web3-product-closure/provider-console-mobile-390.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 297645,
		expectedSha256:
			"50063a6c93420227d9b5441ff598a828b374c62926a14d2d74ecdb07ef60edb1",
	},
	{
		kind: "keepsake desktop screenshot",
		path: "docs/evidence/screenshots/2026-08-14-starbuddy-sepolia/keepsake-gallery-sepolia-desktop-1440.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 182184,
		expectedSha256:
			"e2cfe48542ae367332ac73ef6c960014e69ee6f5f58eb053b2508f290771aa45",
	},
	{
		kind: "keepsake mobile screenshot",
		path: "docs/evidence/screenshots/2026-08-14-starbuddy-sepolia/keepsake-gallery-sepolia-mobile-390.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 137551,
		expectedSha256:
			"5d40847d687edb07dc0157e71d7a0a96f67b50fe29cdd6ff4effb775f530a98b",
	},
	{
		kind: "final AWS performance desktop screenshot",
		path: "docs/evidence/screenshots/2026-08-31-performance-final/performance-live-desktop-1440.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 1672831,
		expectedSha256:
			"400a983f87852dbcf02d29cca5cc1d6f9fb75cd4586a3482231f4b753104ddf0",
	},
	{
		kind: "final AWS performance mobile screenshot",
		path: "docs/evidence/screenshots/2026-08-31-performance-final/performance-live-mobile-390.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 1207174,
		expectedSha256:
			"b9957f195f0b0937967b7759c46df668f89f82e9ce67f429d29ee5cd110cfff0",
	},
	{
		kind: "final AWS performance recording",
		path: "docs/evidence/recordings/2026-08-31-performance-final/performance-live.webm",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 677993,
		expectedSha256:
			"5ca39f9b203b10922ee6faddb2342ee2add028a81e0a283c70d65d9b398b9e61",
	},
	{
		kind: "final AWS performance journey recording",
		path: "docs/evidence/recordings/2026-08-31-performance-final/browser-journey.webm",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 12151484,
		expectedSha256:
			"c03aeb0e1693e1102f9f5dff89ced9c4796d6089c338e8ce3d83a43c45eacb7f",
	},
];
const evidencePageMarkers = [
	"WEB3 PRODUCT CLOSURE · CLOUDFLARE DEPLOYED",
	"Provider requestTask → Owner approve/reject → VRF",
	"会话 + purchaseIdForBuyer 双门禁",
	"D1 证据申请 → Owner 钱包 → confirmCompletion → SBT",
	"核心交付已验证 · 生产增强待复核",
	"Sepolia Provider → Owner → VRF 已有真实交易",
	"链上 + D1 ID 绑定与评论已闭环",
	"真实 confirmCompletion 与锁定 SBT #1",
	"Web3 产品闭环 Evidence 桌面端本地验证",
	"Provider 与 Owner 控制台 390 像素本地验证",
	"只读状态不冒充钱包角色或链上交易成功",
	"边缘渲染与故障降级",
	"边缘 SSR → 精确水合 → 纯 CSR 降级",
	"生产部署已验证 · 2026-08-14",
	"生产发布闭环",
	"31789478284",
	"5f4a39e0-0fc5-4bd2-87a2-25158fe2111b",
	"查看渲染架构原图",
	"查看渲染时序原图",
	"BabySteps 边缘渲染架构图",
	"BabySteps SSR、水合与 CSR 降级时序图",
	"AWS 增量成本 $0",
	"钱包与身份只在客户端激活",
	"应反向优化的共享能力",
	"375 / 390 / 430 / 1440 均无横向溢出",
	"本地 SSR 水合桌面端验证",
	"本地 SSR 水合 390 像素手机端验证",
	"性能观测架构图",
	"性能事件闭环时序图",
	"浏览器 SDK → Worker → AWS",
	"真实样本数与 p50 / p75 / p95",
	"最终闭环已验证 · 取证后零残留",
	"commit f15bc873b14b",
	"Run 33370197607",
	"9 条真实页面路径",
	"232 个唯一事件",
	"ECS Cleaner 处理并写入 232 条",
	"SQS 与 DLQ",
	"全量排空",
	"12 类项目资源全部为 0",
	"查看机器可读证据",
	"要求、实现与证据映射",
	"无演示数据兜底",
	"真实 Run 截图 · 取证后已清理",
	"本地浏览器接临时 AWS、截图与录屏",
	"web/src/pages/PerformanceDashboardPage.tsx",
	"最终 AWS 性能统计桌面端真实页面截图",
	"最终 AWS 性能统计 390 像素手机端真实页面截图",
	"最终 AWS 性能统计页面走读录屏",
	"九路由真实 AWS 性能采样录屏",
	"全局架构图",
	"核心业务时序图",
	"看哪里",
	"证明什么",
	"查看全局架构原图",
	"查看业务时序原图",
	"BabySteps 全局架构图",
	"BabySteps 核心业务时序图",
	"六列责任边界",
	"四条数据带",
	"六段完整闭环",
	"七条编号流",
	"跨层追踪",
	"Router / Pool",
	"登录与会话",
	"Uniswap 获币",
	"上架与审核",
	"购买与结算",
	"成长任务完成与证书",
	"StarBuddy 纪念卡抽取与融合",
	"固定 12 成长星",
	"StarBuddy Sepolia 已验证",
	"真实融合等待自然积累三张匹配卡",
	"24 小时未回调可恢复",
];
const workerEvidenceMarkers = [
	"chainId:marketplaceAddress:taskId",
	"nonce",
	"D1 migrations",
	"purchaseIdForBuyer",
	"local only",
	"no remote D1 or Worker deployment",
];

function tableCells(line) {
	if (!line.trim().startsWith("|")) return [];
	return line
		.trim()
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
}

function normalizeStatus(value) {
	return value.replaceAll("`", "").trim().toLowerCase();
}

function validateFinalPerformanceEvidence(machineEvidence, assetFacts) {
	const errors = [];
	if (!machineEvidence || typeof machineEvidence !== "object") {
		return ["final AWS machine evidence is missing"];
	}
	if (machineEvidence.schemaVersion !== 5) {
		errors.push("final AWS evidence schema version mismatch");
	}
	if (machineEvidence.workflow?.runId !== 33370197607) {
		errors.push("final AWS evidence Run ID mismatch");
	}
	if (
		machineEvidence.workflow?.commit !==
		"f15bc873b14bb7193495514a6a7cc57c7e0eaf37"
	) {
		errors.push("final AWS evidence commit mismatch");
	}
	if (
		machineEvidence.workflow?.validationSurface !==
		"controlled Chromium and Vite web with local Worker proxy connected to temporary AWS resources"
	) {
		errors.push("final AWS evidence validation surface mismatch");
	}
	if (
		machineEvidence.browserJourney?.routeCount !== 9 ||
		machineEvidence.browserJourney?.batchCount !== 49 ||
		machineEvidence.browserJourney?.acceptedBatchCount !== 49 ||
		machineEvidence.browserJourney?.rejectedBatchCount !== 0 ||
		machineEvidence.browserJourney?.transportFailureCount !== 0 ||
		machineEvidence.browserJourney?.eventCount !== 232 ||
		machineEvidence.browserJourney?.unacceptedEventCount !== 0
	) {
		errors.push("final AWS evidence browser journey counts mismatch");
	}
	if (
		machineEvidence.delivery?.fullyDrained !== true ||
		machineEvidence.delivery?.queue?.total !== 0 ||
		machineEvidence.delivery?.dlq?.total !== 0
	) {
		errors.push("final AWS evidence queue and DLQ drain mismatch");
	}
	const cleaner = machineEvidence.cleaner;
	if (
		cleaner?.processed !== 232 ||
		cleaner?.inserted !== 232 ||
		cleaner?.discarded !== 0 ||
		cleaner?.retryableFailures !== 0 ||
		cleaner?.exitCode !== 0
	) {
		errors.push("final AWS evidence cleaner result mismatch");
	}
	if (
		machineEvidence.dashboard?.mode !== "live" ||
		machineEvidence.dashboard?.source !== "live-api"
	) {
		errors.push("final AWS evidence dashboard source mismatch");
	}
	for (const name of ["LCP", "CLS", "INP", "FCP", "TTFB"]) {
		if (!(machineEvidence.dashboard?.vitalSampleCounts?.[name] > 0)) {
			errors.push(`final AWS evidence ${name} distribution mismatch`);
		}
	}
	const navigation = machineEvidence.dashboard?.conditionalNavigation;
	if (
		navigation?.["navigation.dns"] !== "observed" ||
		navigation?.["navigation.tcp"] !== "observed" ||
		navigation?.["navigation.tls"] !== "unavailable"
	) {
		errors.push("final AWS evidence conditional navigation mismatch");
	}
	const cleanup = machineEvidence.cleanup;
	if (
		cleanup?.schemaDeleted !== true ||
		cleanup?.schemaAbsenceVerified !== true ||
		cleanup?.cloudFormationStackAbsent !== true ||
		cleanup?.remainingProjectResources !== 0
	) {
		errors.push("final AWS evidence cleanup state mismatch");
	}
	const inventoryKeys = [
		"ecr",
		"ecsClusters",
		"ecsTasks",
		"taskDefinitions",
		"sqsAndDlq",
		"apiGateway",
		"lambda",
		"cloudWatchLogGroups",
		"secrets",
		"securityGroups",
		"securityGroupIngress",
		"iamRoles",
	];
	if (
		inventoryKeys.some((key) => cleanup?.inventory?.[key] !== 0) ||
		Object.keys(cleanup?.inventory ?? {}).length !== inventoryKeys.length
	) {
		errors.push("final AWS evidence cleanup inventory must be zero");
	}
	const media = {
		desktop: {
			path: "docs/evidence/screenshots/2026-08-31-performance-final/performance-live-desktop-1440.png",
		},
		mobile390: {
			path: "docs/evidence/screenshots/2026-08-31-performance-final/performance-live-mobile-390.png",
		},
		dashboardRecording: {
			path: "docs/evidence/recordings/2026-08-31-performance-final/performance-live.webm",
		},
		journeyRecording: {
			path: "docs/evidence/recordings/2026-08-31-performance-final/browser-journey.webm",
		},
	};
	for (const [name, expected] of Object.entries(media)) {
		const recorded = machineEvidence.dashboard?.media?.[name];
		const asset = assetFacts.find(
			(candidate) => candidate.path === expected.path,
		);
		if (recorded?.path !== expected.path) {
			errors.push(`final AWS evidence ${name} media path mismatch`);
		}
		if (!asset?.sha256 || recorded?.sha256 !== asset.sha256) {
			errors.push(`final AWS evidence ${name} media hash mismatch`);
		}
	}
	return errors;
}

export function validateImplementedFeatureJourneyEvidence(evidence, pageText) {
	const errors = [];
	const journeys = Array.isArray(evidence?.journeys) ? evidence.journeys : [];
	const journeyIds = journeys.map(({ journeyId }) => journeyId);
	if (
		evidence?.schemaVersion !== 1 ||
		JSON.stringify(journeyIds) !== JSON.stringify(expectedImplementedJourneyIds)
	) {
		errors.push(
			"implemented-feature Evidence must contain the exact 31 journey catalog",
		);
	}
	if (!allowedJourneyStages.has(evidence?.stage)) {
		errors.push("implemented-feature Evidence stage is invalid");
	}
	for (const journey of journeys) {
		if (!allowedJourneyStages.has(journey?.status)) {
			errors.push(
				`implemented-feature journey status is invalid: ${journey?.journeyId ?? "unknown"}`,
			);
		}
	}
	const exclusions = Array.isArray(evidence?.exclusions)
		? evidence.exclusions.join(" ")
		: "";
	if (
		(evidence?.exclusions?.length ?? 0) < 7 ||
		!exclusions.includes("Agent Market") ||
		!exclusions.includes("Cocos")
	) {
		errors.push(
			"implemented-feature Evidence must preserve explicit exclusions",
		);
	}
	if (
		evidence?.stage === "production-verified" &&
		(!evidence?.finalRun?.workflowRunId ||
			!evidence?.finalRun?.cloudflareDeploymentId ||
			evidence?.finalRun?.cleanup?.remainingProjectResources !== 0)
	) {
		errors.push("production stage requires final run proof");
	}
	for (const marker of [
		"31 个 Journey",
		"当前实现边界",
		...allowedJourneyStages,
		"2026-08-30-implemented-feature-live-journey.json",
		"2026-08-30-implemented-feature-live-journey.md",
	]) {
		if (!pageText.includes(marker)) {
			errors.push(
				`implemented-feature Evidence page is missing marker: ${marker}`,
			);
		}
	}
	return [...new Set(errors)];
}

export function validateRoleBoundaryInventory(inventory, evidencePageText) {
	const errors = [];
	if (inventory?.schemaVersion !== 1) {
		errors.push("role boundary inventory schemaVersion must be 1");
	}
	if (!Array.isArray(inventory?.groups) || inventory.groups.length === 0) {
		return [...errors, "role boundary inventory groups are missing"];
	}

	const roles = inventory.groups.flatMap((group) =>
		Array.isArray(group?.roles) ? group.roles : [],
	);
	const seenIds = new Set();
	for (const role of roles) {
		if (!role?.id) {
			errors.push("role boundary inventory contains a role without id");
			continue;
		}
		if (seenIds.has(role.id)) {
			errors.push(`role boundary inventory has duplicate id: ${role.id}`);
		}
		seenIds.add(role.id);
		for (const field of ["name", "holder", "allowed", "denied", "authority"]) {
			if (typeof role[field] !== "string" || role[field].trim() === "") {
				errors.push(`role boundary inventory ${role.id} is missing ${field}`);
			}
		}
		if (!allowedRoleStatuses.has(role.status)) {
			errors.push(
				`role boundary inventory ${role.id} has invalid status: ${role.status}`,
			);
		}
	}
	for (const expectedId of expectedRoleBoundaryIds) {
		if (!seenIds.has(expectedId)) {
			errors.push(`role boundary inventory is missing: ${expectedId}`);
		}
	}
	if (seenIds.size !== expectedRoleBoundaryIds.length) {
		errors.push(
			`role boundary inventory count mismatch: expected ${expectedRoleBoundaryIds.length}, got ${seenIds.size}`,
		);
	}
	if (
		inventory?.archify?.repository !== "https://github.com/tt-a1i/archify" ||
		!/^\d+\.\d+\.\d+$/u.test(inventory?.archify?.version ?? "") ||
		!/^\p{ASCII}{40}$/u.test(inventory?.archify?.commit ?? "") ||
		!/^\p{ASCII}{64}$/u.test(inventory?.archify?.artifactSha256 ?? "")
	) {
		errors.push("role boundary inventory Archify provenance is incomplete");
	}
	for (const marker of roleEvidencePageMarkers) {
		if (!evidencePageText.includes(marker)) {
			errors.push(`Evidence page is missing role boundary marker: ${marker}`);
		}
	}
	return errors;
}

export function validateDeliveryEvidence(
	mapText,
	architectureText,
	workerEvidenceText,
	evidencePageText = "",
	assetFacts = [],
	machineEvidence,
) {
	const errors = [];
	const lines = mapText.split(/\r?\n/);
	const headerLineIndex = lines.findIndex((line) => {
		const cells = tableCells(line);
		return cells.includes("作业要求") && cells.includes("当前状态");
	});

	if (headerLineIndex < 0) {
		errors.push("implementation map is missing its requirements table");
	} else {
		const headers = tableCells(lines[headerLineIndex]);
		for (const header of requiredHeaders) {
			if (!headers.includes(header))
				errors.push(`implementation map is missing column: ${header}`);
		}

		const statusIndex = headers.indexOf("当前状态");
		const requirementIndex = headers.indexOf("作业要求");
		const dataRows = [];
		if (statusIndex >= 0) {
			for (const line of lines.slice(headerLineIndex + 2)) {
				const cells = tableCells(line);
				if (cells.length === 0) break;
				if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
				dataRows.push(cells);
				const status = normalizeStatus(cells[statusIndex] ?? "");
				if (!allowedStatuses.has(status)) {
					errors.push(`invalid status: ${status || "empty"}`);
				}
			}
		}

		if (
			mapText.includes("# BabySteps Web3 作业实现映射") &&
			statusIndex >= 0 &&
			requirementIndex >= 0
		) {
			for (const prefix of teacherRequirementPrefixes) {
				const row = dataRows.find((cells) =>
					(cells[requirementIndex] ?? "").startsWith(prefix),
				);
				if (!row) {
					errors.push(`teacher requirement is missing: ${prefix}`);
					continue;
				}
				if (normalizeStatus(row[statusIndex] ?? "") !== "complete") {
					errors.push(`teacher requirement must be complete: ${prefix}`);
				}
			}
		}
	}

	for (const section of architectureSections) {
		if (!architectureText.includes(section)) {
			errors.push(`architecture is missing section: ${section}`);
		}
	}
	for (const marker of architectureMarkers) {
		if (!architectureText.includes(marker)) {
			errors.push(`architecture is missing status marker: ${marker}`);
		}
	}
	for (const marker of architectureDiagramMarkers) {
		if (!architectureText.includes(marker)) {
			errors.push(`architecture is missing diagram syntax: ${marker}`);
		}
	}
	if (
		!["Worker/D1 本地已验证", "Worker/D1 公开 API 已验证"].some((marker) =>
			architectureText.includes(marker),
		)
	) {
		errors.push("architecture must mark Worker/D1 本地或公开 API 已验证");
	}
	if (!workerEvidenceText) {
		errors.push("Phase 2 evidence is missing");
	} else {
		for (const marker of workerEvidenceMarkers) {
			if (!workerEvidenceText.includes(marker)) {
				errors.push(`Phase 2 evidence is missing marker: ${marker}`);
			}
		}
	}

	for (const marker of evidencePageMarkers) {
		if (!evidencePageText.includes(marker)) {
			errors.push(`Evidence page is missing marker: ${marker}`);
		}
	}
	for (const asset of expectedDiagramAssets) {
		if (!evidencePageText.includes(asset.path.split("/").at(-1))) {
			errors.push(`Evidence page is missing ${asset.kind}`);
		}
		const fact = assetFacts.find((candidate) => candidate.path === asset.path);
		if (!fact?.exists) {
			errors.push(`${asset.kind} is missing: ${asset.path}`);
		} else if (!(fact.bytes > 0)) {
			errors.push(`${asset.kind} is empty: ${asset.path}`);
		} else {
			if (asset.expectedBytes && fact.bytes !== asset.expectedBytes) {
				errors.push(`${asset.kind} byte count mismatch`);
			}
			if (asset.expectedSha256 && fact.sha256 !== asset.expectedSha256) {
				errors.push(`${asset.kind} SHA-256 mismatch`);
			}
			if (
				!(fact.width >= asset.minimumWidth) ||
				!(fact.height >= asset.minimumHeight)
			) {
				errors.push(
					`${asset.kind} canvas must be at least ${asset.minimumWidth}x${asset.minimumHeight}`,
				);
			}
			for (const marker of asset.markers) {
				if (!fact.text?.includes(marker)) {
					errors.push(`${asset.kind} is missing marker: ${marker}`);
				}
			}
		}
	}
	errors.push(...validateFinalPerformanceEvidence(machineEvidence, assetFacts));

	return errors;
}

async function readAssetFact(path) {
	try {
		const details = await stat(path);
		const bytes = details.isFile() ? await readFile(path) : Buffer.alloc(0);
		const text = path.endsWith(".svg") ? bytes.toString("utf8") : "";
		const svgTag = text.match(/<svg\b[^>]*>/u)?.[0] ?? "";
		const width = Number(svgTag.match(/\bwidth=["'](\d+)["']/u)?.[1] ?? 0);
		const height = Number(svgTag.match(/\bheight=["'](\d+)["']/u)?.[1] ?? 0);
		return {
			path,
			exists: details.isFile(),
			bytes: details.size,
			sha256: createHash("sha256").update(bytes).digest("hex"),
			text,
			width,
			height,
		};
	} catch (error) {
		if (error?.code === "ENOENT") {
			return { path, exists: false, bytes: 0, text: "", width: 0, height: 0 };
		}
		throw error;
	}
}

async function main() {
	const mapPath =
		process.argv[2] ?? "docs/delivery/web3-delivery-implementation-map.md";
	const architecturePath =
		process.argv[3] ?? "docs/architecture/starbuddy-web3-architecture.mmd";
	const workerEvidencePath =
		process.argv[4] ?? "docs/evidence/testing/2026-08-10-worker-d1.md";
	const evidencePagePath = process.argv[5] ?? "web/src/pages/EvidencePage.tsx";
	const machineEvidencePath =
		process.argv[6] ??
		"docs/evidence/deployment/2026-08-31-performance-aws-final.json";
	const implementedJourneyEvidencePath =
		process.argv[7] ??
		"docs/evidence/deployment/2026-08-30-implemented-feature-live-journey.json";
	const roleBoundaryInventoryPath =
		process.argv[8] ??
		"docs/evidence/deployment/2026-08-30-role-boundary-inventory.json";
	const [
		mapText,
		architectureText,
		workerEvidenceText,
		evidencePageText,
		assetFacts,
		machineEvidenceText,
		implementedJourneyEvidenceText,
		roleBoundaryInventoryText,
	] = await Promise.all([
		readFile(mapPath, "utf8"),
		readFile(architecturePath, "utf8"),
		readFile(workerEvidencePath, "utf8"),
		readFile(evidencePagePath, "utf8"),
		Promise.all(expectedDiagramAssets.map(({ path }) => readAssetFact(path))),
		readFile(machineEvidencePath, "utf8"),
		readFile(implementedJourneyEvidencePath, "utf8"),
		readFile(roleBoundaryInventoryPath, "utf8"),
	]);
	let machineEvidence;
	let implementedJourneyEvidence;
	let roleBoundaryInventory;
	try {
		machineEvidence = JSON.parse(machineEvidenceText);
		implementedJourneyEvidence = JSON.parse(implementedJourneyEvidenceText);
		roleBoundaryInventory = JSON.parse(roleBoundaryInventoryText);
	} catch {
		console.error("delivery machine evidence is not valid JSON");
		process.exitCode = 1;
		return;
	}
	const errors = validateDeliveryEvidence(
		mapText,
		architectureText,
		workerEvidenceText,
		evidencePageText,
		assetFacts,
		machineEvidence,
	);
	errors.push(
		...validateImplementedFeatureJourneyEvidence(
			implementedJourneyEvidence,
			evidencePageText,
		),
	);
	errors.push(
		...validateRoleBoundaryInventory(roleBoundaryInventory, evidencePageText),
	);
	if (errors.length > 0) {
		for (const error of errors) console.error(error);
		process.exitCode = 1;
		return;
	}
	console.log("delivery evidence contract: ok");
}

const executedPath = process.argv[1]
	? pathToFileURL(resolve(process.argv[1])).href
	: "";
if (import.meta.url === executedPath) await main();
