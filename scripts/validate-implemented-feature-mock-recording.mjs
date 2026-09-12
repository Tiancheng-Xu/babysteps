import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { selectImplementedFeatureJourneys } from "./run-implemented-feature-journey.mjs";

const expectedJourneys = selectImplementedFeatureJourneys("non-aws").journeys;
const expectedExcluded = [
	{ journeyId: "PERF-01", reason: "AWS_SCOPE_EXCLUDED" },
];
const forbiddenKey =
	/(?:private.?key|mnemonic|secret|password|cookie|token|email|signature)/iu;
const forbiddenValue =
	/(?:0x[0-9a-fA-F]{40}(?![0-9a-fA-F])|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\/Users\/|\/home\/)/u;

function option(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function addPrivacyErrors(value, errors) {
	if (Array.isArray(value)) {
		value.forEach((entry) => {
			addPrivacyErrors(entry, errors);
		});
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, entry] of Object.entries(value)) {
			if (forbiddenKey.test(key)) errors.push("PRIVATE_FIELD_FORBIDDEN");
			addPrivacyErrors(entry, errors);
		}
		return;
	}
	if (typeof value === "string" && forbiddenValue.test(value)) {
		errors.push("PRIVATE_VALUE_FORBIDDEN");
	}
}

export function validateImplementedFeatureMockRecording(recording) {
	const errors = [];
	const chapters = Array.isArray(recording?.chapters) ? recording.chapters : [];

	if (recording?.schemaVersion !== 1) errors.push("SCHEMA_VERSION_INVALID");
	if (
		recording?.provenance !==
		"controlled-browser-local-production-build-mock-data"
	) {
		errors.push("MOCK_PROVENANCE_INVALID");
	}
	if (
		recording?.scope !== "non-aws" ||
		recording?.stage !== "mock-coverage-verified" ||
		recording?.mockData !== true ||
		recording?.fullJourneyProof !== false ||
		recording?.chainTransactions !== 0 ||
		recording?.awsWrites !== 0
	) {
		errors.push("MOCK_BOUNDARY_INVALID");
	}
	if (!/^[0-9a-f]{40}$/u.test(recording?.version ?? "")) {
		errors.push("VERSION_INVALID");
	}
	if (
		JSON.stringify(recording?.excludedJourneys) !==
		JSON.stringify(expectedExcluded)
	) {
		errors.push("MOCK_SCOPE_COVERAGE_INVALID");
	}
	if (
		chapters.length !== expectedJourneys.length ||
		chapters.some(
			(chapter, index) =>
				chapter?.journeyId !== expectedJourneys[index]?.journeyId ||
				chapter?.route !== expectedJourneys[index]?.route ||
				chapter?.outcome !== "simulated-success" ||
				!Number.isFinite(Date.parse(chapter?.startedAt)) ||
				!Number.isFinite(Date.parse(chapter?.finishedAt)) ||
				Date.parse(chapter.finishedAt) < Date.parse(chapter.startedAt),
		)
	) {
		errors.push("MOCK_CHAPTERS_NOT_EXACT");
	}
	if (
		typeof recording?.media?.file !== "string" ||
		basename(recording.media.file) !== recording.media.file ||
		!/^[0-9a-f]{64}$/u.test(recording?.media?.sha256 ?? "") ||
		!(recording?.media?.bytes > 0) ||
		!(recording?.media?.durationSeconds > 0) ||
		recording?.media?.audio !== false
	) {
		errors.push("MEDIA_METADATA_INVALID");
	}
	if (recording?.media?.contactSheetReviewed !== true) {
		errors.push("CONTACT_SHEET_NOT_REVIEWED");
	}
	if (
		JSON.stringify(recording?.viewports) !==
		JSON.stringify([375, 390, 430, 1440])
	) {
		errors.push("VIEWPORT_COVERAGE_INVALID");
	}
	if (recording?.pageErrors !== 0) errors.push("PAGEERROR_PRESENT");
	if (recording?.rootOverflow !== 0) errors.push("ROOT_OVERFLOW_PRESENT");
	addPrivacyErrors(recording, errors);

	return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

async function main() {
	const manifestPath = option("--manifest");
	if (!manifestPath) throw new Error("MOCK_RECORDING_MANIFEST_REQUIRED");
	const recording = JSON.parse(await readFile(manifestPath, "utf8"));
	const validation = validateImplementedFeatureMockRecording(recording);
	if (!validation.valid) throw new Error(validation.errors[0]);
	const mediaPath = resolve(
		dirname(resolve(manifestPath)),
		recording.media.file,
	);
	const media = await readFile(mediaPath);
	if (media.byteLength !== recording.media.bytes) {
		throw new Error("MEDIA_BYTES_MISMATCH");
	}
	if (
		createHash("sha256").update(media).digest("hex") !== recording.media.sha256
	) {
		throw new Error("MEDIA_HASH_MISMATCH");
	}
	const duration = Number(
		execFileSync(
			"ffprobe",
			[
				"-v",
				"error",
				"-show_entries",
				"format=duration",
				"-of",
				"default=noprint_wrappers=1:nokey=1",
				mediaPath,
			],
			{ encoding: "utf8" },
		).trim(),
	);
	if (
		!Number.isFinite(duration) ||
		Math.abs(duration - recording.media.durationSeconds) > 1
	) {
		throw new Error("MEDIA_DURATION_MISMATCH");
	}
	process.stdout.write(
		`${JSON.stringify({ status: "ok", chapters: expectedJourneys.length })}\n`,
	);
}

const isEntrypoint = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1]
	: false;
if (isEntrypoint) {
	await main().catch((error) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : "MOCK_RECORDING_INVALID"}\n`,
		);
		process.exitCode = 1;
	});
}
