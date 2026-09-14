import { chromium } from "playwright";
import { mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function arg(name) {
	const i = process.argv.indexOf(name);
	return i >= 0 ? process.argv[i + 1] : undefined;
}

const origin = arg("--origin");
const output = arg("--output");
const sessionDir = arg("--session-dir");
const version = arg("--version");
if (!origin || !output || !sessionDir || !version) {
	throw new Error("usage: --origin URL --output FILE --session-dir DIRECTORY --version SHA");
}
if (!new URL(origin).hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
	throw new Error("BABYCARE_RECORDING_REQUIRES_LOCAL_ORIGIN");
}

await mkdir(sessionDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	locale: "zh-CN",
	timezoneId: "Asia/Shanghai",
	recordVideo: { dir: sessionDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const scenes = [];
const mark = async (name) => {
	await page.waitForTimeout(700);
	scenes.push({ name, route: new URL(page.url()).pathname });
};
const visit = async (route, heading) => {
	const response = await page.goto(new URL(route, origin).toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
	if (!response?.ok()) throw new Error(`HTTP_${response?.status()}`);
	await page.getByRole("heading", { name: heading, exact: true }).waitFor();
	await page.waitForTimeout(350);
};

try {
	await visit("/", "BabySteps · 成长星球");
	await mark("首页：选择阶段、市场与城市");
	await page.getByLabel("宝宝阶段").selectOption("newborn");
	await page.getByLabel("体验地区").selectOption("china");
	await page.getByLabel("城市").selectOption("ningbo");
	await page.getByRole("button", { name: "开始 3 分钟陪伴" }).click();
	await mark("访客开始三分钟亲子任务");
	await page.getByRole("button", { name: "完成本次陪伴" }).click();
	await mark("访客完成任务并看到本地保存边界");
	await page.locator("details.advanced-experience").first().locator("summary").click();
	await mark("进阶能力：钱包与链上记录保持可选");
	await visit("/tasks", "成长任务市集");
	await mark("任务页：先看内容，登录后再参与");
	await visit("/parent", "家长成长中心");
	await mark("家长中心：体验记录与长期保存说明");
	await visit("/profile", "个人中心");
	await mark("个人中心：Google 或邮箱登录");
	await visit("/evidence/", "链上工作证据");
	await mark("Evidence：实现边界与可复核证据");
	const audit = await page.evaluate(() => ({
		overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
	}));
	if (audit.overflow !== 0 || pageErrors.length) throw new Error("BABYCARE_RECORDING_GATE_FAILED");
} finally {
	const video = page.video();
	await context.close();
	await browser.close();
	if (video) await video.path();
}

const files = await (await import("node:fs/promises")).readdir(sessionDir);
const videoFile = files.find((file) => file.endsWith(".webm"));
if (!videoFile) throw new Error("BABYCARE_RECORDING_MISSING_VIDEO");
await mkdir(dirname(resolve(output)), { recursive: true });
await rename(resolve(sessionDir, videoFile), resolve(output));
const manifest = {
	format: "webm",
	version,
	origin,
	viewport: "1440x900",
	locale: "zh-CN",
	timezone: "Asia/Shanghai",
	pageErrors,
	overflow: 0,
	scenes,
	boundary: "可见产品流程录制；访客任务使用浏览器本地保存，钱包/链上写入未触发；不代表 AWS Live 或生产 Field RUM。",
};
await (await import("node:fs/promises")).writeFile(`${output}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output, manifest: `${output}.json`, scenes: scenes.length, pageErrors, overflow: 0 }));
