import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const probeFont = Buffer.from(
	readFileSync(
		new URL("./fixtures/performance-probe-font.base64", import.meta.url),
		"utf8",
	).trim(),
	"base64",
);

export const journeyManifest = JSON.parse(
	readFileSync(
		new URL("./performance-journey.manifest.json", import.meta.url),
		"utf8",
	),
);
export const journeyRoutes = journeyManifest.routes;
const expectedRoutes = journeyRoutes.map(({ path }) => path);
const unavailableCoverage = journeyManifest.unavailableMetrics;
const routeTokens = new Map([
	["/", "HOME"],
	["/tasks", "TASKS"],
	["/parent", "PARENT"],
	["/keepsakes", "KEEPSAKES"],
	["/provider", "PROVIDER"],
	["/exchange", "EXCHANGE"],
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

export function createTelemetryDeliveryTracker() {
	const observedEventIds = new Set();
	const acceptedEventIds = new Set();
	const openAttempts = new Set();
	let batchCount = 0;
	let acceptedBatchCount = 0;
	let rejectedBatchCount = 0;
	let transportFailureCount = 0;

	const eventIds = (batch, attemptNumber) =>
		Array.isArray(batch?.events)
			? batch.events.map((event, index) =>
					typeof event?.eventId === "string" && event.eventId.length > 0
						? event.eventId
						: `invalid-${attemptNumber}-${index}`,
				)
			: [`invalid-${attemptNumber}-batch`];
	const finish = (attempt) => {
		if (!openAttempts.delete(attempt)) {
			throw new Error("TELEMETRY_ATTEMPT_ALREADY_FINISHED");
		}
	};
	const unacceptedEventCount = () =>
		[...observedEventIds].filter((id) => !acceptedEventIds.has(id)).length;

	return {
		beginAttempt(batch) {
			batchCount += 1;
			const attempt = { eventIds: eventIds(batch, batchCount) };
			for (const id of attempt.eventIds) observedEventIds.add(id);
			openAttempts.add(attempt);
			return attempt;
		},
		markAccepted(attempt) {
			finish(attempt);
			acceptedBatchCount += 1;
			for (const id of attempt.eventIds) acceptedEventIds.add(id);
		},
		markRejected(attempt) {
			finish(attempt);
			rejectedBatchCount += 1;
		},
		markTransportFailure(attempt) {
			finish(attempt);
			transportFailureCount += 1;
		},
		isSettled() {
			return (
				openAttempts.size === 0 &&
				observedEventIds.size > 0 &&
				unacceptedEventCount() === 0
			);
		},
		snapshot() {
			return {
				batchCount,
				acceptedBatchCount,
				rejectedBatchCount,
				transportFailureCount,
				eventCount: observedEventIds.size,
				unacceptedEventCount: unacceptedEventCount(),
			};
		},
	};
}

export function evaluateJourneyCoverage({ observed = [], required = [] }) {
	const observedNames = new Set(observed);
	const missing = [...new Set(required)]
		.filter((name) => !observedNames.has(name))
		.sort();
	return { complete: missing.length === 0, missing };
}

const requiredBusinessMetricRoutes = new Map([
	...journeyManifest.safeReadOnlySettles.flatMap((scenario) =>
		scenario.expectedMetrics.map((name) => [name, scenario.route]),
	),
	...journeyManifest.safeBusinessInteractions.flatMap((scenario) =>
		(scenario.expectedMetrics ?? [scenario.expectedMetric]).map((name) => [
			name,
			scenario.route,
		]),
	),
]);

function normalizedEventRoute(event) {
	return typeof event?.route === "string" ? event.route.split(/[?#]/u)[0] : "";
}

export function requiredMetricForObservedEvent(event) {
	const name = typeof event?.name === "string" ? event.name : "";
	const eventRoute = normalizedEventRoute(event);
	if (journeyManifest.requiredMetrics.includes(name)) {
		const requiredRoute = requiredBusinessMetricRoutes.get(name);
		if (requiredRoute) {
			if (event.type !== "web3" || eventRoute !== requiredRoute) {
				return undefined;
			}
			if (event.outcome === "failure" || event.outcome === "unavailable") {
				return undefined;
			}
		}
		return name;
	}
	if (event.type === "web3" && name.endsWith(".error")) {
		const baseName = name.slice(0, -".error".length);
		const requiredRoute = requiredBusinessMetricRoutes.get(baseName);
		if (
			journeyManifest.requiredWeb3Metrics.includes(baseName) &&
			requiredRoute === eventRoute &&
			event.outcome !== "success" &&
			event.outcome !== "unavailable"
		) {
			return baseName;
		}
	}
	return undefined;
}

export function coverageMetricForObservedEvent(event) {
	const name = typeof event?.name === "string" ? event.name : "";
	if (!name) return undefined;
	const baseName = name.endsWith(".error")
		? name.slice(0, -".error".length)
		: name;
	if (
		requiredBusinessMetricRoutes.has(name) ||
		requiredBusinessMetricRoutes.has(baseName)
	) {
		return requiredMetricForObservedEvent(event);
	}
	return name;
}

export function assertJourneyComplete(summary) {
	if (summary.routes.length !== expectedRoutes.length) {
		throw new Error("INCOMPLETE_BROWSER_ROUTES");
	}
	if (summary.eventCount === 0) throw new Error("EMPTY_BROWSER_TELEMETRY");
	if (summary.acceptedBatchCount === 0) {
		throw new Error("NO_ACCEPTED_TELEMETRY_BATCH");
	}
	if (
		summary.acceptedBatchCount +
			summary.rejectedBatchCount +
			summary.transportFailureCount !==
		summary.batchCount
	) {
		throw new Error("INCOMPLETE_TELEMETRY_RESPONSES");
	}
	if (summary.unacceptedEventCount > 0) {
		throw new Error("UNACCEPTED_TELEMETRY_EVENTS");
	}
	if (summary.coverage.missingRequired.length > 0) {
		const missing = [...new Set(summary.coverage.missingRequired)]
			.filter((name) => journeyManifest.requiredMetrics.includes(name))
			.sort()
			.map((name) => name.toUpperCase().replace(/[^A-Z0-9]+/gu, "_"));
		throw new Error(
			missing.length > 0
				? `INCOMPLETE_METRIC_COVERAGE_${missing.join("_")}`
				: "INCOMPLETE_METRIC_COVERAGE",
		);
	}
	if (!summary.representativeInteraction.observed) {
		throw new Error("MISSING_REPRESENTATIVE_INTERACTION_METRIC");
	}
	if (
		summary.safeBusinessInteractions.some(
			(interaction) =>
				!interaction.successObserved && !interaction.failureObserved,
		)
	) {
		throw new Error("MISSING_SAFE_BUSINESS_INTERACTION_OUTCOME");
	}
	if (summary.healthyZero.unexpectedObserved.length > 0) {
		throw new Error(
			`UNHEALTHY_CONTROLLED_JOURNEY_${summary.healthyZero.unexpectedObserved
				.map((name) => name.toUpperCase().replace(/[^A-Z0-9]+/gu, "_"))
				.join("_")}`,
		);
	}
}

async function waitForPaintSettlement(page) {
	await page.evaluate(
		(frameCount) =>
			new Promise((resolve) => {
				let observedFrames = 0;
				const observeFrame = () => {
					observedFrames += 1;
					if (observedFrames >= frameCount) resolve();
					else requestAnimationFrame(observeFrame);
				};
				requestAnimationFrame(observeFrame);
			}),
		journeyManifest.representativeInteractionSettleFrames,
	);
}

async function performRepresentativeInteraction(page, route) {
	const interaction = journeyManifest.representativeInteraction;
	if (route !== interaction.route) return;
	await page.waitForFunction(
		(mark) => performance.getEntriesByName(mark, "mark").length > 0,
		journeyManifest.vitalsReadyMark,
		{ timeout: journeyManifest.vitalsReadyTimeoutMs },
	);
	const session = await page.context().newCDPSession(page);
	try {
		await session.send("Emulation.setCPUThrottlingRate", {
			rate: journeyManifest.representativeInteractionCpuSlowdownRate,
		});
		for (const step of interaction.steps) {
			const locator = page.getByRole(step.role, {
				name: step.name,
				exact: true,
			});
			if (step.action === "fill") await locator.fill(step.value);
			else if (step.action === "click") await locator.click();
			else throw new Error("INVALID_INTERACTION_ACTION");
			await waitForPaintSettlement(page);
		}
		for (const assertion of interaction.assertions) {
			const actual = new URL(page.url()).searchParams.get(
				assertion.urlSearchParam,
			);
			if (actual !== assertion.equals) {
				throw new Error("INTERACTION_ASSERTION_FAILED");
			}
		}
	} finally {
		await session
			.send("Emulation.setCPUThrottlingRate", { rate: 1 })
			.catch(() => undefined);
		await session.detach().catch(() => undefined);
	}
}

async function performSafeReadOnlySettles(page, route) {
	const settles = journeyManifest.safeReadOnlySettles.filter(
		(settle) => settle.route === route,
	);
	for (const settle of settles) {
		await page
			.getByRole(settle.settledRole)
			.filter({ hasNotText: settle.settledNotText })
			.waitFor({ state: "visible" });
	}
}

async function performSafeBusinessInteractions(page, route) {
	const interactions = journeyManifest.safeBusinessInteractions.filter(
		(interaction) => interaction.route === route,
	);
	for (const interaction of interactions) {
		for (const step of interaction.steps) {
			const locator = page.getByRole(step.role, {
				name: step.name,
				exact: true,
			});
			if (step.action === "fill") await locator.fill(step.value);
			else if (step.action === "click") await locator.click();
			else throw new Error("INVALID_BUSINESS_INTERACTION_ACTION");
		}
		await page
			.getByRole(interaction.settledRole)
			.filter({ hasNotText: interaction.settledNotText })
			.waitFor({ state: "visible" });
	}
}

async function performSpaNavigation(page, route) {
	const scenario = journeyManifest.spaNavigation;
	if (route !== scenario.route) return;
	await page
		.getByRole(scenario.role, { name: scenario.name, exact: true })
		.click();
	await page.waitForURL((url) => url.pathname === scenario.expectedPath);
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => resolve())),
	);
	await page.waitForTimeout(500);
}

async function performSafeResourceProbes(page, route) {
	if (route !== journeyManifest.safeResourceProbeRoute) return;
	await page.evaluate(async () => {
		await fetch("/__performance_probe__/fetch", { cache: "no-store" }).then(
			(response) => response.json(),
		);
		await new Promise((resolve, reject) => {
			const request = new XMLHttpRequest();
			request.open("GET", "/__performance_probe__/xhr");
			request.onload = () => resolve(undefined);
			request.onerror = () => reject(new Error("RESOURCE_PROBE_XHR_FAILED"));
			request.send();
		});
		await new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(undefined);
			image.onerror = () => reject(new Error("RESOURCE_PROBE_IMAGE_FAILED"));
			image.src = "/__performance_probe__/image.png";
		});
		await new Promise((resolve, reject) => {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = "/__performance_probe__/style.css";
			link.onload = () => {
				link.remove();
				resolve(undefined);
			};
			link.onerror = () => {
				link.remove();
				reject(new Error("RESOURCE_PROBE_STYLE_FAILED"));
			};
			document.head.append(link);
		});
		const fontPath = `/__performance_probe__/font.woff2?probe=${crypto.randomUUID()}`;
		const fontResourceUrl = new URL(fontPath, location.href).href;
		const fontStyle = document.createElement("style");
		fontStyle.textContent = `@font-face{font-family:"BabyStepsProbe";src:url("${fontPath}") format("woff2");font-display:block}`;
		document.head.append(fontStyle);
		const fontProbe = document.createElement("span");
		fontProbe.textContent = "BabySteps";
		fontProbe.style.cssText =
			'position:fixed;inset:auto auto 0 0;visibility:hidden;font:12px "BabyStepsProbe"';
		document.body.append(fontProbe);
		await document.fonts.load('12px "BabyStepsProbe"', "BabySteps");
		const fontEntryDeadline = performance.now() + 5_000;
		while (performance.getEntriesByName(fontResourceUrl).length === 0) {
			if (performance.now() >= fontEntryDeadline) {
				throw new Error("RESOURCE_PROBE_FONT_TIMING_MISSING");
			}
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		await new Promise((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(resolve)),
		);
		fontProbe.remove();
		fontStyle.remove();
		const sent = navigator.sendBeacon(
			"/__performance_probe__/beacon",
			new Blob(["ok"], { type: "text/plain" }),
		);
		if (!sent) throw new Error("RESOURCE_PROBE_BEACON_FAILED");
	});
}

