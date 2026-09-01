import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

const baseUrl = new URL(process.env.PERF_URL ?? "http://127.0.0.1:4176");
const label = process.env.PERF_LABEL?.trim();
const outputDirectory = resolve(
	process.env.PERF_OUTPUT_DIR ??
		"docs/evidence/testing/design-system-performance",
);

if (!label || !/^[a-z0-9-]+$/u.test(label)) {
	throw new Error("PERF_LABEL must be a lowercase filesystem-safe label");
}
if (!new Set(["127.0.0.1", "localhost"]).has(baseUrl.hostname)) {
	throw new Error(
		`performance lab accepts loopback URLs only: ${baseUrl.origin}`,
	);
}

await mkdir(outputDirectory, { recursive: true });

const percentile = (values, rank) => {
	const sorted = [...values].sort((left, right) => left - right);
	return (
		sorted[Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1)] ?? null
	);
};

const summarize = (samples, key) => {
	const values = samples
		.map((sample) => sample[key])
		.filter((value) => Number.isFinite(value));
	return {
		sampleCount: values.length,
		p50: percentile(values, 50),
		p75: percentile(values, 75),
		p95: percentile(values, 95),
	};
};

const installPerformanceObservers = () => {
	window.__BABYSTEPS_DESIGN_LAB__ = {
		lcp: [],
		layoutShifts: [],
		longTasks: [],
		interactions: [],
	};
	const observe = (type, callback, options = { buffered: true }) => {
		try {
			new PerformanceObserver((list) => callback(list.getEntries())).observe({
				type,
				...options,
			});
		} catch {
			// Unsupported diagnostics remain absent instead of being fabricated.
		}
	};
	observe("largest-contentful-paint", (entries) => {
		window.__BABYSTEPS_DESIGN_LAB__.lcp.push(
			...entries.map((entry) => entry.startTime),
		);
	});
	observe("layout-shift", (entries) => {
		window.__BABYSTEPS_DESIGN_LAB__.layoutShifts.push(
			...entries
				.filter((entry) => !entry.hadRecentInput)
				.map((entry) => entry.value),
		);
	});
	observe("longtask", (entries) => {
		window.__BABYSTEPS_DESIGN_LAB__.longTasks.push(
			...entries.map((entry) => entry.duration),
		);
	});
	observe(
		"event",
		(entries) => {
			window.__BABYSTEPS_DESIGN_LAB__.interactions.push(
				...entries
					.filter((entry) => entry.interactionId > 0)
					.map((entry) => ({
						name: entry.name,
						duration: entry.duration,
						interactionId: entry.interactionId,
					})),
			);
		},
		{ buffered: true, durationThreshold: 16 },
	);
};

const readMetrics = (page) =>
	page.evaluate(() => {
		const navigation = performance.getEntriesByType("navigation")[0];
		const paints = performance.getEntriesByType("paint");
		const lab = window.__BABYSTEPS_DESIGN_LAB__;
		const interactions = new Map();
		for (const entry of lab.interactions) {
			interactions.set(
				entry.interactionId,
				Math.max(interactions.get(entry.interactionId) ?? 0, entry.duration),
			);
		}
		return {
			ttfbMs: navigation
				? navigation.responseStart - navigation.requestStart
				: null,
			fcpMs:
				paints.find((entry) => entry.name === "first-contentful-paint")
					?.startTime ?? null,
			lcpMs: lab.lcp.at(-1) ?? null,
			cls: lab.layoutShifts.reduce((total, value) => total + value, 0),
			longTaskCount: lab.longTasks.length,
			longTaskTotalMs: lab.longTasks.reduce(
				(total, duration) => total + duration,
				0,
			),
			inpMs: interactions.size > 0 ? Math.max(...interactions.values()) : null,
			domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
			loadMs: navigation?.loadEventEnd ?? null,
		};
	});

const startTrace = async (session) => {
	const events = [];
	let resolveComplete;
	const complete = new Promise((resolvePromise) => {
		resolveComplete = resolvePromise;
	});
	session.on("Tracing.dataCollected", ({ value }) => events.push(...value));
	session.once("Tracing.tracingComplete", resolveComplete);
	await session.send("Tracing.start", {
		categories: [
			"devtools.timeline",
			"disabled-by-default-devtools.timeline",
			"blink.user_timing",
			"loading",
			"v8.execute",
		].join(","),
		options: "sampling-frequency=10000",
	});
	return async (path) => {
		await session.send("Tracing.end");
		await complete;
		await writeFile(
			path,
			gzipSync(JSON.stringify({ traceEvents: events }), { level: 9 }),
		);
	};
};

const browser = await chromium.launch({
	headless: true,
	args: [
		"--force-color-profile=srgb",
		"--font-render-hinting=none",
		"--lang=zh-CN",
	],
});

