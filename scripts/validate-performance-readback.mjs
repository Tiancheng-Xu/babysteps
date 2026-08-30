import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const manifest = JSON.parse(
	readFileSync(
		new URL("./performance-journey.manifest.json", import.meta.url),
		"utf8",
	),
);
const renderingHealthyZero = new Set([
	"csr.fallback",
	"hydration.recoverable_error",
]);

function requiredSample(section, name, expectedUnit) {
	const metric = section?.find((candidate) => candidate?.name === name);
	const sample = metric?.sampleCount;
	const token = name.replaceAll(".", "_");
	if (!Number.isSafeInteger(sample) || sample < 1) {
		throw new Error(`MISSING_REQUIRED_SAMPLE_${name.replaceAll(".", "_")}`);
	}
	if (metric.unit !== expectedUnit) {
		throw new Error(`INVALID_REQUIRED_UNIT_${token}`);
	}
	const percentiles = [metric.p50, metric.p75, metric.p95];
	if (
		percentiles.some((value) => !Number.isFinite(value) || value < 0) ||
		metric.p50 > metric.p75 ||
		metric.p75 > metric.p95
	) {
		throw new Error(`INVALID_REQUIRED_PERCENTILES_${token}`);
	}
	if (metric.coverage !== "observed") {
		throw new Error(`INVALID_REQUIRED_COVERAGE_${token}`);
	}
	return sample;
}

function requiredCoverage(coverage, name) {
	const metric = coverage?.find((candidate) => candidate?.name === name);
	if (metric?.status !== "observed") {
		throw new Error(`MISSING_REQUIRED_COVERAGE_${name.replaceAll(".", "_")}`);
	}
	return 1;
}

function requiredCoverageStatus(coverage, name, expectedStatus, errorPrefix) {
	const metric = coverage?.find((candidate) => candidate?.name === name);
	if (metric?.status !== expectedStatus) {
		throw new Error(`${errorPrefix}_${name.replaceAll(".", "_")}`);
	}
	return 1;
}

function requiredHealthyZero(stats, name) {
	requiredCoverageStatus(
		stats?.coverage,
		name,
		"observed-zero",
		"INVALID_HEALTHY_ZERO",
	);
	const error = stats?.errors?.find((candidate) => candidate?.name === name);
	if (!renderingHealthyZero.has(name) && !error) {
		throw new Error(`INVALID_HEALTHY_ZERO_${name.replaceAll(".", "_")}`);
	}
	if (
		error &&
		(error.sampleCount !== 0 ||
			error.rate !== 0 ||
			error.coverage !== "observed-zero")
	) {
		throw new Error(`INVALID_HEALTHY_ZERO_${name.replaceAll(".", "_")}`);
	}
	return 1;
}

function requiredUnavailableNavigation(stats, name) {
	requiredCoverageStatus(
		stats?.coverage,
		name,
		"unavailable",
		"INVALID_UNAVAILABLE_COVERAGE",
	);
	const metric = stats?.navigation?.find(
		(candidate) => candidate?.name === name,
	);
	if (
		metric?.unit !== "ms" ||
		metric?.sampleCount !== 0 ||
		metric?.p50 !== null ||
		metric?.p75 !== null ||
		metric?.p95 !== null ||
		metric?.coverage !== "unavailable"
	) {
		throw new Error(`INVALID_UNAVAILABLE_SAMPLE_${name.replaceAll(".", "_")}`);
	}
	return 1;
}

