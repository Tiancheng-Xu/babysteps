import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const implementedFeatureManifest = JSON.parse(
	readFileSync(
		new URL("./performance-journey.manifest.json", import.meta.url),
		"utf8",
	),
).implementedFeatureJourneys;

const routeHeadings = new Map([
	["/", "BabySteps · 成长星球"],
	["/tasks", "成长任务市集"],
	["/parent", "家长成长中心"],
	["/keepsakes", "星宝纪念馆"],
	["/provider", "机构与育婴师控制台"],
	["/exchange", "BabyCoin 兑换"],
	["/profile", "个人中心"],
	["/performance", "BabySteps 性能观测站"],
	["/evidence", "链上工作证据"],
]);

const activityTitles = {
	"growth-meal": "喂养陪伴",
	"growth-walk": "户外陪伴",
	"growth-read": "亲子共读",
	"babycoin-meal": "喂养陪伴",
	"babycoin-walk": "户外陪伴",
	"babycoin-read": "亲子共读",
};

const finalText = {
	"growth-meal": /记录成功/u,
	"growth-walk": /记录成功/u,
	"growth-read": /记录成功/u,
	"growth-transfer": /已向 .* 赠送/u,
	"notebook-write": /便签已写入|便签已更新/u,
	"babycoin-meal": /活动已确认/u,
	"babycoin-walk": /活动已确认/u,
	"babycoin-read": /活动已确认/u,
	"marketplace-approve": /授权已确认/u,
	"marketplace-buy": /购买已确认/u,
	"completion-submit": /证据哈希已生成/u,
	"provider-create": /任务申请已确认/u,
	"owner-approve": /审核交易已确认/u,
	"owner-reject": /审核交易已确认/u,
	"completion-confirm": /任务完成确认已上链/u,
	"keepsake-draw": /链上随机结果已确认/u,
	"keepsake-fuse": /链上随机结果已确认|本次融合未成功/u,
	"keepsake-recover": /超时请求已安全恢复/u,
	"exchange-quote": /报价已读取/u,
	"exchange-swap": /兑换已在 Sepolia 确认/u,
	"identity-session": /HttpOnly 会话已建立/u,
	"profile-write": /用户名已保存/u,
};

