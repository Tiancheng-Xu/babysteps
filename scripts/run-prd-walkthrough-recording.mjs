import { constants } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { chromium } from "playwright";

function argument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

const origin = argument("--origin");
const output = argument("--output");
const version = argument("--version");
const sessionDir = argument("--session-dir");
if (!origin || !output || !version || !sessionDir) {
	throw new Error(
		"usage: --origin URL --output FILE --version SHA --session-dir DIRECTORY",
	);
}
const parsedOrigin = new URL(origin);
if (!new Set(["127.0.0.1", "localhost"]).has(parsedOrigin.hostname)) {
	throw new Error("PRD_RECORDING_REQUIRES_LOCAL_ORIGIN");
}

const coverage = [];
const settledOutcomes = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	locale: "zh-CN",
	timezoneId: "Asia/Shanghai",
	recordVideo: { dir: sessionDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const video = page.video();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function caption(title, boundary) {
	await page.evaluate(
		({ titleText, boundaryText }) => {
			let element = document.querySelector("#prd-recording-caption");
			if (!element) {
				element = document.createElement("aside");
				element.id = "prd-recording-caption";
				element.setAttribute("aria-label", "录屏证据边界");
				document.body.append(element);
			}
			element.innerHTML = `<strong>${titleText}</strong><span>${boundaryText}</span>`;
			Object.assign(element.style, {
				position: "fixed",
				zIndex: "2147483647",
				left: "24px",
				bottom: "24px",
				maxWidth: "min(680px, calc(100vw - 48px))",
				padding: "14px 18px",
				border: "2px solid #173f4f",
				borderRadius: "16px",
				background: "rgba(255, 250, 239, 0.96)",
				boxShadow: "0 12px 28px rgba(23, 63, 79, 0.22)",
				color: "#173f4f",
				font: "600 16px/1.5 system-ui, sans-serif",
				display: "grid",
				gap: "4px",
			});
		},
		{ titleText: title, boundaryText: boundary },
	);
	await page.waitForTimeout(1_300);
}

async function visit(route, heading, title, boundary) {
	const response = await page.goto(new URL(route, parsedOrigin).toString(), {
		waitUntil: "domcontentloaded",
		timeout: 15_000,
	});
	if (!response?.ok())
		throw new Error(`PRD_RECORDING_HTTP_${response?.status()}`);
	await page.getByRole("heading", { name: heading, exact: true }).waitFor();
	await caption(title, boundary);
	coverage.push({ route, title, boundary });
}

async function showHeading(name, title, boundary) {
	const heading = page.getByRole("heading", { name, exact: true }).first();
	await heading.scrollIntoViewIfNeeded();
	await caption(title, boundary);
	coverage.push({ route: new URL(page.url()).pathname, title, boundary });
}

try {
	await visit(
		"/",
		"BabySteps · 成长星球",
		"PRD 1/11 · Sepolia 与隐私边界",
		"真实本地生产构建；不读取私钥、助记词、Cookie 或儿童资料。",
	);
	await showHeading(
		"步骤 1 · 连接测试钱包",
		"PRD 2/11 · 钱包与网络状态",
		"画面展示当前未安装/未连接状态；连接中、错网、拒签与读取失败由确定性组件测试验证。",
	);
	await showHeading(
		"步骤 2 · 虚拟伙伴养成",
		"PRD 3/11 · 双账本、阶段、活动与冷却",
		"三项奖励、UTC+8 上限、冷却和 receipt 后刷新由合约与前端测试验证；本录屏不发交易填数。",
	);
	await showHeading(
		"步骤 3 · 测试钱包赠送",
		"PRD 4/11 · 赠送成长星",
		"地址、零地址、自己地址、整数与余额校验均已测试；本录屏不签名、不转移测试资产。",
	);
	await showHeading(
		"步骤 4 · 链上家庭便签",
		"PRD 5/11 · 公开链上便签",
		"读取、覆盖、280 字节、清空确认与 receipt 后刷新由测试验证；历史不可删除边界保持可见。",
	);

	await visit(
		"/tasks",
		"成长任务市集",
		"PRD 6/11 · 成长任务市集",
		"只读 Sepolia 任务与 RPC 状态；购买、完成和证书不在匿名录屏中自动执行。",
	);
	await visit(
		"/parent",
		"家长成长中心",
		"PRD 7/11 · 家长总览",
		"同一组件树汇总 BabyCoin、累计成长、活动与公开便签。",
	);
	await visit(
		"/keepsakes",
		"星宝纪念馆",
		"PRD 8/11 · 抽卡、融合与恢复",
		"固定 12 星、VRF、三卡融合与 24 小时恢复已有合约测试和 Sepolia Evidence；录屏不重复消费。",
	);
	await visit(
		"/provider",
		"机构与育婴师控制台",
		"PRD 9/11 · Provider、Owner 与完成证书",
		"角色门禁、审核、随机价格、购买、完成和锁定 SBT 均有测试/链上 Evidence；无授权钱包时诚实阻断。",
	);
	await visit(
		"/exchange",
		"BabyCoin 兑换",
		"PRD 10/11 · Uniswap 只读报价",
		"只执行 Sepolia Quoter 读取；不 approve、不 swap、不支付 Gas。",
	);
	const amount = page.getByRole("textbox", { name: "输入数量" });
	await amount.fill("1");
	await page.getByRole("button", { name: "读取链上报价" }).click();
	const settledQuote = page.getByRole("status").filter({ hasNotText: "正在" });
	await settledQuote.waitFor({ timeout: 15_000 });
	const settledQuoteText = (await settledQuote.textContent()) ?? "";
	const quoteOutcome = settledQuoteText.includes("报价已读取")
		? "success"
		: "failure";
	settledOutcomes.push({
		operation: "web3.uniswap.quote",
		outcome: quoteOutcome,
	});
	await caption(
		`只读报价已结算 · ${quoteOutcome}`,
		"成功或脱敏失败都保留真实 outcome；失败不能冒充成功样本。",
	);

	await visit(
		"/profile",
		"个人中心",
		"身份与钱包能力",
		"Google、邮箱、外部钱包与 Smart Wallet 边界可见；本录屏不进入第三方认证。",
	);
	await visit(
		"/performance?mode=history",
		"BabySteps 性能观测站",
		"PRD 11/11 · 性能与可靠性",
		"历史快照与 Live API 明确分层；样本、分位数、来源、新鲜度和不可用状态均不伪造。",
	);
	const routeFilter = page.getByRole("textbox", { name: "页面路径" });
	if (await routeFilter.isEnabled()) {
		await routeFilter.fill("/performance");
		await page.getByRole("button", { name: "应用筛选" }).click();
		settledOutcomes.push({
			operation: "performance.filter",
			outcome: "success",
		});
		await caption(
			"性能筛选已执行",
			"筛选状态写入 History URL；本地录屏不冒充 AWS Live 管线。",
		);
	} else {
		settledOutcomes.push({
			operation: "performance.filter",
			outcome: "unavailable",
		});
		await caption(
			"性能筛选 · Runtime 关闭态",
			"筛选控件随 Live API 不可用而禁用；历史快照仍可读，云端筛选由独立 Run Evidence 证明。",
		);
	}

	await visit(
		"/evidence",
		"链上工作证据",
		"Evidence · 要求到证据的可追溯闭环",
		"架构、时序、测试、链上交易、云端 Run 与限制分开记录。",
	);
	await showHeading(
		"要求、实现与证据映射",
		"完成标准与状态矩阵",
		"功能成功、空、错误、降级和待外部授权状态均由对应测试或真实 Evidence 支撑。",
	);

	await page.setViewportSize({ width: 390, height: 844 });
	await visit(
		"/",
		"BabySteps · 成长星球",
		"移动端 390 px",
		"同一组件树、同一阅读顺序、无根级横向溢出。",
	);
	await visit(
		"/performance?mode=history",
		"BabySteps 性能观测站",
		"移动端性能观测",
		"指标表可横向查看，但页面根节点保持无横向溢出。",
	);
	if (pageErrors.length > 0) throw new Error("PRD_RECORDING_PAGEERROR");
	await caption(
		"录屏结束 · 真实边界",
		"本视频证明本地 UI 与安全只读交互；链上写入、第三方登录和 AWS 闭环以独立 Evidence 为准。",
	);
} finally {
	await context.close();
	await browser.close();
}

const sourceVideo = await video.path();
await mkdir(dirname(resolve(output)), { recursive: true });
await copyFile(sourceVideo, resolve(output), constants.COPYFILE_EXCL);
await writeFile(
	`${resolve(output)}.json`,
	`${JSON.stringify(
		{
			schemaVersion: 1,
			provenance: "controlled-browser-local-production-build",
			fullJourneyProof: false,
			version,
			origin: parsedOrigin.origin,
			video: resolve(output).split("/").pop(),
			viewports: [
				{ width: 1440, height: 900 },
				{ width: 390, height: 844 },
			],
			pageErrors: 0,
			walletWrites: 0,
			chainTransactions: 0,
			settledOutcomes,
			coverage,
		},
		null,
		2,
	)}\n`,
	{ flag: "wx" },
);
process.stdout.write(
	`${JSON.stringify({ output: basename(resolve(output)), segments: coverage.length })}\n`,
);
