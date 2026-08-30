import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const manifest = JSON.parse(
	readFileSync(
		new URL("./performance-journey.manifest.json", import.meta.url),
		"utf8",
	),
);

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

export function validatePerformanceReadback(stats) {
	const vitals = manifest.requiredMetrics.filter(
		(name) => !name.includes("."),
	);
	const navigation = manifest.requiredMetrics.filter((name) =>
		name.startsWith("navigation."),
	);
	const resources = manifest.requiredMetrics.filter((name) =>
		name.startsWith("resource."),
	);
	return {
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
	};
}

const isEntrypoint = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1]
	: false;

if (isEntrypoint) {
	const statsIndex = process.argv.indexOf("--stats");
	const statsPath = statsIndex >= 0 ? process.argv[statsIndex + 1] : undefined;
	if (!statsPath) throw new Error("MISSING_STATS_PATH");
	const result = validatePerformanceReadback(
		JSON.parse(readFileSync(statsPath, "utf8")),
	);
	process.stdout.write(`${JSON.stringify(result)}\n`);
}