const browserVersion = browser.version();
const coldLoads = [];
const interactions = [];
const blockExternalFonts = (context) =>
	context.route(
		(url) =>
			new Set(["fonts.googleapis.com", "fonts.gstatic.com"]).has(
				new URL(url).hostname,
			),
		(route) => route.abort("blockedbyclient"),
	);

try {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const context = await browser.newContext({
			viewport: { width: 1440, height: 1000 },
			deviceScaleFactor: 1,
			locale: "zh-CN",
			timezoneId: "UTC",
			colorScheme: "light",
			reducedMotion: "reduce",
		});
		await blockExternalFonts(context);
		await context.addInitScript(installPerformanceObservers);
		const page = await context.newPage();
		const pageErrors = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));
		const session = await context.newCDPSession(page);
		await session.send("Network.enable");
		await session.send("Network.setCacheDisabled", { cacheDisabled: true });
		const finishTrace = attempt === 0 ? await startTrace(session) : null;
		await page.goto(new URL("/", baseUrl).toString(), {
			waitUntil: "networkidle",
			timeout: 30_000,
		});
		await page.waitForTimeout(500);
		const metrics = await readMetrics(page);
		coldLoads.push({ attempt: attempt + 1, pageErrors, ...metrics });
		if (attempt === 0) {
			await page.screenshot({
				path: join(outputDirectory, `${label}-cold-load.png`),
				fullPage: true,
			});
			await finishTrace(
				join(outputDirectory, `${label}-cold-load-trace.json.gz`),
			);
		}
		await context.close();
	}

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const context = await browser.newContext({
			viewport: { width: 1440, height: 1000 },
			deviceScaleFactor: 1,
			locale: "zh-CN",
			timezoneId: "UTC",
			colorScheme: "light",
			reducedMotion: "reduce",
		});
		await blockExternalFonts(context);
		await context.addInitScript(installPerformanceObservers);
		const page = await context.newPage();
		const pageErrors = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));
		await page.goto(new URL("/", baseUrl).toString(), {
			waitUntil: "networkidle",
			timeout: 30_000,
		});
		const session = await context.newCDPSession(page);
		const finishTrace = attempt === 0 ? await startTrace(session) : null;
		const startedAt = performance.now();
		await page.getByRole("link", { name: "成长任务" }).click();
		await page.waitForURL((url) => url.pathname === "/tasks");
		await page
			.getByRole("heading", { name: "成长任务市集" })
			.waitFor({ state: "visible", timeout: 10_000 });
		await page.evaluate(
			() =>
				new Promise((resolvePromise) => requestAnimationFrame(resolvePromise)),
		);
		await page.waitForTimeout(100);
		const interactionElapsedMs = performance.now() - startedAt;
		const metrics = await readMetrics(page);
		interactions.push({
			attempt: attempt + 1,
			pageErrors,
			interactionElapsedMs,
			...metrics,
		});
		if (attempt === 0) {
			await page.screenshot({
				path: join(outputDirectory, `${label}-interaction.png`),
				fullPage: true,
			});
			await finishTrace(
				join(outputDirectory, `${label}-interaction-trace.json.gz`),
			);
		}
		await context.close();
	}
} finally {
	await browser.close();
}

const result = {
	schemaVersion: 1,
	label,
	source: "local-lab",
	confidence: "low-n3",
	urlOrigin: baseUrl.origin,
	routes: { coldLoad: "/", interaction: "/ -> /tasks" },
	environment: {
		browser: `Chromium ${browserVersion}`,
		viewport: "1440x1000",
		deviceScaleFactor: 1,
		locale: "zh-CN",
		timezone: "UTC",
		colorScheme: "light",
		reducedMotion: true,
		cache: "disabled for cold load; fresh context per sample",
		network: "unthrottled loopback",
		thirdPartyFonts:
			"fonts.googleapis.com and fonts.gstatic.com blocked equally for deterministic fallback-font comparison",
		cpu: "unthrottled",
	},
	coldLoads,
	interactions,
	summary: {
		coldLoad: Object.fromEntries(
			["ttfbMs", "fcpMs", "lcpMs", "cls", "longTaskTotalMs"].map((key) => [
				key,
				summarize(coldLoads, key),
			]),
		),
		interaction: Object.fromEntries(
			["interactionElapsedMs", "inpMs", "longTaskTotalMs"].map((key) => [
				key,
				summarize(interactions, key),
			]),
		),
	},
};

if (
	[...coldLoads, ...interactions].some((sample) => sample.pageErrors.length > 0)
) {
	throw new Error("performance lab observed an uncaught page error");
}

await writeFile(
	join(outputDirectory, `${label}-metrics.json`),
	`${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result.summary));
