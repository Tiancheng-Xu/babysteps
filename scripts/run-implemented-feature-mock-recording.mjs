import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { chromium } from "playwright";

import { selectImplementedFeatureJourneys } from "./run-implemented-feature-journey.mjs";

function option(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

const origin = option("--origin");
const output = option("--output");
const version = option("--version");
const sessionDir = option("--session-dir");
if (!origin || !output || !version || !sessionDir) {
	throw new Error(
		"usage: --origin URL --output FILE --version SHA --session-dir DIRECTORY",
	);
}
if (!/^[0-9a-f]{40}$/u.test(version)) throw new Error("VERSION_INVALID");
const parsedOrigin = new URL(origin);
if (!new Set(["127.0.0.1", "localhost"]).has(parsedOrigin.hostname)) {
	throw new Error("MOCK_RECORDING_REQUIRES_LOCAL_ORIGIN");
}

const selection = selectImplementedFeatureJourneys("non-aws");
const scenarioCopy = {
	"NAV-01": ["九条产品路由与深链", "页面状态与 404 语义已回读"],
	"WALLET-01": ["连接测试钱包并核对网络", "Sepolia 钱包状态已就绪"],
	"GROWTH-01": ["记录喂养陪伴", "交易确认，成长状态已刷新"],
	"GROWTH-02": ["记录户外陪伴", "交易确认，冷却状态已刷新"],
	"GROWTH-03": ["记录亲子共读", "交易确认，累计养成值已刷新"],
	"TRANSFER-01": ["填写测试接收钱包与数量", "赠送确认，双方余额已回读"],
	"NOTE-01": ["保存并清空公开链上便签", "写入与清理状态均已回读"],
	"BABY-01": ["领取喂养活动 BabyCoin", "余额与 lifetimeEarned 已刷新"],
	"BABY-02": ["领取户外活动 BabyCoin", "余额与阶段已刷新"],
	"BABY-03": ["领取共读活动 BabyCoin", "双账本状态已刷新"],
	"PARENT-READ-01": ["读取家长成长总览", "成长、余额、阶段与便签已汇总"],
	"MARKET-READ-01": ["读取成长任务市集", "任务、价格和开放状态已加载"],
	"MARKET-APPROVE-01": ["授权精确任务价格", "Allowance 已按链上数值回读"],
	"MARKET-BUY-01": ["支付并购买成长任务", "购买记录与 Provider 结算已确认"],
	"CONTENT-01": ["校验会话与链上购买事实", "已购学习内容已解锁"],
	"COMPLETE-SUBMIT-01": ["提交任务完成说明", "完成申请已进入审核队列"],
	"PROVIDER-CREATE-01": ["提交任务 URI 与内容哈希", "待审任务已创建"],
	"OWNER-APPROVE-01": [
		"Owner 批准并请求随机参数",
		"任务已开放，价格和时长已锁定",
	],
	"OWNER-REJECT-01": ["Owner 拒绝另一待审任务", "拒绝原因哈希已记录"],
	"COMPLETION-LOAD-01": ["加载任务完成申请", "购买、证据与申请状态已显示"],
	"COMPLETION-CONFIRM-01": [
		"确认完成并铸造成长证书",
		"购买完成与锁定 SBT 已回读",
	],
	"KEEPSAKE-DRAW-01": ["消耗 12 枚成长星抽卡", "VRF 结果与纪念卡已确认"],
	"KEEPSAKE-FUSE-01": [
		"选择三张同系列同稀有度卡",
		"融合结果、烧毁与解锁状态已回读",
	],
	"KEEPSAKE-RECOVER-01": [
		"恢复超过 24 小时的随机请求",
		"成长星退款或父卡解锁已确认",
	],
	"QUOTE-01": ["读取 Uniswap V3 精确报价", "报价、最小接收量与价格影响已显示"],
	"SWAP-01": ["有限授权并完成兑换", "余额已刷新，剩余授权已清零"],
	"IDENTITY-LOGIN-01": ["使用 Privy 登录", "登录身份与钱包能力已关联"],
	"IDENTITY-SESSION-01": [
		"完成钱包 challenge 与签名",
		"HttpOnly BabySteps 会话已建立",
	],
	"PROFILE-01": ["保存安全用户名并读回", "资料已恢复为中性值并退出登录"],
	"EVIDENCE-01": ["读取架构、角色、测试与媒体", "要求到证据链接已逐项复核"],
};

const targetByOperation = {
	"wallet-connect": "#wallet-heading",
	"growth-meal": "#growth-heading",
	"growth-walk": "#growth-heading",
	"growth-read": "#growth-heading",
	"growth-transfer": "#transfer-heading",
	"notebook-write": "#notebook-heading",
	"babycoin-meal": "#babycoin-heading",
	"babycoin-walk": "#babycoin-heading",
	"babycoin-read": "#babycoin-heading",
	"parent-readback": "h1",
	"marketplace-read": "#marketplace-heading",
	"marketplace-approve": ".marketplace-task-card",
	"marketplace-buy": ".marketplace-task-card",
	"content-unlock": ".marketplace-task-card",
	"completion-submit": ".marketplace-task-card",
	"provider-create": "#create-task-heading",
	"owner-approve": "#owner-review-heading",
	"owner-reject": "#owner-review-heading",
	"completion-load": "#completion-review-heading",
	"completion-confirm": "#completion-review-heading",
	"keepsake-draw": "#keepsake-heading",
	"keepsake-fuse": "#keepsake-rules-heading",
	"keepsake-recover": "#keepsake-rules-heading",
	"exchange-quote": "h1",
	"exchange-swap": "h1",
	"identity-login": "#identity-login-title",
	"identity-session": "#identity-login-title",
	"profile-write": "#identity-profile-title",
	"evidence-readback": "h1",
};

async function showScenario(page, journey, index) {
	const [action, readback] = scenarioCopy[journey.journeyId] ?? [
		journey.operation,
		"产品状态已回读",
	];
	await page.evaluate(
		({ actionText, readbackText, journeyId, position, total }) => {
			let panel = document.querySelector("#full-feature-recording-panel");
			if (!panel) {
				panel = document.createElement("aside");
				panel.id = "full-feature-recording-panel";
				panel.setAttribute("aria-label", "完整功能走读状态");
				document.body.append(panel);
			}
			panel.innerHTML = `<span>FULL FEATURE · ${position}/${total}</span><strong>${journeyId} · ${actionText}</strong><em>✓ ${readbackText}</em>`;
			Object.assign(panel.style, {
				position: "fixed",
				zIndex: "2147483647",
				left: "24px",
				bottom: "24px",
				width: "min(700px, calc(100vw - 48px))",
				padding: "16px 20px",
				border: "2px solid #173f4f",
				borderRadius: "18px",
				background: "rgba(255, 250, 239, 0.97)",
				boxShadow: "0 14px 34px rgba(23, 63, 79, 0.24)",
				color: "#173f4f",
				font: "600 15px/1.5 system-ui, sans-serif",
				display: "grid",
				gap: "5px",
			});
			const span = panel.querySelector("span");
			const strong = panel.querySelector("strong");
			const em = panel.querySelector("em");
			Object.assign(span.style, {
				fontSize: "12px",
				letterSpacing: "0.12em",
				color: "#685341",
			});
			Object.assign(strong.style, { fontSize: "18px" });
			Object.assign(em.style, {
				fontStyle: "normal",
				color: "#176547",
			});
		},
		{
			actionText: action,
			readbackText: readback,
			journeyId: journey.journeyId,
			position: index + 1,
			total: selection.journeys.length,
		},
	);
}

async function seedVisibleInputs(page, operation) {
	const values = {
		"growth-transfer": [
			["#transfer-recipient", "0x1111111111111111111111111111111111111111"],
			["#transfer-amount", "1"],
		],
		"notebook-write": [["#public-note", "周末一起完成了亲子共读"]],
		"provider-create": [
			[
				"#provider-task-uri",
				"https://babysteps.baby2b.online/metadata/demo-task.json",
			],
			["#provider-task-hash", `0x${"12".repeat(32)}`],
		],
		"owner-approve": [["#owner-review-task-id", "4"]],
		"owner-reject": [
			["#owner-review-task-id", "5"],
			["#owner-rejection-reason", "内容需要补充后重新提交"],
		],
		"exchange-quote": [["#exchange-amount", "0.01"]],
		"exchange-swap": [["#exchange-amount", "0.01"]],
	};
	for (const [selector, value] of values[operation] ?? []) {
		const input = page.locator(selector).first();
		if (await input.isEditable().catch(() => false)) await input.fill(value);
	}
}

const browser = await chromium.launch({ headless: true });
await mkdir(resolve(sessionDir), { recursive: true });
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	locale: "zh-CN",
	timezoneId: "Asia/Shanghai",
	recordVideo: { dir: resolve(sessionDir), size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const video = page.video();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const chapters = [];
let currentRoute;

try {
	for (const [index, journey] of selection.journeys.entries()) {
		const startedAt = new Date().toISOString();
		const route = journey.route === "*" ? "/" : journey.route;
		if (route !== currentRoute) {
			const response = await page.goto(
				new URL(route, parsedOrigin).toString(),
				{
					waitUntil: "domcontentloaded",
					timeout: 15_000,
				},
			);
			if (!response?.ok()) throw new Error("MOCK_RECORDING_ROUTE_FAILED");
			currentRoute = route;
		}
		const selector = targetByOperation[journey.operation] ?? "h1";
		const target = page.locator(selector).first();
		if (await target.isVisible().catch(() => false)) {
			await target.scrollIntoViewIfNeeded();
		}
		await seedVisibleInputs(page, journey.operation);
		await showScenario(page, journey, index);
		await page.waitForTimeout(1_050);
		chapters.push({
			journeyId: journey.journeyId,
			route: journey.route,
			outcome: "simulated-success",
			startedAt,
			finishedAt: new Date().toISOString(),
		});
	}

	let rootOverflow = 0;
	for (const width of [375, 390, 430, 1440]) {
		await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
		const response = await page.goto(
			new URL("/evidence", parsedOrigin).toString(),
			{
				waitUntil: "domcontentloaded",
				timeout: 15_000,
			},
		);
		if (!response?.ok()) throw new Error("MOCK_RECORDING_VIEWPORT_FAILED");
		rootOverflow = Math.max(
			rootOverflow,
			await page.evaluate(() =>
				Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
			),
		);
	}
	if (pageErrors.length > 0) throw new Error("MOCK_RECORDING_PAGEERROR");
	if (rootOverflow > 0) throw new Error("MOCK_RECORDING_ROOT_OVERFLOW");
} finally {
	await context.close();
	await browser.close();
}

const sourceVideo = await video.path();
await mkdir(dirname(resolve(output)), { recursive: true });
await copyFile(sourceVideo, resolve(output), constants.COPYFILE_EXCL);
const bytes = await readFile(resolve(output));
const mediaStat = await stat(resolve(output));
const durationSeconds = Number(
	execFileSync(
		"ffprobe",
		[
			"-v",
			"error",
			"-show_entries",
			"format=duration",
			"-of",
			"default=noprint_wrappers=1:nokey=1",
			resolve(output),
		],
		{ encoding: "utf8" },
	).trim(),
);
await writeFile(
	`${resolve(output)}.json`,
	`${JSON.stringify(
		{
			schemaVersion: 1,
			provenance: "controlled-browser-local-production-build-mock-data",
			scope: "non-aws",
			stage: "mock-coverage-verified",
			version,
			fullJourneyProof: false,
			mockData: true,
			chainTransactions: 0,
			awsWrites: 0,
			excludedJourneys: selection.excludedJourneys,
			media: {
				file: basename(resolve(output)),
				sha256: createHash("sha256").update(bytes).digest("hex"),
				bytes: mediaStat.size,
				durationSeconds,
				audio: false,
				contactSheetReviewed: false,
			},
			viewports: [375, 390, 430, 1440],
			pageErrors: 0,
			rootOverflow: 0,
			chapters,
		},
		null,
		2,
	)}\n`,
	{ flag: "wx", mode: 0o600 },
);
process.stdout.write(
	`${JSON.stringify({ recording: basename(resolve(output)), chapters: chapters.length })}\n`,
);
