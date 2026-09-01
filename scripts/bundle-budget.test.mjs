import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const validator = new URL("./validate-bundle-budget.mjs", import.meta.url);

async function fixture(files) {
	const root = await mkdtemp(join(tmpdir(), "babysteps-bundle-budget-"));
	const assets = join(root, "assets");
	await mkdir(assets, { recursive: true });
	for (const [name, contents] of Object.entries(files)) {
		await writeFile(join(assets, name), contents);
	}
	return root;
}

function validate(args) {
	return spawnSync(process.execPath, [validator.pathname, ...args], {
		encoding: "utf8",
	});
}

function deterministicBytes(size) {
	const chunks = [];
	let bytes = 0;
	for (let index = 0; bytes < size; index += 1) {
		const chunk = createHash("sha256").update(`chunk-${index}`).digest();
		chunks.push(chunk);
		bytes += chunk.byteLength;
	}
	return Buffer.concat(chunks).subarray(0, size);
}

test("bundle budget fails closed when the built assets are missing", () => {
	const result = validate(["--dist", "/definitely/missing/babysteps-dist"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /built asset directory is missing/u);
});

test("bundle budget reports actual gzip bytes for built JavaScript chunks", async () => {
	const dist = await fixture({
		"EvidencePage-abc123.js": "export const evidence = 'real build chunk';\n",
	});
	const result = validate(["--dist", dist, "--report-only", "--allow-partial"]);
	assert.equal(result.status, 0, result.stderr);
	const report = JSON.parse(result.stdout);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.chunks.length, 1);
	assert.equal(report.chunks[0].name, "EvidencePage.js");
	assert.ok(report.chunks[0].gzipBytes > 0);
});

test("bundle budget rejects a route chunk whose gzip growth exceeds 30 KiB", async () => {
	const dist = await fixture({
		"EvidencePage-candidate.js": deterministicBytes(40_000),
	});
	const baseline = join(dist, "baseline.json");
	await writeFile(
		baseline,
		JSON.stringify({
			schemaVersion: 1,
			totalJsGzipBytes: 64,
			chunks: [{ name: "EvidencePage.js", gzipBytes: 64 }],
		}),
	);
	const result = validate([
		"--dist",
		dist,
		"--baseline",
		baseline,
		"--allow-partial",
	]);
	assert.notEqual(result.status, 0);
	assert.match(
		result.stderr,
		/EvidencePage\.js gzip growth .* exceeds 30720 bytes/u,
	);
});

test("bundle budget rejects a baseline that does not cover every route chunk", async () => {
	const dist = await fixture({
		"ProfilePage-candidate.js": "export const profile = true;\n",
	});
	const baseline = join(dist, "baseline.json");
	await writeFile(
		baseline,
		JSON.stringify({ schemaVersion: 1, totalJsGzipBytes: 0, chunks: [] }),
	);
	const result = validate([
		"--dist",
		dist,
		"--baseline",
		baseline,
		"--allow-partial",
	]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /baseline is missing ProfilePage\.js/u);
});

test("bundle budget includes vendor chunks in the total JavaScript payload", async () => {
	const dist = await fixture({
		"EvidencePage-routehash.js": "export const evidence = true;\n",
		"events-context-vendorhash.js": deterministicBytes(50_000),
	});
	const result = validate(["--dist", dist, "--report-only", "--allow-partial"]);
	assert.equal(result.status, 0, result.stderr);
	const report = JSON.parse(result.stdout);
	assert.deepEqual(
		report.chunks.map(({ name }) => name),
		["EvidencePage.js"],
	);
	assert.ok(report.totalJsGzipBytes > report.chunks[0].gzipBytes);
});

test("bundle budget rejects vendor-only growth above the global gzip limit", async () => {
	const dist = await fixture({
		"EvidencePage-routehash.js": "export const evidence = true;\n",
		"events-context-vendorhash.js": deterministicBytes(40_000),
	});
	const baseline = join(dist, "baseline.json");
	await writeFile(
		baseline,
		JSON.stringify({
			schemaVersion: 1,
			totalJsGzipBytes: 64,
			chunks: [{ name: "EvidencePage.js", gzipBytes: 64 }],
		}),
	);
	const result = validate([
		"--dist",
		dist,
		"--baseline",
		baseline,
		"--allow-partial",
	]);
	assert.notEqual(result.status, 0);
	assert.match(
		result.stderr,
		/total JavaScript gzip growth .* exceeds 30720 bytes/u,
	);
});

test("production bundle budget fails if any lazy product route chunk is absent", async () => {
	const dist = await fixture({
		"EvidencePage-routehash.js": "export const evidence = true;\n",
	});
	const result = validate(["--dist", dist, "--report-only"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /production route chunk is missing/u);
});
