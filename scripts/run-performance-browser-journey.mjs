import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const expectedRoutes = ["/", "/tasks", "/profile", "/performance", "/evidence"];
const unavailableCoverage = ["navigation.dns", "navigation.tls"];

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
	if (!origin) throw new Error("MISSING_ORIGIN");
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
	const observedRoutes = new Set();
	const coverage = new Set(unavailableCoverage);
	let batchCount = 0;
	let eventCount = 0;
	try {
		const context = await browser.newContext({
			viewport: { width: 1440, height: 900 },
		});
		const page = await context.newPage();
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

		for (const route of expectedRoutes) {
			const response = await page.goto(
				new URL(route, parsedOrigin).toString(),
				{
					waitUntil: "domcontentloaded",
				},
			);
			if (!response?.ok())
				throw new Error(`ROUTE_FAILED_${route.replaceAll("/", "_")}`);
			observedRoutes.add(route);
			await page.locator("body").click({ position: { x: 24, y: 24 } });
			await page.keyboard.press("Tab");
			await page.waitForTimeout(350);
		}

		await page.waitForTimeout(6_000);
		await page.evaluate(() => globalThis.dispatchEvent(new Event("pagehide")));
		await page.waitForTimeout(1_500);
		await context.close();
	} finally {
		await browser.close();
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