function requiredLongTaskSample(longTasks) {
	if (longTasks?.count === 0) {
		const duration = longTasks.duration;
		if (
			longTasks.totalDurationMs !== 0 ||
			longTasks.maxDurationMs !== null ||
			longTasks.coverage !== "observed-zero" ||
			duration?.name !== "longtask.duration" ||
			duration?.unit !== "ms" ||
			duration?.sampleCount !== 0 ||
			duration?.p50 !== null ||
			duration?.p75 !== null ||
			duration?.p95 !== null ||
			duration?.coverage !== "observed-zero"
		) {
			throw new Error("INVALID_LONGTASK_OBSERVED_ZERO");
		}
		return 0;
	}
	if (
		!Number.isSafeInteger(longTasks?.count) ||
		longTasks.count < 1 ||
		!Number.isFinite(longTasks.totalDurationMs) ||
		longTasks.totalDurationMs <= 0 ||
		!Number.isFinite(longTasks.maxDurationMs) ||
		longTasks.maxDurationMs <= 0 ||
		longTasks.coverage !== "observed"
	) {
		throw new Error("INVALID_LONGTASK_SUMMARY");
	}
	const samples = requiredSample(
		[longTasks.duration],
		"longtask.duration",
		"ms",
	);
	if (samples !== longTasks.count) {
		throw new Error("INVALID_LONGTASK_SAMPLE_COUNT");
	}
	return samples;
}

function requiredWeb3Sample(section, name) {
	const metric = section?.find((candidate) => candidate?.name === name);
	const sampleCount = requiredSample(section, name, "ms");
	const token = name.replaceAll(".", "_");
	if (
		!Number.isSafeInteger(metric?.successCount) ||
		!Number.isSafeInteger(metric?.failureCount) ||
		metric.successCount < 0 ||
		metric.failureCount < 0 ||
		metric.successCount + metric.failureCount !== sampleCount
	) {
		throw new Error(`INVALID_REQUIRED_OUTCOME_COUNTS_${token}`);
	}
	if (
		!Number.isFinite(metric.successRate) ||
		metric.successRate !== metric.successCount / sampleCount
	) {
		throw new Error(`INVALID_REQUIRED_SUCCESS_RATE_${token}`);
	}
	return metric;
}

function validateObservationContract(stats, expectations) {
	if (!expectations) return {};
	const {
		expectedEnvironment,
		expectedVersion,
		expectedWindow,
		minLatestSampleAt,
		requiredRoutes,
		maxObservedAt = Date.now() + 5 * 60_000,
	} = expectations;
	if (
		!expectedEnvironment ||
		!expectedVersion ||
		!expectedWindow ||
		!Number.isSafeInteger(minLatestSampleAt) ||
		!Array.isArray(requiredRoutes) ||
		requiredRoutes.length < 1
	) {
		throw new Error("INVALID_READBACK_EXPECTATIONS");
	}
	if (
		stats?.window !== expectedWindow ||
		stats?.filters?.window !== expectedWindow
	) {
		throw new Error("READBACK_WINDOW_MISMATCH");
	}
	if (stats?.filters?.environment !== expectedEnvironment) {
		throw new Error("READBACK_ENVIRONMENT_MISMATCH");
	}
	if (stats?.filters?.version !== expectedVersion) {
		throw new Error("READBACK_VERSION_FILTER_MISMATCH");
	}
	const versions = Array.isArray(stats?.versions) ? stats.versions : [];
	if (
		versions.length !== 1 ||
		versions[0]?.version !== expectedVersion ||
		!Number.isSafeInteger(versions[0]?.sampleCount) ||
		versions[0].sampleCount < 1
	) {
		throw new Error("READBACK_VERSION_MISMATCH");
	}
	if (
		stats?.freshness?.mode !== "live" ||
		stats?.freshness?.source !== "live-api"
	) {
		throw new Error("READBACK_PROVENANCE_MISMATCH");
	}
	const observedAt = stats?.freshness?.observedAt;
	const latestSampleAt = stats?.freshness?.latestSampleAt;
	if (
		!Number.isFinite(observedAt) ||
		!Number.isFinite(latestSampleAt) ||
		latestSampleAt < minLatestSampleAt ||
		observedAt < latestSampleAt ||
		observedAt > maxObservedAt
	) {
		throw new Error("READBACK_FRESHNESS_MISMATCH");
	}
	const routeMap = new Map(
		(Array.isArray(stats?.observedRoutes) ? stats.observedRoutes : []).map(
			(route) => [route?.route, route],
		),
	);
	for (const route of new Set(requiredRoutes)) {
		const observation = routeMap.get(route);
		if (
			!observation ||
			!Number.isSafeInteger(observation.sampleCount) ||
			observation.sampleCount < 1 ||
			!Number.isFinite(observation.latestSampleAt) ||
			observation.latestSampleAt < minLatestSampleAt
		) {
			throw new Error(`READBACK_ROUTE_MISSING_${route || "root"}`);
		}
	}
	return { observedRouteCount: new Set(requiredRoutes).size };
}

