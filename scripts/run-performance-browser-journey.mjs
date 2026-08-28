import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const journeyRoutes = [
	{ path: "/", heading: "BabySteps · 成长星球" },
	{ path: "/tasks", heading: "成长任务市集" },
	{ path: "/profile", heading: "个人中心" },
	{ path: "/performance", heading: "BabySteps 性能观测站" },
	{ path: "/evidence", heading: "链上工作证据" },
];
const expectedRoutes = journeyRoutes.map(({ path }) => path);
const unavailableCoverage = ["navigation.dns", "navigation.tls"];
const routeTokens = new Map([
	["/", "HOME"],
	["/tasks", "TASKS"],
	["/profile", "PROFILE"],
	["/performance", "PERFORMANCE"],
	["/evidence", "EVIDENCE"],
]);

export function sanitizeJourneyFailure(error, route) {
	const message =
		error instanceof Error ? `${error.name} ${error.message}` : String(error);
	const kind = /timeout/iu.test(message) ? "TIMEOUT" : "FAILED";
	return `ROUTE_${kind}_${routeTokens.get(route) ?? "UNKNOWN"}`;
}

function boundedCount(value) {
	return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function sanitizeJourneySummary(input) {
	const routes = expectedRoutes.filter((route) =>
		input.routes?.includes(route),
	);
	const names = Array.isArray(input.coverage)
		? input.coverage.filter(
				(name) =>
					typeof name === "string" &&
					/^[A-Za-z][A-Za-z0-9._-]{0,63}$/u.test(name),
			)
		: [];
	return {
		routes,
		coverage: {
			observed: [
				...new Set(names.filter((name) => !unavailableCoverage.includes(name))),
			].sort(),
			unavailable: unavailableCoverage,
		},
		batchCount: boundedCount(input.batchCount),
		eventCount: boundedCount(input.eventCount),
	};
}

function readOption(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runJourney() {
	const origin = readOption("--origin");
	const output = readOption("--output") ?? "evidence/browser-journey.json";
	const artifactsDir = readOption("--artifacts-dir");
	const dashboardOnly = process.argv.includes("--dashboard-only");
	const version = readOption("--version");
	if (!origin) throw new Error("MISSING_ORIGIN");
	if (dashboardOnly && !/^[0-9a-f]{12}$/u.test(version ?? "")) {
		throw new Error("INVALID_DASHBOARD_VERSION");
	}
	const parsedOrigin = new URL(origin);
	if (
		parsedOrigin.protocol !== "http:" ||
		!["127.0.0.1", "localhost"].includes(parsedOrigin.hostname) ||
		parsedOrigin.pathname !== "/"
	) {
		throw new Error("INVALID_LOCAL_ORIGIN");
	}

	const { chromium } = await import("playwright");
	const browser = await chromium.launch({ headless: true });
	const videoDir = artifactsDir
		? await mkdtemp(join(tmpdir(), "babysteps-performance-video-"))
		: undefined;
	if (artifactsDir) await mkdir(artifactsDir, { recursive: true });
	const observedRoutes = new Set();
	const coverage = new Set(unavailableCoverage);
	let batchCount = 0;
	let eventCount = 0;
	let liveSampleCount = 0;
	let context;
	let video;
	try {
		context = await browser.newContext({
			viewport: { width: 1440, height: 900 },
			...(videoDir
				? { recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } } }
				: {}),
		});
		const page = await context.newPage();
		video = page.video();
		page.on("request", (request) => {
			if (
				request.method() !== "POST" ||
				new URL(request.url()).pathname !== "/api/performance/events"
			) {
				return;
			}
			try {
				const batch = request.postDataJSON();
				if (!Array.isArray(batch?.events)) return;
				batchCount += 1;
				eventCount += batch.events.length;
				for (const event of batch.events) {
					if (typeof event?.name === "string") coverage.add(event.name);
				}
			} catch {
				// A malformed batch is handled by the Worker/AWS contract, never logged here.
			}
		});

		if (dashboardOnly) {
			const dashboardUrl = new URL("/performance", parsedOrigin);
			dashboardUrl.searchParams.set("window", "1h");
			dashboardUrl.searchParams.set("environment", "production");
			dashboardUrl.searchParams.set("version", version);
			try {
				const response = await page.goto(dashboardUrl.toString(), {
					waitUntil: "domcontentloaded",
				});
				if (!response?.ok()) throw new Error("HTTP_STATUS");
				await page
					.getByRole("heading", {
						name: "BabySteps 性能观测站",
						exact: true,
					})
					.waitFor({ state: "visible" });
				await page
					.getByRole("status")
					.filter({ hasText: "Live · 实时数据" })
					.waitFor({ state: "visible" });
				const sampleText = await page
					.locator(".performance-kpis article")
					.filter({ hasText: "Web Vitals 样本" })
					.locator("strong")
					.innerText();
				liveSampleCount = Number.parseInt(sampleText, 10);
				if (!Number.isSafeInteger(liveSampleCount) || liveSampleCount < 1) {
					throw new Error("NO_LIVE_SAMPLES");
				}
				if (artifactsDir) {
					await page.screenshot({
						path: join(artifactsDir, "performance-live-desktop.png"),
						fullPage: true,
					});
					await page.evaluate(() =>
						globalThis.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
					);
					await page.waitForTimeout(1_200);
					await page.setViewportSize({ width: 390, height: 844 });
					await page.evaluate(() => globalThis.scrollTo(0, 0));
					await page.screenshot({
						path: join(artifactsDir, "performance-live-mobile-390.png"),
						fullPage: true,
					});
				}
				observedRoutes.add("/performance");
			} catch (error) {
				throw new Error(sanitizeJourneyFailure(error, "/performance"));
			}
		} else {
			for (const { path: route, heading } of journeyRoutes) {
				process.stdout.write(`BROWSER_ROUTE_START ${routeTokens.get(route)}\n`);
				try {
					const response = await page.goto(
						new URL(route, parsedOrigin).toString(),
						{ waitUntil: "domcontentloaded" },
					);
					if (!response?.ok()) throw new Error("HTTP_STATUS");
					await page
						.getByRole("heading", { name: heading, exact: true })
						.waitFor({ state: "visible" });
					if (route === "/tasks") {
						await page
							.locator(".marketplace-task-card, .empty-state")
							.first()
							.waitFor({ state: "visible" });
					}
					observedRoutes.add(route);
					await page.locator("body").click({ position: { x: 24, y: 24 } });
					await page.keyboard.press("Tab");
					await page.waitForTimeout(350);
					if (artifactsDir) {
						await page.screenshot({
							path: join(
								artifactsDir,
								`journey-${routeTokens.get(route).toLowerCase()}-desktop.png`,
							),
							fullPage: true,
						});
					}
					process.stdout.write(`BROWSER_ROUTE_OK ${routeTokens.get(route)}\n`);
				} catch (error) {
					throw new Error(sanitizeJourneyFailure(error, route));
				}
			}

			await page.waitForTimeout(6_000);
			await page.evaluate(() => globalThis.dispatchEvent(new Event("pagehide")));
			await page.waitForTimeout(1_500);
		}
	} finally {
		if (context) await context.close().catch(() => undefined);
		if (video && artifactsDir) {
			await video
				.saveAs(
					join(
						artifactsDir,
						dashboardOnly ? "performance-live.webm" : "browser-journey.webm",
					),
				)
				.catch(() => undefined);
		}
		await browser.close();
		if (videoDir) await rm(videoDir, { recursive: true, force: true });
	}

	if (dashboardOnly) {
		await writeFile(
			output,
			`${JSON.stringify({ routes: [...observedRoutes], liveSampleCount }, null, 2)}\n`,
			{ mode: 0o600 },
		);
		return;
	}
	const summary = sanitizeJourneySummary({
		routes: [...observedRoutes],
		coverage: [...coverage],
		batchCount,
		eventCount,
	});
	if (
		summary.routes.length !== expectedRoutes.length ||
		summary.eventCount === 0
	) {
		throw new Error("INCOMPLETE_BROWSER_JOURNEY");
	}
	await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`, {
		mode: 0o600,
	});
	process.stdout.write(`${JSON.stringify(summary)}\n`);
}

const isEntrypoint = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1]
	: false;
if (isEntrypoint) {
	await runJourney().catch((error) => {
		const code =
			error instanceof Error ? error.message : "BROWSER_JOURNEY_FAILED";
		process.stderr.write(
			`${/^[A-Z0-9_]+$/u.test(code) ? code : "BROWSER_JOURNEY_FAILED"}\n`,
		);
		process.exitCode = 1;
	});
}