async function finalizeControlledLifecycle(page, deliveryTracker) {
	const telemetryPollIntervalMs = 100;
	const telemetryPollAttempts = Math.ceil(
		journeyManifest.telemetryResponseTimeoutMs / telemetryPollIntervalMs,
	);
	await page.evaluate(() => {
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});
		document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
	});
	await page.waitForTimeout(500);
	await page.evaluate(() =>
		globalThis.dispatchEvent(
			new PageTransitionEvent("pagehide", { persisted: false }),
		),
	);
	for (let attempt = 0; attempt < telemetryPollAttempts; attempt += 1) {
		if (deliveryTracker.isSettled()) return;
		await page.waitForTimeout(telemetryPollIntervalMs);
	}
	throw new Error("TELEMETRY_RESPONSE_TIMEOUT");
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
	const observed = [
		...new Set(names.filter((name) => !unavailableCoverage.includes(name))),
	].sort();
	const coverage = evaluateJourneyCoverage({
		observed,
		required: journeyManifest.requiredMetrics,
	});
	const unexpectedObserved = journeyManifest.healthyZeroMetrics
		.filter((name) => observed.includes(name))
		.sort();
	const safeBusinessInteractions = journeyManifest.safeBusinessInteractions.map(
		(interaction) => {
			const outcome = input.safeBusinessOutcomes?.[interaction.id];
			return {
				id: interaction.id,
				route: interaction.route,
				metric: interaction.expectedMetric,
				safety: interaction.safety,
				acceptedOutcomes: [...interaction.acceptedOutcomes],
				successObserved: outcome?.successObserved === true,
				failureObserved: outcome?.failureObserved === true,
			};
		},
	);
	return {
		routes,
		coverage: {
			observed,
			unavailable: unavailableCoverage,
			missingRequired: coverage.missing,
		},
		batchCount: boundedCount(input.batchCount),
		acceptedBatchCount: boundedCount(input.acceptedBatchCount),
		rejectedBatchCount: boundedCount(input.rejectedBatchCount),
		transportFailureCount: boundedCount(input.transportFailureCount),
		eventCount: boundedCount(input.eventCount),
		unacceptedEventCount: boundedCount(input.unacceptedEventCount),
		representativeInteraction: {
			route: journeyManifest.representativeInteraction.route,
			metric: journeyManifest.representativeInteraction.expectedMetric,
			observed: input.representativeMetricObserved === true,
			source: "controlled-browser",
			cpuSlowdownRate: journeyManifest.representativeInteractionCpuSlowdownRate,
			paintSettleFrames: journeyManifest.representativeInteractionSettleFrames,
			viewport: { width: 1440, height: 900 },
		},
		safeBusinessInteractions,
		zeroOrObserved: journeyManifest.zeroOrObservedMetrics.map((name) => ({
			name,
			observed: observed.includes(name),
		})),
		healthyZero: {
			expected: [...journeyManifest.healthyZeroMetrics].sort(),
			unexpectedObserved,
		},
		lifecycleFinalization: "controlled-browser-hidden-pagehide",
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
	const localCoverage = process.argv.includes("--local-coverage");
	const version = readOption("--version");
	if (!origin) throw new Error("MISSING_ORIGIN");
	if (dashboardOnly && !/^[0-9a-f]{12}$/u.test(version ?? "")) {
		throw new Error("INVALID_DASHBOARD_VERSION");
	}
	const parsedOrigin = new URL(origin);
	const originBase = `${parsedOrigin.protocol}//${parsedOrigin.hostname}`;
	if (
		!journeyManifest.allowedLocalOrigins.includes(originBase) ||
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
	const deliveryTracker = createTelemetryDeliveryTracker();
	const safeBusinessOutcomes = Object.fromEntries(
		journeyManifest.safeBusinessInteractions.map((interaction) => [
			interaction.id,
			{ successObserved: false, failureObserved: false },
		]),
	);
	let representativeMetricObserved = false;
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
		await page.route("**/__performance_probe__/**", async (route) => {
			const pathname = new URL(route.request().url()).pathname;
			if (pathname === "/__performance_probe__/fetch") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: '{"ok":true}',
				});
				return;
			}
			if (pathname === "/__performance_probe__/xhr") {
				await route.fulfill({ status: 200, body: "ok" });
				return;
			}
			if (pathname === "/__performance_probe__/style.css") {
				await route.fulfill({
					status: 200,
					contentType: "text/css",
					body: ":root{--performance-probe:1}",
				});
				return;
			}
			if (pathname === "/__performance_probe__/image.png") {
				await route.fulfill({
					status: 200,
					contentType: "image/png",
					body: Buffer.from(
						"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
						"base64",
					),
				});
				return;
			}
			if (pathname === "/__performance_probe__/font.woff2") {
				await route.fulfill({
					status: 200,
					contentType: "font/woff2",
					body: probeFont,
				});
				return;
			}
			if (pathname === "/__performance_probe__/beacon") {
				await route.fulfill({ status: 204 });
				return;
			}
			await route.abort();
		});
		await page.route("**/api/performance/events", async (route) => {
			if (dashboardOnly) {
				await route.fulfill({
					status: 202,
					contentType: "application/json",
					body: '{"accepted":true}',
				});
				return;
			}
			let batch;
			try {
				batch = route.request().postDataJSON();
			} catch {
				batch = undefined;
			}
			const attempt = deliveryTracker.beginAttempt(batch);
			if (localCoverage) {
				await route.fulfill({
					status: 202,
					contentType: "application/json",
					body: '{"accepted":true}',
				});
				deliveryTracker.markAccepted(attempt);
				return;
			}
			try {
				const response = await route.fetch({
					timeout: journeyManifest.telemetryAttemptTimeoutMs,
				});
				const accepted = response.ok();
				if (!accepted) {
					process.stdout.write(
						`TELEMETRY_BATCH_REJECTED_${response.status()}\n`,
					);
				}
				await route.fulfill({ response });
				if (accepted) deliveryTracker.markAccepted(attempt);
				else deliveryTracker.markRejected(attempt);
			} catch {
				deliveryTracker.markTransportFailure(attempt);
				await route.abort().catch(() => undefined);
			}
		});
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
				for (const event of batch.events) {
					if (typeof event?.name !== "string") continue;
					const eventRoute = normalizedEventRoute(event);
					for (const interaction of journeyManifest.safeBusinessInteractions) {
						const outcome = safeBusinessOutcomes[interaction.id];
						const requiredMetric = requiredMetricForObservedEvent(event);
						if (
							requiredMetric === interaction.expectedMetric &&
							event.name === interaction.expectedMetric
						) {
							outcome.successObserved = true;
						} else if (
							requiredMetric === interaction.expectedMetric &&
							event.name === `${interaction.expectedMetric}.error`
						) {
							outcome.failureObserved = true;
						}
					}
					const coverageMetric = coverageMetricForObservedEvent(event);
					if (coverageMetric) coverage.add(coverageMetric);
					if (
						event.name ===
							journeyManifest.representativeInteraction.expectedMetric &&
						eventRoute === journeyManifest.representativeInteraction.route
					) {
						representativeMetricObserved = true;
					}
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
						globalThis.scrollTo({
							top: document.body.scrollHeight,
							behavior: "smooth",
						}),
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
			for (const [
				routeIndex,
				{ path: route, heading },
			] of journeyRoutes.entries()) {
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
					observedRoutes.add(route);
					await performSafeReadOnlySettles(page, route);
					await performSafeResourceProbes(page, route);
					await performRepresentativeInteraction(page, route);
					await performSafeBusinessInteractions(page, route);
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
					await performSpaNavigation(page, route);
					await finalizeControlledLifecycle(page, deliveryTracker);
					process.stdout.write(`BROWSER_ROUTE_OK ${routeTokens.get(route)}\n`);
					const completed = routeIndex + 1;
					if (
						completed < journeyRoutes.length &&
						completed % journeyManifest.maxRoutesPerQuotaWindow === 0
					) {
						process.stdout.write("BROWSER_QUOTA_WINDOW_PAUSE\n");
						await page.waitForTimeout(journeyManifest.quotaWindowPauseMs);
					}
				} catch (error) {
					throw new Error(sanitizeJourneyFailure(error, route));
				}
			}
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
		...deliveryTracker.snapshot(),
		representativeMetricObserved,
		safeBusinessOutcomes,
	});
	assertJourneyComplete(summary);
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
