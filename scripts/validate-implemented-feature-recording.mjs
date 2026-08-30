import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
	implementedFeatureManifest,
	validateImplementedFeatureClosure,
	validateImplementedFeatureResult,
} from "./run-implemented-feature-journey.mjs";

const expectedJourneyIds = implementedFeatureManifest.map(
	({ journeyId }) => journeyId,
);
const forbiddenKey =
	/(?:private.?key|mnemonic|secret|password|cookie|token|email|signature)/iu;
const forbiddenValue =
	/(?:0x[0-9a-fA-F]{40}(?![0-9a-fA-F])|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\/Users\/|\/home\/)/u;

function option(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function addPrivacyErrors(value, errors, path = "recording") {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			addPrivacyErrors(entry, errors, `${path}.${index}`);
		});
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, entry] of Object.entries(value)) {
			if (forbiddenKey.test(key)) errors.push("PRIVATE_FIELD_FORBIDDEN");
			addPrivacyErrors(entry, errors, `${path}.${key}`);
		}
		return;
	}
	if (typeof value === "string" && forbiddenValue.test(value)) {
		errors.push("PRIVATE_VALUE_FORBIDDEN");
	}
}

export function validateImplementedFeatureRecording(recording, journeyOutput) {
	const errors = [];
	const results = Array.isArray(journeyOutput?.results)
		? journeyOutput.results
		: [];
	const chapters = Array.isArray(recording?.chapters) ? recording.chapters : [];
	const resultIds = results.map(({ journeyId }) => journeyId);
	const chapterIds = chapters.map(({ journeyId }) => journeyId);

	if (recording?.schemaVersion !== 1) errors.push("SCHEMA_VERSION_INVALID");
	if (recording?.provenance !== "visible-ui-controlled-browser") {
		errors.push("PROVENANCE_INVALID");
	}
	if (!/^[0-9a-f]{40}$/u.test(recording?.version ?? "")) {
		errors.push("VERSION_INVALID");
	}
	if (
		JSON.stringify(resultIds) !== JSON.stringify(expectedJourneyIds) ||
		JSON.stringify(chapterIds) !== JSON.stringify(expectedJourneyIds)
	) {
		errors.push("RECORDING_CHAPTERS_NOT_EXACT");
	}
	for (const result of results) {
		const validation = validateImplementedFeatureResult(result);
		if (!validation.valid) {
			errors.push(`JOURNEY_RESULT_INVALID_${result?.journeyId ?? "UNKNOWN"}`);
		}
	}
	const closure = validateImplementedFeatureClosure(results);
	if (!closure.valid) errors.push(...closure.errors);

	for (let index = 0; index < chapters.length; index += 1) {
		const chapter = chapters[index];
		const result = results[index];
		if (
			chapter?.outcome !== "success" ||
			chapter?.route !== result?.route ||
			!Number.isFinite(Date.parse(chapter?.startedAt)) ||
			!Number.isFinite(Date.parse(chapter?.finishedAt)) ||
			Date.parse(chapter.finishedAt) < Date.parse(chapter.startedAt)
		) {
			errors.push(`RECORDING_CHAPTER_INVALID_${chapter?.journeyId ?? index}`);
		}
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
	addPrivacyErrors(journeyOutput, errors, "journeyOutput");

	return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

async function main() {
	const manifestPath = option("--manifest");
	const journeyPath = option("--journey-results");
	if (!manifestPath || !journeyPath) {
		throw new Error("RECORDING_VALIDATION_OPTIONS_REQUIRED");
	}
	const [recordingRaw, journeyRaw] = await Promise.all([
		readFile(manifestPath, "utf8"),
		readFile(journeyPath, "utf8"),
	]);
	const recording = JSON.parse(recordingRaw);
	const journeyOutput = JSON.parse(journeyRaw);
	const validation = validateImplementedFeatureRecording(
		recording,
		journeyOutput,
	);
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
		`${JSON.stringify({ status: "ok", chapters: expectedJourneyIds.length })}\n`,
	);
}

const isEntrypoint = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1]
	: false;
if (isEntrypoint) {
	await main().catch((error) => {
		const code =
			error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
				? error.message
				: "RECORDING_VALIDATION_FAILED";
		process.stderr.write(`${code}\n`);
		process.exitCode = 1;
	});
}
