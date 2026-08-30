import observation from "../../../docs/evidence/deployment/2026-08-29-performance-aws-final.json";
import type {
	PerformanceCoverageStatus,
	PerformanceDashboardResponse,
	PerformanceMetricSummary,
} from "./api";

export const VERIFIED_PERFORMANCE_OBSERVATION = {
	observedAt: observation.observedAt,
	runId: observation.workflow.runId,
	runUrl: `https://github.com/Tiancheng-Xu/babysteps/actions/runs/${observation.workflow.runId}`,
	commit: observation.workflow.commit.slice(0, 12),
	region: observation.workflow.region,
	browserEventCount: observation.browserJourney.eventCount,
	cleanerInsertedCount: observation.cleaner.inserted,
	queueVisibleBeforeCleanup: observation.delivery.queue.visible,
	queueFullyDrained: observation.delivery.fullyDrained,
	cleanerExitCode: observation.cleaner.exitCode,
	projectStackDeleted: observation.cleanup.cloudFormationStackAbsent,
	remainingProjectResources: observation.cleanup.remainingProjectResources,
	sharedFoundationProtected:
		observation.cleanup.sharedResources.foundation === "explicit deny cleanup",
} as const;

const vitalNames = ["LCP", "CLS", "INP", "FCP", "TTFB"] as const;
const navigationNames = [
	"navigation.dns",
	"navigation.tcp",
	"navigation.tls",
	"navigation.request_wait",
	"navigation.download",
	"navigation.dom_ready",
	"navigation.window_load",
] as const;
const resourceNames = [
	"resource.duration",
	"resource.fetch.duration",
	"resource.xhr.duration",
	"resource.script.duration",
	"resource.stylesheet.duration",
	"resource.image.duration",
	"resource.font.duration",
] as const;
const renderingMetricNames = [
	"spa.route.duration",
	"ssr.shell.duration",
	"hydration.duration",
] as const;
const errorNames = [
	"javascript.error",
	"promise.rejection",
	"error.javascript.type_error",
	"error.javascript.network",
	"error.javascript.timeout",
	"error.javascript.unknown",
	"error.promise.type_error",
	"error.promise.network",
	"error.promise.timeout",
	"error.promise.unknown",
] as const;
const web3Names = [
	"contract.read",
	"contract.write",
	"web3.uniswap.quote",
	"web3.uniswap.swap",
	"web3.privy.login",
	"wallet.connect",
	"auth.challenge",
	"auth.sign",
	"auth.verify",
	"rpc.read",
	"web3.rpc.read",
	"approve.submit",
	"approve.receipt",
	"transaction.submit",
	"transaction.receipt",
] as const;
const longTaskNames = [
	"longtask.duration",
	"longtask.count",
	"longtask.total",
	"longtask.max",
] as const;
const coverageNames = [
	...vitalNames,
	...navigationNames,
	...resourceNames,
	...longTaskNames,
	"spa.route.duration",
	"ssr.shell.duration",
	"hydration.duration",
	"csr.fallback",
	"hydration.recoverable_error",
	...errorNames,
	...web3Names,
] as const;

function noSample(
	name: string,
	unit: PerformanceMetricSummary["unit"] = "ms",
	coverage: PerformanceCoverageStatus = "instrumented-no-sample",
): PerformanceMetricSummary {
	return {
		name,
		unit,
		sampleCount: 0,
		p50: null,
		p75: null,
		p95: null,
		coverage,
	};
}

const dashboardVitals: Partial<
	Record<
		(typeof vitalNames)[number],
		{ sampleCount: number; p50: number; p75: number; p95: number }
	>
> = observation.dashboard.vitals;

const dashboardNavigation = observation.dashboard.navigation;

function coverageFor(name: string): PerformanceCoverageStatus {
	if (["navigation.dns", "navigation.tcp", "navigation.tls"].includes(name)) {
		return "unavailable";
	}
	if (longTaskNames.includes(name as (typeof longTaskNames)[number])) {
		return "observed-zero";
	}
	if (errorNames.includes(name as (typeof errorNames)[number])) {
		return "observed-zero";
	}
	if (web3Names.includes(name as (typeof web3Names)[number])) {
		return "not-exercised";
	}
	if (
		name in dashboardVitals ||
		name in dashboardNavigation ||
		name === "resource.script.duration"
	) {
		return "observed";
	}
	return "instrumented-no-sample";
}

/** A truthful adapter for the latest verified run; omitted distributions remain unavailable. */
export const VERIFIED_PERFORMANCE_DASHBOARD: PerformanceDashboardResponse = {
	window: "1h",
	freshness: {
		// The artifact records a date, not a sample time. observedAt is ordering-only.
		observedAt: Date.parse(`${observation.observedAt}T00:00:00Z`),
		latestSampleAt: null,
		mode: "snapshot",
		source: "verified-snapshot",
		runId: String(observation.workflow.runId),
		commit: observation.workflow.commit,
	},
	vitals: vitalNames.map((name) => {
		const metric = dashboardVitals[name];
		return metric
			? { name, unit: "ms", ...metric, coverage: "observed" }
			: noSample(name, name === "CLS" ? "score" : "ms");
	}),
	navigation: navigationNames.map((name) =>
		["navigation.dns", "navigation.tcp", "navigation.tls"].includes(name)
			? noSample(name, "ms", "unavailable")
			: {
					name,
					unit: "ms" as const,
					sampleCount: dashboardNavigation[name].sampleCount,
					p50: dashboardNavigation[name].p50,
					p75: dashboardNavigation[name].p75,
					p95: dashboardNavigation[name].p95,
					coverage: "observed" as const,
				},
	),
	resources: resourceNames.map((name) =>
		name === "resource.script.duration"
			? {
					name,
					unit: "ms",
					sampleCount: observation.dashboard.scriptResource.sampleCount,
					p50: observation.dashboard.scriptResource.p50,
					p75: observation.dashboard.scriptResource.p75,
					p95: observation.dashboard.scriptResource.p95,
					coverage: "observed",
				}
			: noSample(name, "ms", "not-exercised"),
	),
	rendering: renderingMetricNames.map((name) =>
		noSample(name, "ms", "not-exercised"),
	),
	longTasks: {
		count: 0,
		totalDurationMs: 0,
		maxDurationMs: null,
		duration: noSample("longtask.duration", "ms", "observed-zero"),
		coverage: "observed-zero",
	},
	errors: errorNames.map((name) => ({
		name,
		sampleCount: 0,
		rate: 0,
		coverage: "observed-zero" as const,
	})),
	web3: web3Names.map((name) => ({
		name,
		unit: "ms" as const,
		sampleCount: 0,
		successCount: 0,
		failureCount: 0,
		successRate: null,
		p50: null,
		p75: null,
		p95: null,
		coverage: "not-exercised" as const,
	})),
	routes: observation.dashboard.routes,
	trend: [
		{
			bucketStart: Date.parse(`${observation.observedAt}T00:00:00Z`),
			name: "LCP",
			sampleCount: observation.dashboard.vitals.LCP.sampleCount,
			p75: observation.dashboard.vitals.LCP.p75,
		},
	],
	versions: [
		{
			version: observation.dashboard.version.name,
			sampleCount: observation.dashboard.version.sampleCount,
			p75: observation.dashboard.version.p75,
			p95: observation.dashboard.version.p95,
		},
	],
	coverage: coverageNames.map((name) => ({ name, status: coverageFor(name) })),
	pipeline: { status: "unavailable", source: "database-only" },
};
