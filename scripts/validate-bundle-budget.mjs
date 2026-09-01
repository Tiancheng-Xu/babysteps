import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const DEFAULT_DIST = "web/dist-client";
const DEFAULT_BASELINE = "scripts/bundle-budget-baseline.json";
const DEFAULT_MAX_GZIP_DELTA_BYTES = 30 * 1024;
const LAZY_ROUTE_CHUNKS = Object.freeze([
	"GrowthMarketplacePage",
	"ParentDashboardPage",
	"KeepsakeGalleryPage",
	"ProviderConsolePage",
	"ExchangePage",
	"ProfilePage",
	"PerformanceDashboardPage",
	"EvidencePage",
]);
const PRODUCTION_ROUTE_CHUNKS = Object.freeze([
	"HomeEntry.js",
	...LAZY_ROUTE_CHUNKS.map((name) => `${name}.js`),
]);

function option(name, fallback) {
	const index = process.argv.indexOf(name);
	return index === -1 ? fallback : process.argv[index + 1];
}

function lazyRouteChunkName(file) {
	const fileName = basename(file);
	const route = LAZY_ROUTE_CHUNKS.find((name) =>
		fileName.startsWith(`${name}-`),
	);
	return route ? `${route}.js` : undefined;
}

async function listJavaScriptFiles(directory) {
	let entries;
	try {
		entries = await readdir(directory, {
			withFileTypes: true,
			recursive: true,
		});
	} catch (error) {
		if (error?.code === "ENOENT") {
			throw new Error(`built asset directory is missing: ${directory}`);
		}
		throw error;
	}
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
		.map((entry) => resolve(entry.parentPath, entry.name))
		.sort();
	if (files.length === 0) {
		throw new Error(
			`built asset directory has no JavaScript chunks: ${directory}`,
		);
	}
	return files;
}

export async function measureBundle(directory, { allowPartial = false } = {}) {
	const root = resolve(directory);
	const files = await listJavaScriptFiles(root);
	let entryFile;
	try {
		const index = await readFile(resolve(root, "index.html"), "utf8");
		const entryPath = index.match(
			/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/u,
		)?.[1];
		if (entryPath) entryFile = resolve(root, entryPath.replace(/^\//u, ""));
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
	const chunks = [];
	let totalJsBytes = 0;
	let totalJsGzipBytes = 0;
	for (const file of files) {
		const contents = await readFile(file);
		const gzipBytes = gzipSync(contents, { level: 9 }).byteLength;
		totalJsBytes += contents.byteLength;
		totalJsGzipBytes += gzipBytes;
		const name = file === entryFile ? "HomeEntry.js" : lazyRouteChunkName(file);
		if (!name) continue;
		chunks.push({
			name,
			bytes: contents.byteLength,
			gzipBytes,
		});
	}
	if (!allowPartial) {
		for (const required of PRODUCTION_ROUTE_CHUNKS) {
			if (!chunks.some(({ name }) => name === required)) {
				throw new Error(`production route chunk is missing: ${required}`);
			}
		}
	}
	if (chunks.length === 0) {
		throw new Error(
			`built asset directory has no product route chunks: ${root}`,
		);
	}
	const duplicate = chunks.find(
		(chunk, index) =>
			chunks.findIndex(({ name }) => name === chunk.name) !== index,
	);
	if (duplicate) {
		throw new Error(`normalized chunk name is ambiguous: ${duplicate.name}`);
	}
	return {
		schemaVersion: 1,
		maxGzipDeltaBytes: DEFAULT_MAX_GZIP_DELTA_BYTES,
		totalJsBytes,
		totalJsGzipBytes,
		chunks: chunks.sort((left, right) => left.name.localeCompare(right.name)),
	};
}

export function compareBundle(report, baseline, maxDeltaBytes) {
	if (baseline?.schemaVersion !== 1 || !Array.isArray(baseline.chunks)) {
		throw new Error(
			"bundle baseline must use schemaVersion 1 with a chunks array",
		);
	}
	if (
		!Number.isFinite(baseline.totalJsGzipBytes) ||
		baseline.totalJsGzipBytes < 0
	) {
		throw new Error("bundle baseline has invalid total JavaScript gzip bytes");
	}
	const baselineByName = new Map(
		baseline.chunks.map((chunk) => [chunk.name, chunk]),
	);
	for (const chunk of report.chunks) {
		const previous = baselineByName.get(chunk.name);
		if (!previous) throw new Error(`bundle baseline is missing ${chunk.name}`);
		if (!Number.isFinite(previous.gzipBytes) || previous.gzipBytes < 0) {
			throw new Error(
				`bundle baseline has invalid gzip bytes for ${chunk.name}`,
			);
		}
		const delta = chunk.gzipBytes - previous.gzipBytes;
		chunk.baselineGzipBytes = previous.gzipBytes;
		chunk.gzipDeltaBytes = delta;
		if (delta > maxDeltaBytes) {
			throw new Error(
				`${chunk.name} gzip growth ${delta} bytes exceeds ${maxDeltaBytes} bytes`,
			);
		}
	}
	const totalDelta = report.totalJsGzipBytes - baseline.totalJsGzipBytes;
	report.baselineTotalJsGzipBytes = baseline.totalJsGzipBytes;
	report.totalJsGzipDeltaBytes = totalDelta;
	if (totalDelta > maxDeltaBytes) {
		throw new Error(
			`total JavaScript gzip growth ${totalDelta} bytes exceeds ${maxDeltaBytes} bytes`,
		);
	}
	return report;
}

async function main() {
	const dist = option("--dist", DEFAULT_DIST);
	const reportOnly = process.argv.includes("--report-only");
	const allowPartial = process.argv.includes("--allow-partial");
	const maxDeltaBytes = Number(
		option("--max-delta-bytes", String(DEFAULT_MAX_GZIP_DELTA_BYTES)),
	);
	if (!Number.isInteger(maxDeltaBytes) || maxDeltaBytes < 0) {
		throw new Error("--max-delta-bytes must be a non-negative integer");
	}
	const report = await measureBundle(dist, { allowPartial });
	if (!reportOnly) {
		const baselinePath = resolve(option("--baseline", DEFAULT_BASELINE));
		let baseline;
		try {
			baseline = JSON.parse(await readFile(baselinePath, "utf8"));
		} catch (error) {
			if (error?.code === "ENOENT") {
				throw new Error(`bundle baseline is missing: ${baselinePath}`);
			}
			throw error;
		}
		compareBundle(report, baseline, maxDeltaBytes);
	}
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === executedPath) {
	main().catch((error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	});
}
