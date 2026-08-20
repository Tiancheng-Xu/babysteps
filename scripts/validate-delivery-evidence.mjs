import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const requiredHeaders = [
	"作业要求",
	"实现功能",
	"代码位置",
	"验证证据",
	"当前状态",
];
const allowedStatuses = new Set(["complete", "partial", "pending", "blocked"]);
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
			"Cloudflare Worker",
			"Origin Token",
			"API Gateway",
			"SQS 主队列",
			"SQS DLQ",
			"一次性 ECS Fargate Cleaner",
			"共享 PostgreSQL",
			"p50 / p75 / p95",
			"GitHub Actions + OIDC",
			"项目栈自动清理",
			"AWS 闭环已验证",
			"Run 31765573258",
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
			"Run 31765573258",
			"ECS exitCode=0",
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
		kind: "performance desktop screenshot",
		path: "docs/evidence/screenshots/2026-08-13-performance/performance-dashboard-desktop-1920.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 95710,
		expectedSha256:
			"54d204fe68e1de477c70bfcca0fb311954e4e186109abd2d9ef607e70359930b",
	},
	{
		kind: "performance mobile screenshot",
		path: "docs/evidence/screenshots/2026-08-13-performance/performance-dashboard-mobile-390.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 66133,
		expectedSha256:
			"47286d2140cb03a53d8ce4d4f01294b36f3af5c2bf9985a2d6210a70036e85a7",
	},
];
const evidencePageMarkers = [
	"WEB3 PRODUCT CLOSURE · LOCAL VERIFIED",
	"Provider requestTask → Owner approve/reject → VRF",
	"会话 + purchaseIdForBuyer 双门禁",
	"D1 证据申请 → Owner 钱包 → confirmCompletion → SBT",
	"本地闭环通过 · 云端待发布",
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
	"AWS 闭环已验证",
	"Run 31765573258",
	"sampleCount=1，p50=p75=p95=321",
	"九类项目运行资源均为 0",
	"要求、实现与证据映射",
	"无演示数据兜底",
	"最终云端结果由 Run",
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

export function validateDeliveryEvidence(
	mapText,
	architectureText,
	workerEvidenceText,
	evidencePageText = "",
	assetFacts = [],
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
		if (statusIndex >= 0) {
			for (const line of lines.slice(headerLineIndex + 2)) {
				const cells = tableCells(line);
				if (cells.length === 0) break;
				if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
				const status = normalizeStatus(cells[statusIndex] ?? "");
				if (!allowedStatuses.has(status)) {
					errors.push(`invalid status: ${status || "empty"}`);
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
	const [
		mapText,
		architectureText,
		workerEvidenceText,
		evidencePageText,
		assetFacts,
	] = await Promise.all([
		readFile(mapPath, "utf8"),
		readFile(architecturePath, "utf8"),
		readFile(workerEvidencePath, "utf8"),
		readFile(evidencePagePath, "utf8"),
		Promise.all(expectedDiagramAssets.map(({ path }) => readAssetFact(path))),
	]);
	const errors = validateDeliveryEvidence(
		mapText,
		architectureText,
		workerEvidenceText,
		evidencePageText,
		assetFacts,
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