export function validatePerformanceReadback(stats, expectations) {
	const vitals = manifest.requiredMetrics.filter((name) => !name.includes("."));
	const navigation = manifest.requiredMetrics.filter((name) =>
		name.startsWith("navigation."),
	);
	const resources = manifest.requiredMetrics.filter((name) =>
		name.startsWith("resource."),
	);
	const web3 = manifest.requiredWeb3Metrics;
	const conditional = Object.values(manifest.conditionalMetrics).flat();
	const rendering = manifest.requiredMetrics.filter((name) =>
		["spa.route.duration", "ssr.shell.duration", "hydration.duration"].includes(
			name,
		),
	);
	return {
		...validateObservationContract(stats, expectations),
		navigationSampleCount: navigation.reduce(
			(total, name) => total + requiredSample(stats?.navigation, name, "ms"),
			0,
		),
		vitalSampleCount: vitals.reduce(
			(total, name) =>
				total +
				requiredSample(stats?.vitals, name, name === "CLS" ? "score" : "ms"),
			0,
		),
		resourceSampleCount: resources.reduce(
			(total, name) => total + requiredSample(stats?.resources, name, "ms"),
			0,
		),
		longTaskSampleCount: requiredLongTaskSample(stats?.longTasks),
		...web3.reduce(
			(result, name) => {
				const metric = requiredWeb3Sample(stats?.web3, name);
				return {
					web3SampleCount: result.web3SampleCount + metric.sampleCount,
					web3SuccessCount: result.web3SuccessCount + metric.successCount,
					web3FailureCount: result.web3FailureCount + metric.failureCount,
				};
			},
			{ web3SampleCount: 0, web3SuccessCount: 0, web3FailureCount: 0 },
		),
		renderingSampleCount: rendering.reduce((total, name) => {
			requiredCoverage(stats?.coverage, name);
			return total + requiredSample(stats?.rendering, name, "ms");
		}, 0),
		healthyZeroCount: manifest.healthyZeroMetrics.reduce(
			(total, name) => total + requiredHealthyZero(stats, name),
			0,
		),
		conditionalNotExercisedCount: conditional.reduce(
			(total, name) =>
				total +
				requiredCoverageStatus(
					stats?.coverage,
					name,
					"not-exercised",
					"INVALID_CONDITIONAL_COVERAGE",
				),
			0,
		),
		unavailableCount: manifest.unavailableMetrics.reduce(
			(total, name) => total + requiredUnavailableNavigation(stats, name),
			0,
		),
	};
}

const isEntrypoint = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1]
	: false;

if (isEntrypoint) {
	const argument = (name) => {
		const index = process.argv.indexOf(name);
		return index >= 0 ? process.argv[index + 1] : undefined;
	};
	const statsPath = argument("--stats");
	const expectedVersion = argument("--expected-version");
	const expectedEnvironment = argument("--expected-environment");
	const expectedWindow = argument("--expected-window");
	const minLatestSampleAt = Number(argument("--min-latest-sample-at"));
	const requiredRoutesJson = argument("--required-routes-json");
	if (
		!statsPath ||
		!expectedVersion ||
		!expectedEnvironment ||
		!expectedWindow ||
		!Number.isSafeInteger(minLatestSampleAt) ||
		!requiredRoutesJson
	) {
		throw new Error("MISSING_READBACK_CONTRACT_ARGUMENT");
	}
	const requiredRoutes = JSON.parse(requiredRoutesJson);
	const result = validatePerformanceReadback(
		JSON.parse(readFileSync(statsPath, "utf8")),
		{
			expectedVersion,
			expectedEnvironment,
			expectedWindow,
			minLatestSampleAt,
			requiredRoutes,
		},
	);
	process.stdout.write(`${JSON.stringify(result)}\n`);
}