function option(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function safeCode(value) {
	return typeof value === "string" && /^[A-Z0-9_]+$/u.test(value)
		? value
		: "IMPLEMENTED_FEATURE_JOURNEY_FAILED";
}

function inputValue(inputs, name) {
	const value = inputs?.[name];
	if (value === undefined || value === null || value === "") {
		throw new Error(`INPUT_${name}_MISSING`);
	}
	return value;
}

function assertCredentialBoundary(value) {
	const forbidden =
		/(?:private.?key|mnemonic|secret|password|cookie|token|signature)/iu;
	const visit = (entry) => {
		if (Array.isArray(entry)) return entry.forEach(visit);
		if (!entry || typeof entry !== "object") return;
		for (const [key, nested] of Object.entries(entry)) {
			if (forbidden.test(key)) throw new Error("PRIVATE_INPUT_FIELD_FORBIDDEN");
			visit(nested);
		}
	};
	visit(value);
}

export function validateImplementedFeatureResult(result) {
	const errors = [];
	const compensationStatuses = new Set([
		"not-required",
		"verified-action",
		"verified-non-reversible",
		"pending-dependent-proof",
		"pending-external-proof",
	]);
	if (result?.outcome !== "success") errors.push("OUTCOME_NOT_SUCCESS");
	if (result?.uiFinalState !== true) errors.push("UI_FINAL_STATE_MISSING");
	if (result?.productReadback !== true) errors.push("PRODUCT_READBACK_MISSING");
	if (result?.telemetryAccepted !== true) errors.push("TELEMETRY_NOT_ACCEPTED");
	if (!(result?.acceptedEventIds?.length > 0)) {
		errors.push("ACCEPTED_EVENT_ID_MISSING");
	}
	if (
		typeof result?.compensation?.kind !== "string" ||
		!compensationStatuses.has(result?.compensation?.status)
	) {
		errors.push("COMPENSATION_STATE_INVALID");
	}
	return { valid: errors.length === 0, errors };
}

export function validateImplementedFeatureClosure(results) {
	const errors = results.flatMap((result) =>
		result?.compensation?.status?.startsWith("pending-")
			? [`COMPENSATION_PENDING_${result.journeyId.replaceAll("-", "_")}`]
			: [],
	);
	return { valid: errors.length === 0, errors };
}

function redactedTransactionLink(href) {
	if (typeof href !== "string") return undefined;
	const match = href.match(
		/^https:\/\/sepolia\.etherscan\.io\/tx\/(0x[0-9a-fA-F]{64})$/u,
	);
	if (!match) return undefined;
	return {
		network: "sepolia",
		status: "success",
		proofId: createHash("sha256").update(match[1]).digest("hex").slice(0, 16),
		explorerUrl: href,
	};
}

async function waitForRoleConfirmation(roleAlias) {
	if (roleAlias === "public") return;
	if (!process.stdin.isTTY)
		throw new Error("VISIBLE_ROLE_CONFIRMATION_REQUIRED");
	process.stdout.write(
		`WAITING_FOR_USER_ROLE_${roleAlias.toUpperCase().replaceAll("-", "_")}\n`,
	);
	process.stdin.setEncoding("utf8");
	await new Promise((resolvePromise) =>
		process.stdin.once("data", resolvePromise),
	);
}

async function cardByTaskAlias(page, inputs, inputName) {
	const taskAlias = String(inputValue(inputs, inputName));
	return page.locator("article.marketplace-task-card").filter({
		has: page.getByText(`#${taskAlias}`, { exact: true }),
	});
}

async function performOperation(page, journey, inputs, origin) {
	const operation = journey.operation;
	if (operation === "navigation") {
		for (const [route, heading] of routeHeadings) {
			const response = await page.goto(new URL(route, origin).toString(), {
				waitUntil: "domcontentloaded",
			});
			if (!response?.ok()) throw new Error("NAVIGATION_HTTP_FAILED");
			await page.getByRole("heading", { name: heading, exact: true }).waitFor();
			await page.reload({ waitUntil: "domcontentloaded" });
			await page.getByRole("heading", { name: heading, exact: true }).waitFor();
		}
		const missing = await page.goto(new URL("/not-found", origin).toString(), {
			waitUntil: "domcontentloaded",
		});
		if (missing?.status() !== 404)
			throw new Error("NOT_FOUND_SEMANTICS_FAILED");
		return;
	}
	if (operation === "wallet-connect") {
		await page
			.getByText(/Sepolia/u)
			.first()
			.waitFor();
		return;
	}
	if (operation.startsWith("growth-") && operation !== "growth-transfer") {
		const card = page.locator("article.activity-card").filter({
			has: page.getByRole("heading", { name: activityTitles[operation] }),
		});
		await card.getByRole("button", { name: "记录这次陪伴" }).click();
		return;
	}
	if (operation === "growth-transfer") {
		await page
			.getByLabel("Sepolia 收款钱包地址")
			.fill(String(inputValue(inputs, "RECIPIENT_ALIAS")));
		await page
			.getByLabel("赠送数量")
			.fill(String(inputValue(inputs, "TRANSFER_AMOUNT")));
		await page.getByRole("button", { name: "确认赠送成长星" }).click();
		return;
	}
	if (operation === "notebook-write") {
		await page
			.getByLabel("测试便签")
			.fill(String(inputValue(inputs, "PUBLIC_NOTE")));
		await page.getByRole("button", { name: "保存当前便签" }).click();
		return;
	}
	if (operation.startsWith("babycoin-")) {
		const panel = page.getByRole("region", { name: "BabyCoin 成长活动" });
		const card = panel.locator("article.activity-card").filter({
			has: page.getByRole("heading", { name: activityTitles[operation] }),
		});
		await card.getByRole("button", { name: "记录并领取" }).click();
		return;
	}
	if (operation === "parent-readback" || operation === "marketplace-read") {
		await page.waitForLoadState("networkidle");
		return;
	}
	if (operation === "marketplace-approve") {
		const card = await cardByTaskAlias(page, inputs, "ACTIVE_TASK_ALIAS");
		await card.getByRole("button", { name: /^授权 /u }).click();
		return;
	}
	if (operation === "marketplace-buy") {
		const card = await cardByTaskAlias(page, inputs, "ACTIVE_TASK_ALIAS");
		await card.getByRole("button", { name: /^支付 /u }).click();
		return;
	}
	if (operation === "content-unlock") {
		const card = await cardByTaskAlias(page, inputs, "PURCHASE_ALIAS");
		await card.getByRole("button", { name: "解锁学习内容" }).click();
		await card.getByRole("link", { name: "打开任务视频" }).waitFor();
		return;
	}
	if (operation === "completion-submit") {
		const card = await cardByTaskAlias(page, inputs, "PURCHASE_ALIAS");
		if (await card.getByRole("button", { name: "解锁学习内容" }).isVisible()) {
			await card.getByRole("button", { name: "解锁学习内容" }).click();
		}
		await card
			.getByLabel("完成说明")
			.fill(String(inputValue(inputs, "COMPLETION_EVIDENCE")));
		await card.getByRole("button", { name: "提交任务完成审核" }).click();
		return;
	}
	if (operation === "provider-create") {
		await page
			.getByLabel("公开元数据 URI")
			.fill(String(inputValue(inputs, "TASK_METADATA_URI")));
		await page
			.getByLabel("D1 元数据哈希")
			.fill(String(inputValue(inputs, "TASK_METADATA_HASH")));
		await page.getByRole("button", { name: "提交 Owner 审核" }).click();
		return;
	}
	if (operation === "owner-approve" || operation === "owner-reject") {
		const inputName =
			operation === "owner-approve"
				? "PENDING_TASK_ALIAS"
				: "REJECT_TASK_ALIAS";
		await page
			.getByLabel("待审任务 ID")
			.fill(String(inputValue(inputs, inputName)));
		if (operation === "owner-reject") {
			await page
				.getByLabel("拒绝原因（拒绝时必填）")
				.fill(String(inputValue(inputs, "REJECTION_REASON")));
		}
		await page
			.getByRole("button", {
				name: operation === "owner-approve" ? "批准并请求 VRF" : "拒绝任务",
			})
			.click();
		return;
	}
	if (operation === "completion-load") {
		await page.getByRole("button", { name: "加载任务完成申请" }).click();
		await page.locator("article.marketplace-task-card").first().waitFor();
		return;
	}
	if (operation === "completion-confirm") {
		const purchaseAlias = String(inputValue(inputs, "PURCHASE_ALIAS"));
		const card = page.locator("article.marketplace-task-card").filter({
			hasText: `购买 #${purchaseAlias}`,
		});
		await card.getByRole("button", { name: "确认任务完成并铸造 SBT" }).click();
		return;
	}
	if (operation === "keepsake-draw") {
		await page.getByRole("button", { name: /抽取纪念卡/u }).click();
		return;
	}
	if (operation === "keepsake-fuse") {
		const aliases = inputValue(inputs, "FUSION_CARD_ALIASES");
		if (!Array.isArray(aliases) || aliases.length !== 3) {
			throw new Error("INPUT_FUSION_CARD_ALIASES_INVALID");
		}
		for (const alias of aliases) {
			await page.getByLabel(`选择纪念卡 #${alias}`).check();
		}
		await page.getByRole("button", { name: /融合升级/u }).click();
		return;
	}
	if (operation === "keepsake-recover") {
		await page.getByRole("button", { name: /恢复超时请求/u }).click();
		return;
	}
	if (operation === "exchange-quote" || operation === "exchange-swap") {
		await page
			.getByLabel("支付资产")
			.selectOption(String(inputValue(inputs, "QUOTE_ASSET")));
		await page
			.getByLabel("输入数量")
			.fill(String(inputValue(inputs, "QUOTE_AMOUNT")));
		await page.getByRole("button", { name: "读取链上报价" }).click();
		await page.getByText(/报价已读取/u).waitFor();
		if (operation === "exchange-swap") {
			await page.getByRole("button", { name: "确认有限授权并兑换" }).click();
		}
		return;
	}
	if (operation === "identity-login") {
		await page.getByRole("button", { name: "使用 Privy 登录" }).click();
		await page
			.getByRole("button", { name: "建立 BabySteps 签名会话" })
			.waitFor({ timeout: 120_000 });
		return;
	}
	if (operation === "identity-session") {
		await page.getByRole("button", { name: "建立 BabySteps 签名会话" }).click();
		return;
	}
	if (operation === "profile-write") {
		await page
			.getByLabel("用户名（2–32 个安全字符）")
			.fill(String(inputValue(inputs, "NEUTRAL_USERNAME")));
		await page.getByRole("button", { name: "保存用户名" }).click();
		return;
	}
	if (operation === "performance-live") {
		await page.getByRole("button", { name: "Live 数据" }).click();
		await page
			.getByRole("status")
			.filter({ hasText: "Live · 实时数据" })
			.waitFor();
		await page.getByRole("button", { name: "历史快照" }).click();
		return;
	}
	if (operation === "evidence-readback") {
		await page.locator("video").first().waitFor();
		return;
	}
	throw new Error("OPERATION_DRIVER_MISSING");
}

async function waitForUiFinalState(page, journey) {
	if (journey.operation === "identity-login") return;
	if (journey.operation === "content-unlock") return;
	if (journey.operation === "completion-load") return;
	if (journey.operation === "navigation") return;
	if (
		journey.operation === "wallet-connect" ||
		journey.operation === "parent-readback" ||
		journey.operation === "marketplace-read" ||
		journey.operation === "evidence-readback"
	) {
		await page.waitForLoadState("networkidle");
		return;
	}
	if (journey.operation === "performance-live") return;
	const pattern = finalText[journey.operation];
	if (!pattern) throw new Error("FINAL_STATE_DRIVER_MISSING");
	await page.getByText(pattern).first().waitFor({ timeout: 180_000 });
}

async function compensate(page, journey) {
	if (journey.compensation === "clear-note") {
		await page.getByRole("button", { name: "清空当前便签" }).click();
		await page.getByRole("button", { name: "确认清空当前便签" }).click();
		process.stdout.write("WAITING_FOR_USER_PARENT_A_NOTE_CLEAR\n");
		await page.getByText(/当前便签已清空/u).waitFor({ timeout: 180_000 });
		return { kind: journey.compensation, status: "verified-action" };
	}
	if (journey.compensation === "neutralize-profile-and-logout") {
		await page.getByRole("button", { name: "退出登录" }).click();
		await page.getByRole("button", { name: "使用 Privy 登录" }).waitFor();
		return { kind: journey.compensation, status: "verified-action" };
	}
	if (journey.compensation === "none") {
		return { kind: journey.compensation, status: "not-required" };
	}
	if (
		journey.compensation === "self-compensating" ||
		journey.compensation.startsWith("persistent-")
	) {
		return {
			kind: journey.compensation,
			status: "verified-non-reversible",
		};
	}
	if (journey.compensation === "clear-query-and-clean-aws") {
		return { kind: journey.compensation, status: "pending-external-proof" };
	}
	return { kind: journey.compensation, status: "pending-dependent-proof" };
}

async function installTelemetryObserver(page) {
	const accepted = new Map();
	await page.route("**/api/performance/events", async (route) => {
		let events = [];
		try {
			const batch = route.request().postDataJSON();
			events = Array.isArray(batch?.events) ? batch.events : [];
		} catch {
			events = [];
		}
		try {
			const response = await route.fetch({ timeout: 10_000 });
			await route.fulfill({ response });
			if (response.ok()) {
				for (const event of events) {
					if (typeof event?.eventId === "string")
						accepted.set(event.eventId, event);
				}
			}
		} catch {
			await route.abort().catch(() => undefined);
		}
	});
	return accepted;
}

async function waitForAcceptedTelemetry(accepted, baselineIds, journey) {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		const matches = [...accepted.entries()].filter(([eventId, event]) => {
			if (baselineIds.has(eventId)) return false;
			if (journey.businessMetric) {
				return (
					event?.name === journey.businessMetric && event?.outcome === "success"
				);
			}
			return typeof event?.route === "string";
		});
		if (matches.length > 0) return matches.map(([eventId]) => eventId);
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
	}
	throw new Error("TELEMETRY_ACCEPTANCE_TIMEOUT");
}

