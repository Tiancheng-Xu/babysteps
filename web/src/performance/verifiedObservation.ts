import observation from "../../../docs/evidence/deployment/2026-08-23-performance-aws-observation.json";
import type {
	PerformanceCoverageStatus,
	PerformanceDashboardResponse,
	PerformanceMetricSummary,
} from "./api";

export const VERIFIED_PERFORMANCE_OBSERVATION = {
	observedAt: observation.observedAt,
	runId: observation.workflow.runId,
	runUrl: observation.workflow.url,
	commit: observation.workflow.commit.slice(0, 12),
	region: observation.workflow.region,
	metric: observation.aggregate.metric,
	sampleCount: observation.aggregate.sampleCount,
	p50: observation.aggregate.p50,
	p75: observation.aggregate.p75,
	p95: observation.aggregate.p95,
	errorRate: observation.aggregate.errorRate,
	route: observation.aggregate.route,
	cleanerExitCode: observation.cleanerTask.exitCode,
	projectStackDeleted: observation.cleanup.projectStackDeleted,
	remainingProjectClusters: observation.cleanup.remainingProjectClusters,
	sharedFoundationProtected: observation.cleanup.sharedFoundationProtected,
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
const coverageNames = [
	...vitalNames,
	...navigationNames,
	...resourceNames,
	"longtask.duration",
	"longtask.count",
	"longtask.total",
	"longtask.max",
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
): PerformanceMetricSummary {
	return {
		name,
		unit,
		sampleCount: 0,
		p50: null,
		p75: null,
		p95: null,
		coverage: "unavailable",
	};
}

function coverageFor(name: string): PerformanceCoverageStatus {
	return name === "LCP" ? "observed" : "unavailable";
}

/** A truthful adapter: the verified run observed one LCP event, not a fabricated full live dataset. */
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
	vitals: vitalNames.map((name) =>
		name === "LCP"
			? {
					name,
					unit: "ms",
					sampleCount: observation.aggregate.sampleCount,
					p50: observation.aggregate.p50,
					p75: observation.aggregate.p75,
					p95: observation.aggregate.p95,
					coverage: "observed",
				}
			: noSample(name, name === "CLS" ? "score" : "ms"),
	),
	navigation: navigationNames.map((name) =>
		coverageFor(name) === "unavailable"
			? { ...noSample(name), coverage: "unavailable" }
			: noSample(name),
	),
	resources: resourceNames.map((name) => noSample(name)),
	longTasks: {
		count: 0,
		totalDurationMs: 0,
		maxDurationMs: null,
		duration: noSample("longtask.duration"),
		coverage: "unavailable",
	},
	errors: errorNames.map((name) => ({
		name,
		sampleCount: 0,
		rate: null,
		coverage: "unavailable" as const,
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
		coverage: "unavailable" as const,
	})),
	routes: [
		{
			route: observation.aggregate.route,
			sampleCount: observation.aggregate.sampleCount,
			p75: observation.aggregate.p75,
			p95: observation.aggregate.p95,
		},
	],
	trend: [],
	versions: [
		{
			version: observation.controlledEvent.version,
			sampleCount: observation.aggregate.sampleCount,
			p75: observation.aggregate.p75,
			p95: observation.aggregate.p95,
		},
	],
	coverage: coverageNames.map((name) => ({ name, status: coverageFor(name) })),
	pipeline: { status: "unavailable", source: "database-only" },
};
