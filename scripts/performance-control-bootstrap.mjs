export const STOPPED_BOOTSTRAP_SOURCE =
	"babysteps-performance-control-bootstrap-v1";
export const STOPPED_BOOTSTRAP_OPERATION = "bootstrap-stopped-state";

const deliveryPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;
const operationPattern = /^bootstrap-babysteps-stopped-[A-Za-z0-9._:-]{8,96}$/u;
const decimalIdPattern = /^[1-9][0-9]*$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;

function proofIsAuthoritative(proof) {
	return (
		proof?.authority === "github-actions-artifact+aws-zero-residue-readback" &&
		decimalIdPattern.test(proof?.workflowRunId ?? "") &&
		decimalIdPattern.test(proof?.artifactId ?? "") &&
		sha256Pattern.test(proof?.evidenceSha256 ?? "") &&
		proof?.schemaAbsenceVerified === true &&
		proof?.cloudFormationStackAbsent === true &&
		proof?.remainingProjectResources === 0 &&
		proof?.sharedFoundationProtected === true
	);
}

export function buildBootstrapProofFromEvidence(
	evidence,
	rawEvidence,
	currentReadback,
) {
	const inventory = evidence?.cleanup?.inventory;
	const sharedResources = evidence?.cleanup?.sharedResources;
	const historicalZeroResidue =
		evidence?.status === "verified-drained-and-cleaned" &&
		decimalIdPattern.test(String(evidence?.workflow?.runId ?? "")) &&
		decimalIdPattern.test(String(evidence?.workflow?.artifactId ?? "")) &&
		evidence?.cleanup?.schemaAbsenceVerified === true &&
		evidence?.cleanup?.cloudFormationStackAbsent === true &&
		evidence?.cleanup?.remainingProjectResources === 0 &&
		inventory &&
		Object.values(inventory).every((count) => count === 0) &&
		sharedResources?.vpc === "protected-read-only" &&
		sharedResources?.nat === "protected-read-only" &&
		sharedResources?.database === "protected-read-only" &&
		sharedResources?.oidc === "protected-read-only" &&
		sharedResources?.artifactBucket === "protected-read-only" &&
		sharedResources?.foundation === "explicit deny cleanup";
	const currentZeroResidue =
		currentReadback?.cloudFormationStackAbsent === true &&
		currentReadback?.remainingRunnableProjectResources === 0 &&
		currentReadback?.sharedFoundationProtected === true;
	if (!historicalZeroResidue || !currentZeroResidue) {
		throw new Error("BOOTSTRAP_EVIDENCE_NOT_ZERO_RESIDUE");
	}
	return {
		authority: "github-actions-artifact+aws-zero-residue-readback",
		workflowRunId: String(evidence.workflow.runId),
		artifactId: String(evidence.workflow.artifactId),
		evidenceSha256: createHash("sha256").update(rawEvidence).digest("hex"),
		schemaAbsenceVerified: true,
		cloudFormationStackAbsent: true,
		remainingProjectResources: 0,
		sharedFoundationProtected: true,
	};
}

export function buildStoppedBootstrapEnvelope({
	deliveryId,
	operationId,
	generation,
	workflowRunId,
	occurredAt,
	proof,
}) {
	if (!deliveryPattern.test(deliveryId ?? "")) {
		throw new Error("BOOTSTRAP_DELIVERY_ID_INVALID");
	}
	if (!operationPattern.test(operationId ?? "")) {
		throw new Error("BOOTSTRAP_OPERATION_ID_INVALID");
	}
	if (generation !== 1) throw new Error("BOOTSTRAP_GENERATION_INVALID");
	if (!decimalIdPattern.test(workflowRunId ?? "")) {
		throw new Error("BOOTSTRAP_WORKFLOW_RUN_ID_INVALID");
	}
	if (!Number.isFinite(Date.parse(occurredAt ?? ""))) {
		throw new Error("BOOTSTRAP_OCCURRED_AT_INVALID");
	}
	if (!proofIsAuthoritative(proof)) {
		throw new Error("BOOTSTRAP_PROOF_INVALID");
	}
	return {
		schemaVersion: "1.0",
		deliveryId,
		source: STOPPED_BOOTSTRAP_SOURCE,
		operation: STOPPED_BOOTSTRAP_OPERATION,
		operationId,
		generation,
		workflowRunId,
		status: "stopped",
		occurredAt,
		cleanupVerified: true,
		zeroResidualVerified: true,
		bootstrapOnly: true,
		proof: { ...proof },
	};
}

function envelopeIsBootstrapOnly(payload) {
	return (
		payload?.schemaVersion === "1.0" &&
		payload?.source === STOPPED_BOOTSTRAP_SOURCE &&
		payload?.operation === STOPPED_BOOTSTRAP_OPERATION &&
		payload?.generation === 1 &&
		payload?.status === "stopped" &&
		payload?.cleanupVerified === true &&
		payload?.zeroResidualVerified === true &&
		payload?.bootstrapOnly === true
	);
}

export function evaluateStoppedBootstrapAdmission({
	existingControlRow,
	hmacVerified,
	timestampFresh,
	deliveryIdMatches,
	payload,
}) {
	const reasons = [];
	if (existingControlRow !== null) reasons.push("CONTROL_ROW_ALREADY_EXISTS");
	if (hmacVerified !== true) reasons.push("HMAC_NOT_VERIFIED");
	if (timestampFresh !== true) reasons.push("TIMESTAMP_NOT_FRESH");
	if (deliveryIdMatches !== true) reasons.push("DELIVERY_ID_NOT_BOUND");
	if (!envelopeIsBootstrapOnly(payload)) {
		reasons.push("BOOTSTRAP_ENVELOPE_INVALID");
	}
	if (!proofIsAuthoritative(payload?.proof)) {
		reasons.push("ZERO_RESIDUE_PROOF_INVALID");
	}
	return reasons.length === 0
		? { allowed: true, action: "insert-initial-stopped-row", reasons }
		: { allowed: false, action: "reject", reasons };
}

function option(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
	const evidencePath = option("--evidence");
	const currentReadbackPath = option("--current-readback");
	const outputPath = option("--output");
	if (!evidencePath || !currentReadbackPath || !outputPath) {
		throw new Error("BOOTSTRAP_OPTIONS_REQUIRED");
	}
	const [rawEvidence, rawCurrentReadback] = await Promise.all([
		readFile(evidencePath, "utf8"),
		readFile(currentReadbackPath, "utf8"),
	]);
	const proof = buildBootstrapProofFromEvidence(
		JSON.parse(rawEvidence),
		rawEvidence,
		JSON.parse(rawCurrentReadback),
	);
	const envelope = buildStoppedBootstrapEnvelope({
		deliveryId: option("--delivery-id"),
		operationId: option("--operation-id"),
		generation: Number(option("--generation")),
		workflowRunId: option("--workflow-run-id"),
		occurredAt: option("--occurred-at"),
		proof,
	});
	await writeFile(outputPath, `${JSON.stringify(envelope)}\n`, {
		mode: 0o600,
	});
}

const isEntrypoint = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1]
	: false;
if (isEntrypoint) {
	await main().catch((error) => {
		const code =
			error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
				? error.message
				: "BOOTSTRAP_FAILED";
		process.stderr.write(`${code}\n`);
		process.exitCode = 1;
	});
}

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