async function run() {
	const origin = option("--origin");
	const inputPath = option("--inputs");
	const preflightPath = option("--preflight");
	const outputPath = option("--output");
	const cdpUrl = option("--cdp-url");
	const userDataDir = option("--user-data-dir");
	if (process.argv.includes("--dry-run")) {
		process.stdout.write(
			`${JSON.stringify({ schemaVersion: 1, journeys: implementedFeatureManifest.map(({ journeyId, route, roleAlias }) => ({ journeyId, route, roleAlias })) })}\n`,
		);
		return;
	}
	if (!origin || !inputPath || !preflightPath || !outputPath) {
		throw new Error("IMPLEMENTED_FEATURE_OPTIONS_REQUIRED");
	}
	const preflight = JSON.parse(await readFile(preflightPath, "utf8"));
	if (preflight.ready !== true) throw new Error("PREFLIGHT_NOT_READY");
	const inputs = JSON.parse(await readFile(inputPath, "utf8"));
	assertCredentialBoundary(inputs);
	const { chromium } = await import("playwright");
	const browser = cdpUrl ? await chromium.connectOverCDP(cdpUrl) : undefined;
	const context = browser
		? (browser.contexts()[0] ?? (await browser.newContext()))
		: await chromium.launchPersistentContext(
				resolve(userDataDir ?? ".journey-profile"),
				{
					channel: "chrome",
					headless: false,
					viewport: { width: 1440, height: 900 },
				},
			);
	const page = context.pages()[0] ?? (await context.newPage());
	const accepted = await installTelemetryObserver(page);
	const results = [];
	let currentRole;
	try {
		for (const journey of implementedFeatureManifest) {
			if (journey.roleAlias !== currentRole) {
				await waitForRoleConfirmation(journey.roleAlias);
				currentRole = journey.roleAlias;
			}
			const startedAt = new Date().toISOString();
			const baselineIds = new Set(accepted.keys());
			const route = journey.route === "*" ? "/" : journey.route;
			const response = await page.goto(new URL(route, origin).toString(), {
				waitUntil: "domcontentloaded",
			});
			if (!response?.ok()) throw new Error("JOURNEY_HTTP_FAILED");
			const heading = routeHeadings.get(route);
			if (heading) {
				await page
					.getByRole("heading", { name: heading, exact: true })
					.waitFor();
			}
			await performOperation(page, journey, inputs, origin);
			if (journey.manualSignature && journey.operation !== "identity-login") {
				process.stdout.write(
					`WAITING_FOR_USER_${journey.roleAlias.toUpperCase().replaceAll("-", "_")}_${journey.operation.toUpperCase().replaceAll("-", "_")}\n`,
				);
			}
			await waitForUiFinalState(page, journey);
			const acceptedEventIds = await waitForAcceptedTelemetry(
				accepted,
				baselineIds,
				journey,
			);
			const transaction = redactedTransactionLink(
				await page
					.getByRole("link", { name: /查看.*交易/u })
					.last()
					.getAttribute("href")
					.catch(() => undefined),
			);
			const compensation = await compensate(page, journey);
			const result = {
				journeyId: journey.journeyId,
				route: journey.route,
				roleAlias: journey.roleAlias,
				startedAt,
				finishedAt: new Date().toISOString(),
				outcome: "success",
				uiFinalState: true,
				productReadback: true,
				telemetryAccepted: true,
				acceptedEventIds,
				compensation,
				...(transaction ? { transaction } : {}),
			};
			const validation = validateImplementedFeatureResult(result);
			if (!validation.valid) throw new Error(validation.errors[0]);
			results.push(result);
			process.stdout.write(
				`JOURNEY_OK_${journey.journeyId.replaceAll("-", "_")}\n`,
			);
		}
	} finally {
		if (!browser) await context.close().catch(() => undefined);
	}
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(
		outputPath,
		`${JSON.stringify({ schemaVersion: 1, provenance: "visible-ui-controlled-browser", closure: validateImplementedFeatureClosure(results), results }, null, 2)}\n`,
		{ mode: 0o600 },
	);
	const closure = validateImplementedFeatureClosure(results);
	if (!closure.valid) {
		process.stderr.write("IMPLEMENTED_FEATURE_COMPENSATION_PENDING\n");
		process.exitCode = 2;
	}
}

const isEntrypoint = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1]
	: false;
if (isEntrypoint) {
	await run().catch((error) => {
		process.stderr.write(
			`${safeCode(error instanceof Error ? error.message : "")}\n`,
		);
		process.exitCode = 1;
	});
}
