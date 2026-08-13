import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
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
			"Sepolia 待部署",
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
			"Relayer 重试",
			"Graph 延迟",
			"Worker verify",
			"rejectTask",
			"Coordinator 回调 Marketplace",
			"Relayer → Marketplace.confirmCompletion",
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
		kind: "keepsake desktop screenshot",
		path: "docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/keepsake-gallery-desktop.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 190032,
		expectedSha256: "43324f6b226e8c9e20a948f40cdda9e52517ca92e20e8e1a8f3b9fbae83622db",
	},
	{
		kind: "keepsake mobile screenshot",
		path: "docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/keepsake-gallery-mobile-390.png",
		minimumWidth: 0,
		minimumHeight: 0,
		markers: [],
		expectedBytes: 140715,
		expectedSha256: "46a49a68839d23858e9bf96faa5888f45f3a6a2aeb4323ec4d664cff4409eebe",
	},
];
const evidencePageMarkers = [
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
	"Sepolia 待部署",
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
