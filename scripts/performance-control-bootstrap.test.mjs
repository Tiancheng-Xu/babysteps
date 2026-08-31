import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const validProof = {
	authority: "github-actions-artifact+aws-zero-residue-readback",
	workflowRunId: "33370197607",
	artifactId: "9750458914",
	evidenceSha256:
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	schemaAbsenceVerified: true,
	cloudFormationStackAbsent: true,
	remainingProjectResources: 0,
	sharedFoundationProtected: true,
};

test("stopped safety bootstrap admits only an authenticated first D1 row", async () => {
	const {
		STOPPED_BOOTSTRAP_OPERATION,
		STOPPED_BOOTSTRAP_SOURCE,
		buildStoppedBootstrapEnvelope,
		evaluateStoppedBootstrapAdmission,
	} = await import("./performance-control-bootstrap.mjs");
	const payload = buildStoppedBootstrapEnvelope({
		deliveryId: "github-33333333333-1-bootstrap-stopped",
		operationId: "bootstrap-babysteps-stopped-33333333333",
		generation: 1,
		workflowRunId: "33333333333",
		occurredAt: "2026-08-30T12:00:00.000Z",
		proof: validProof,
	});
	assert.equal(payload.source, STOPPED_BOOTSTRAP_SOURCE);
	assert.equal(payload.operation, STOPPED_BOOTSTRAP_OPERATION);
	assert.equal(payload.status, "stopped");
	assert.equal(payload.cleanupVerified, true);
	assert.equal(payload.zeroResidualVerified, true);
	assert.equal(payload.bootstrapOnly, true);

	const admission = evaluateStoppedBootstrapAdmission({
		existingControlRow: null,
		hmacVerified: true,
		timestampFresh: true,
		deliveryIdMatches: true,
		payload,
	});
	assert.deepEqual(admission, {
		allowed: true,
		action: "insert-initial-stopped-row",
		reasons: [],
	});
});

test("bootstrap proof is derived from the verified GitHub artifact and exact zero-residue evidence", async () => {
	const { buildBootstrapProofFromEvidence } = await import(
		"./performance-control-bootstrap.mjs"
	);
	const raw = await readFile(
		"docs/evidence/deployment/2026-08-31-performance-aws-final.json",
		"utf8",
	);
	const evidence = JSON.parse(raw);
	const currentReadback = {
		cloudFormationStackAbsent: true,
		remainingRunnableProjectResources: 0,
		sharedFoundationProtected: true,
	};
	const proof = buildBootstrapProofFromEvidence(evidence, raw, currentReadback);
	assert.equal(proof.workflowRunId, "33370197607");
	assert.equal(proof.artifactId, "9750458914");
	assert.match(proof.evidenceSha256, /^[0-9a-f]{64}$/u);
	assert.equal(proof.schemaAbsenceVerified, true);
	assert.equal(proof.cloudFormationStackAbsent, true);
	assert.equal(proof.remainingProjectResources, 0);
	assert.equal(proof.sharedFoundationProtected, true);
	assert.throws(
		() =>
			buildBootstrapProofFromEvidence(
				{
					...evidence,
					cleanup: { ...evidence.cleanup, remainingProjectResources: 1 },
				},
				raw,
				currentReadback,
			),
		/BOOTSTRAP_EVIDENCE_NOT_ZERO_RESIDUE/u,
	);
});

test("stopped safety bootstrap fails closed for replay, stale HMAC, or weak cleanup proof", async () => {
	const { buildStoppedBootstrapEnvelope, evaluateStoppedBootstrapAdmission } =
		await import("./performance-control-bootstrap.mjs");
	const payload = buildStoppedBootstrapEnvelope({
		deliveryId: "github-33333333333-1-bootstrap-stopped",
		operationId: "bootstrap-babysteps-stopped-33333333333",
		generation: 1,
		workflowRunId: "33333333333",
		occurredAt: "2026-08-30T12:00:00.000Z",
		proof: validProof,
	});
	assert.deepEqual(
		evaluateStoppedBootstrapAdmission({
			existingControlRow: { generation: 1 },
			hmacVerified: false,
			timestampFresh: false,
			deliveryIdMatches: false,
			payload: {
				...payload,
				proof: { ...payload.proof, remainingProjectResources: 1 },
			},
		}),
		{
			allowed: false,
			action: "reject",
			reasons: [
				"CONTROL_ROW_ALREADY_EXISTS",
				"HMAC_NOT_VERIFIED",
				"TIMESTAMP_NOT_FRESH",
				"DELIVERY_ID_NOT_BOUND",
				"ZERO_RESIDUE_PROOF_INVALID",
			],
		},
	);
});
