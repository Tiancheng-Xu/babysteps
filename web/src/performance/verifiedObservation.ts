import dashboardSnapshot from "../../../docs/evidence/deployment/2026-08-31-performance-aws-final/performance-stats.json";
import observation from "../../../docs/evidence/deployment/2026-08-31-performance-aws-final.json";
import type {
	PerformanceCoverageStatus,
	PerformanceDashboardResponse,
	PerformanceMetricSummary,
	PerformanceOperationSummary,
} from "./api";

export const VERIFIED_PERFORMANCE_OBSERVATION = {
	observedAt: observation.observedAt,
	runId: observation.workflow.runId,
	runUrl: observation.workflow.url,
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

function coverage(value: string): PerformanceCoverageStatus {
	return value as PerformanceCoverageStatus;
}

function metric<
	T extends {
		name: string;
		unit: string;
		sampleCount: number;
		p50: number | null;
		p75: number | null;
		p95: number | null;
		coverage: string;
	},
>(value: T): PerformanceMetricSummary {
	return {
		...value,
		unit: value.unit as PerformanceMetricSummary["unit"],
		coverage: coverage(value.coverage),
	};
}

function operation<
	T extends {
		name: string;
		unit: string;
		sampleCount: number;
		successCount: number;
		failureCount: number;
		successRate: number | null;
		p50: number | null;
		p75: number | null;
		p95: number | null;
		coverage: string;
	},
>(value: T): PerformanceOperationSummary {
	return {
		...value,
		unit: "ms",
		coverage: coverage(value.coverage),
	};
}

/**
 * Historical adapter for the latest fully verified cloud run. The underlying
 * AWS runtime has been cleaned, so provenance changes from live-api to a
 * verified snapshot while sample times and distributions remain untouched.
 */
export const VERIFIED_PERFORMANCE_DASHBOARD: PerformanceDashboardResponse = {
	window: "1h",
	freshness: {
		observedAt: dashboardSnapshot.freshness.observedAt,
		latestSampleAt: dashboardSnapshot.freshness.latestSampleAt,
		mode: "snapshot",
		source: "verified-snapshot",
		runId: String(observation.workflow.runId),
		commit: observation.workflow.commit,
	},
	vitals: dashboardSnapshot.vitals.map(metric),
	navigation: dashboardSnapshot.navigation.map(metric),
	resources: dashboardSnapshot.resources.map(metric),
	rendering: dashboardSnapshot.rendering.map(metric),
	longTasks: {
		count: dashboardSnapshot.longTasks.count,
		totalDurationMs: dashboardSnapshot.longTasks.totalDurationMs,
		maxDurationMs: dashboardSnapshot.longTasks.maxDurationMs,
		duration: metric(dashboardSnapshot.longTasks.duration),
		coverage: coverage(dashboardSnapshot.longTasks.coverage),
	},
	errors: dashboardSnapshot.errors.map((item) => ({
		...item,
		coverage: coverage(item.coverage),
	})),
	web3: dashboardSnapshot.web3.map(operation),
	businessOperations: dashboardSnapshot.businessOperations.map(operation),
	routes: dashboardSnapshot.routes,
	trend: dashboardSnapshot.trend,
	versions: dashboardSnapshot.versions,
	coverage: dashboardSnapshot.coverage.map((item) => ({
		name: item.name,
		status: coverage(item.status),
	})),
	pipeline: { status: "unavailable", source: "database-only" },
};
