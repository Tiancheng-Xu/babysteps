import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

const WORKFLOW = ".github/workflows/aws-performance-control.yml";

async function loadWorkflow() {
	const source = await readFile(WORKFLOW, "utf8").catch(() => "");
	assert.notEqual(source, "", `${WORKFLOW} must exist`);
	const workflow = parse(source);
	assert.ok(
		workflow && typeof workflow === "object",
		"workflow must parse as YAML",
	);
	assert.ok(
		workflow.on && workflow.jobs,
		"workflow must declare triggers and jobs",
	);
	const jobs = Object.values(workflow.jobs);
	assert.equal(
		jobs.length,
		1,
		"one serialized lifecycle job must own all operations",
	);
	const job = jobs[0];
	assert.ok(
		Array.isArray(job.steps),
		"lifecycle job must contain parsed steps",
	);
	return { source, workflow, job, steps: job.steps };
}

function stepByName(steps, name) {
	const step = steps.find((candidate) => candidate.name === name);
	assert.ok(step, `missing workflow step: ${name}`);
	return step;
}

function indexById(steps, id) {
	const index = steps.findIndex((step) => step.id === id);
	assert.notEqual(index, -1, `missing workflow step id: ${id}`);
	return index;
}

test("parsed workflow exposes the exact v1 dispatch inputs plus scheduled safety expiry", async () => {
	const { workflow, job } = await loadWorkflow();
	const dispatch = workflow.on.workflow_dispatch;
	assert.deepEqual(Object.keys(dispatch.inputs).sort(), [
		"action",
		"estimated_cost_usd",
		"expires_at",
		"generation",
		"operation_id",
	]);
	assert.deepEqual(dispatch.inputs.action.options, [
		"bootstrap",
		"preflight",
		"start",
		"stop",
	]);
	assert.equal(dispatch.inputs.action.type, "choice");
	assert.equal(dispatch.inputs.action.required, true);
	assert.equal(dispatch.inputs.operation_id.required, false);
	assert.equal(dispatch.inputs.generation.required, false);
	assert.equal(dispatch.inputs.expires_at.required, false);
	assert.equal(dispatch.inputs.estimated_cost_usd.required, false);
	assert.ok(workflow.on.schedule.length > 0, "scheduled expiry must exist");
	assert.deepEqual(workflow.concurrency, {
		group: "babysteps-performance-control",
		"cancel-in-progress": false,
	});
	assert.equal(job.environment, "aws-performance");
	assert.equal(job.permissions["id-token"], "write");
});

test("stopped bootstrap is read-only, generation one, and cannot impersonate a normal stop", async () => {
	const { steps } = await loadWorkflow();
	const validation = stepByName(steps, "Validate untrusted control request");
	assert.match(validation.run, /bootstrap/);
	assert.match(validation.run, /REQUESTED_GENERATION" = "1"/);
	assert.match(validation.run, /test -z "\$REQUESTED_EXPIRES_AT"/);
	assert.match(validation.run, /test -z "\$REQUESTED_ESTIMATED_COST_USD"/);

	const resolve = stepByName(steps, "Resolve fixed action and expiry");
	assert.match(resolve.run, /action" = "bootstrap"/);
	assert.match(
		resolve.run,
		/source=babysteps-performance-control-bootstrap-v1/,
	);
	assert.match(resolve.run, /generation=1/);
	assert.match(resolve.run, /test "\$stack_presence" = 3/);

	const residue = stepByName(steps, "Verify zero project residue");
	assert.match(residue.if, /action == 'bootstrap'/);
	const callback = stepByName(
		steps,
		"Publish initial verified stopped bootstrap callback",
	);
	assert.match(callback.if, /action == 'bootstrap'/);
	assert.match(callback.if, /zero-residue\.outcome == 'success'/);
	assert.match(
		callback.run,
		/docs\/evidence\/deployment\/2026-08-31-performance-aws-final\.json/,
	);
	assert.match(callback.run, /performance-control-bootstrap\.mjs/);
	assert.match(callback.run, /performance_post_callback/);
	assert.doesNotMatch(callback.run, /status cleanup_required|status running/);

	for (const name of [
		"Mark persistent cleanup state running",
		"Deploy existing single performance stack",
		"Initialize exact project database schema",
		"Delete exact stable project stack",
	]) {
		assert.doesNotMatch(stepByName(steps, name).if, /bootstrap/);
	}
});

test("preflight is read-only and reuses the exact zero-residue gate", async () => {
	const { steps } = await loadWorkflow();
	const resolve = stepByName(steps, "Resolve fixed action and expiry");
	assert.match(resolve.run, /action" = "preflight"/);
	assert.match(resolve.run, /source=operator-readonly-preflight/);

	const foundation = stepByName(
		steps,
		"Verify protected shared foundation is ready",
	);
	assert.match(foundation.if, /action != 'preflight'/);

	const residue = stepByName(steps, "Verify zero project residue");
	assert.match(residue.if, /action == 'preflight'/);
	assert.match(residue.run, /aws sts get-caller-identity/);
	assert.match(residue.run, /aws_assert_exact_lambda_absent/);
	assert.doesNotMatch(residue.run, /aws lambda get-function/);

	for (const name of [
		"Mark persistent cleanup state running",
		"Deploy existing single performance stack",
		"Delete exact stable project stack",
		"Mark persistent cleanup state required",
		"Mark persistent cleanup state verified",
		"Publish running callback",
		"Publish verified stopped snapshot callback",
		"Publish idempotent stopped callback",
		"Publish cleanup_required without claiming cleanup success",
	]) {
		assert.doesNotMatch(stepByName(steps, name).if, /preflight/);
	}
});

test("parsed workflow fixes region, stack, TTL and cost outside caller inputs", async () => {
	const { workflow, job, source } = await loadWorkflow();
	assert.deepEqual(job.env, {
		AWS_REGION: "us-east-1",
		STACK_NAME: "babysteps-performance-control",
		ENVIRONMENT_NAME: "control",
		TTL_MINUTES: 45,
		MAX_INCREMENTAL_COST_USD: "0.20",
		ESTIMATED_INCREMENTAL_COST_USD: "0.20",
		PERFORMANCE_CONTROL_CALLBACK_URL:
			"https://baby2b.online/api/performance/control/callback",
		CLEANUP_STATE_PARAMETER: "/babysteps/performance-control/cleanup-state",
		ACTIVE_OPERATION_PARAMETER:
			"/babysteps/performance-control/active-operation",
		RUN_ID: "${{ github.run_id }}",
	});
	assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs).sort(), [
		"action",
		"estimated_cost_usd",
		"expires_at",
		"generation",
		"operation_id",
	]);
	assert.doesNotMatch(source, /inputs\.(?:region|stack|ttl|duration|callback)/);
	assert.match(source, /scripts\/validate-performance-budget\.mjs/);
	assert.match(
		source,
		/sam validate --lint --region us-east-1 --template-file aws\/performance-template\.yaml/,
	);
});

test("parsed start stop and safety-expiry cleanup topology are explicit", async () => {
	const { steps } = await loadWorkflow();
	const resolve = stepByName(steps, "Resolve fixed action and expiry");
	assert.match(resolve.run, /action=expiry/);
	assert.doesNotMatch(resolve.run, /scheduled-aggregate/);
	assert.match(resolve.run, /ACTIVE_OPERATION_PARAMETER/);
	assert.match(resolve.run, /generation=.*active-operation\.json/);
	assert.match(resolve.run, /source=aws-safety-expiry/);
	assert.doesNotMatch(resolve.run, /operation_id="expiry-/);
	assert.match(
		resolve.run,
		/test "\$REQUESTED_GENERATION" = "\$active_generation"/,
	);
	assert.match(
		resolve.run,
		/test "\$REQUESTED_EXPIRES_AT" = "\$active_expires_at"/,
	);
	assert.match(resolve.run, /test "\$active_presence" = 0/);
	const stopBindingIndex = resolve.run.indexOf(
		'test "$REQUESTED_GENERATION" = "$active_generation"',
	);
	const idempotentStopIndex = resolve.run.indexOf("action=idempotent-stop");
	assert.ok(stopBindingIndex >= 0 && stopBindingIndex < idempotentStopIndex);
	assert.match(resolve.run, /operation_id="\$REQUESTED_OPERATION_ID"/);
	assert.match(
		resolve.run,
		/if test "\$REQUESTED_OPERATION_ID" = "\$active_operation_id"; then/,
	);

	for (const name of [
		"Refuse duplicate start",
		"Build existing performance artifacts",
		"Generate ephemeral origin token for this stack lifecycle",
		"Deploy existing single performance stack",
		"Initialize exact project database schema",
	]) {
		assert.equal(
			stepByName(steps, name).if,
			"steps.resolve.outputs.action == 'start'",
		);
	}

	const aggregate = stepByName(steps, "Run final-aggregate");
	assert.doesNotMatch(aggregate.if, /scheduled-aggregate/);
	assert.match(aggregate.if, /stop/);
	assert.match(aggregate.if, /expiry/);

	const aggregateIndex = indexById(steps, "aggregate");
	const schemaIndex = indexById(steps, "schema-cleanup");
	const deleteIndex = indexById(steps, "delete-stack");
	const residueIndex = indexById(steps, "zero-residue");
	const stoppedIndex = indexById(steps, "stopped-callback");
	assert.ok(aggregateIndex < schemaIndex);
	assert.ok(schemaIndex < deleteIndex);
	assert.ok(deleteIndex < residueIndex);
	assert.ok(residueIndex < stoppedIndex);
	assert.match(steps[deleteIndex].if, /^always\(\)/);
	assert.match(steps[deleteIndex].if, /schema-cleanup\.outcome == 'success'/);
	assert.match(steps[residueIndex].if, /^always\(\)/);
	assert.match(
		steps[stoppedIndex].if,
		/steps\.zero-residue\.outcome == 'success'/,
	);
});

test("Showcase owns canonical start expiry within the fixed TTL window", async () => {
	const { steps } = await loadWorkflow();
	const validation = stepByName(steps, "Validate untrusted control request");
	assert.match(validation.run, /expected_expiry_epoch=.*TTL_MINUTES \* 60/);
	assert.match(
		validation.run,
		/expiry_delta=.*requested_expiry_epoch - expected_expiry_epoch/,
	);
	assert.match(validation.run, /test "\$expiry_delta" -le 120/);
	const resolve = stepByName(steps, "Resolve fixed action and expiry");
	assert.match(resolve.run, /expires_at="\$REQUESTED_EXPIRES_AT"/);
	assert.doesNotMatch(resolve.run, /expires_at="\$\(date -u -d "\+/);
});

test("failure callbacks are always evaluated and report honest states", async () => {
	const { steps } = await loadWorkflow();
	const cleanupRequired = stepByName(
		steps,
		"Publish cleanup_required without claiming cleanup success",
	);
	assert.match(cleanupRequired.if, /^always\(\)/);
	assert.match(
		cleanupRequired.if,
		/steps\.stopped-callback\.outcome != 'success'/,
	);
	assert.match(cleanupRequired.run, /--arg status cleanup_required/);
});

test("callbacks use v1 headers and HMAC timestamp dot exact raw body", async () => {
	const { job, steps, source } = await loadWorkflow();
	assert.equal(
		job.env.PERFORMANCE_CONTROL_CALLBACK_URL,
		"https://baby2b.online/api/performance/control/callback",
	);
	assert.doesNotMatch(source, /evidence\.baby2b\.online/);
	for (const step of steps.filter(
		(candidate) =>
			/^Publish /.test(candidate.name ?? "") &&
			/callback/i.test(candidate.name ?? ""),
	)) {
		if (!step.run) continue;
		assert.match(step.run, /performance_post_callback/);
	}
	const helper = await readFile(
		"scripts/aws-performance-control-state.sh",
		"utf8",
	);
	assert.match(helper, /printf '%s' "\$timestamp\.\$body"/);
	assert.match(helper, /signature="sha256=\$digest"/);
	assert.match(helper, /x-performance-timestamp: \$timestamp/);
	assert.match(helper, /x-performance-delivery-id: \$delivery_id/);
	assert.match(helper, /x-performance-signature-256: \$signature/);
	assert.match(helper, /for attempt in 1 2 3/);
	assert.match(helper, /--data-binary "\$body"/);
	assert.doesNotMatch(source, /x-babysteps-(?:timestamp|signature)/);
	assert.doesNotMatch(source, /AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/);
});

test("consumer fixture locks HMAC, envelope, delivery binding, and terminal safety expiry", async () => {
	const fixture = JSON.parse(
		await readFile("scripts/fixtures/performance-lifecycle-v1.json", "utf8"),
	);
	assert.deepEqual(fixture.dispatchInputKeys, [
		"action",
		"operation_id",
		"generation",
		"expires_at",
		"estimated_cost_usd",
	]);
	assert.deepEqual(Object.keys(fixture.dispatch), fixture.dispatchInputKeys);
	assert.deepEqual(
		Object.keys(fixture.stopDispatch),
		fixture.dispatchInputKeys,
	);
	assert.equal(fixture.dispatch.estimated_cost_usd, "0.20");
	assert.equal(fixture.stopDispatch.estimated_cost_usd, "0.20");
	assert.equal(fixture.stopDispatch.generation, fixture.dispatch.generation);
	assert.equal(fixture.stopDispatch.expires_at, fixture.dispatch.expires_at);
	assert.notEqual(
		fixture.stopDispatch.operation_id,
		fixture.dispatch.operation_id,
	);
	assert.deepEqual(fixture.callbackHeaderKeys, [
		"x-performance-timestamp",
		"x-performance-delivery-id",
		"x-performance-signature-256",
	]);
	const digest = createHmac("sha256", fixture.hmac.secret)
		.update(`${fixture.hmac.timestamp}.${fixture.hmac.rawBody}`)
		.digest("hex");
	assert.equal(fixture.hmac.signature, `sha256=${digest}`);
	assert.deepEqual(JSON.parse(fixture.hmac.rawBody), fixture.controlTerminal);
	for (const envelope of [
		fixture.controlTerminal,
		fixture.awsSafetyExpiryTerminal,
	]) {
		assert.deepEqual(Object.keys(envelope).sort(), [
			"cleanupVerified",
			"deliveryId",
			"generation",
			"occurredAt",
			"operationId",
			"schemaVersion",
			"source",
			"status",
			"workflowRunId",
			"zeroResidualVerified",
		]);
		assert.equal(envelope.schemaVersion, "1.0");
		assert.match(envelope.deliveryId, /\S/);
		assert.ok(["control", "aws-safety-expiry"].includes(envelope.source));
		assert.match(envelope.operationId, /\S/);
		assert.ok(Number.isInteger(envelope.generation) && envelope.generation > 0);
		assert.match(envelope.workflowRunId, /\S/);
		assert.ok(
			[
				"starting",
				"running",
				"stopping",
				"stopped",
				"degraded",
				"cleanup_required",
				"failed",
			].includes(envelope.status),
		);
		assert.equal(
			new Date(envelope.occurredAt).toISOString(),
			envelope.occurredAt,
		);
		assert.equal(typeof envelope.cleanupVerified, "boolean");
		assert.equal(typeof envelope.zeroResidualVerified, "boolean");
		if (envelope.status === "stopped") {
			assert.equal(envelope.cleanupVerified, true);
			assert.equal(envelope.zeroResidualVerified, true);
		}
	}
	assert.equal(fixture.awsSafetyExpiryTerminal.source, "aws-safety-expiry");
	assert.ok(
		["stopped", "cleanup_required", "failed"].includes(
			fixture.awsSafetyExpiryTerminal.status,
		),
	);
});

test("every workflow producer emits the fixture v1 envelope schema", async () => {
	const { steps } = await loadWorkflow();
	const producers = steps.filter(
		(step) =>
			/^Publish /.test(step.name ?? "") &&
			/callback/.test(step.name ?? "") &&
			/body="\$\(jq/.test(step.run ?? ""),
	);
	assert.ok(producers.length >= 3);
	const required = [
		'schemaVersion:"1.0"',
		"deliveryId:$deliveryId",
		"source:$source",
		"operationId:$operationId",
		"generation:($generation|tonumber)",
		"workflowRunId:$workflowRunId",
		"status:$status",
		"occurredAt:$occurredAt",
		"cleanupVerified:",
		"zeroResidualVerified:",
	];
	for (const producer of producers) {
		for (const token of required) {
			assert.ok(
				producer.run.includes(token),
				producer.name + " is missing envelope token " + token,
			);
		}
		assert.match(producer.run, /performance_post_callback/);
	}
});

test("origin token crosses workflows only through the exact stack secret output", async () => {
	const [{ source, steps }, templateSource] = await Promise.all([
		loadWorkflow(),
		readFile("aws/performance-template.yaml", "utf8"),
	]);
	assert.doesNotMatch(source, /secrets\.AWS_PERFORMANCE_ORIGIN_TOKEN/);
	assert.match(source, /openssl rand -hex 32/);
	assert.match(
		templateSource,
		/OriginTokenSecret:[\s\S]*SecretString:\s*\{ Ref: OriginToken \}/,
	);
	assert.match(
		templateSource,
		/OriginTokenSecretArn:\s*\{ Value:\s*\{ Fn::GetAtt:\s*\[OriginTokenSecret, Id\] \} \}/,
	);
	const resolveToken = stepByName(
		steps,
		"Resolve ephemeral origin token from exact stack secret",
	);
	assert.match(resolveToken.if, /stop/);
	assert.match(resolveToken.if, /expiry/);
	assert.match(resolveToken.run, /OutputKey=='OriginTokenSecretArn'/);
	assert.match(
		resolveToken.run,
		/secretsmanager get-secret-value --secret-id "\$origin_token_secret_arn"/,
	);
	const residue = stepByName(steps, "Verify zero project residue");
	assert.match(
		residue.run,
		/secretsmanager describe-secret --secret-id babysteps-performance-origin-control/,
	);
});

test("workflow records exact origin-secret IAM readback without claiming local verification", async () => {
	const { steps } = await loadWorkflow();
	const permission = stepByName(
		steps,
		"Verify exact origin secret read permissions",
	);
	assert.match(permission.run, /secretsmanager describe-secret/);
	assert.match(permission.run, /secretsmanager get-secret-value/);
	assert.match(permission.run, /GetSecretValue/);
	assert.match(permission.run, /DescribeSecret/);
	assert.match(permission.run, /pending-cloud-readback/);
});

test("event and input expressions enter shell only through step env after operation id validation", async () => {
	const { steps } = await loadWorkflow();
	for (const step of steps) {
		if (!step.run) continue;
		assert.doesNotMatch(step.run, /\$\{\{\s*inputs\./);
		assert.doesNotMatch(step.run, /\$\{\{\s*github\.event/);
		assert.doesNotMatch(step.run, /steps\.resolve\.outputs\.operation_id/);
	}
	const validation = stepByName(steps, "Validate untrusted control request");
	assert.deepEqual(validation.env, {
		EVENT_NAME: "${{ github.event_name }}",
		REQUESTED_ACTION: "${{ inputs.action }}",
		REQUESTED_OPERATION_ID: "${{ inputs.operation_id }}",
		REQUESTED_GENERATION: "${{ inputs.generation }}",
		REQUESTED_EXPIRES_AT: "${{ inputs.expires_at }}",
		REQUESTED_ESTIMATED_COST_USD: "${{ inputs.estimated_cost_usd }}",
	});
	assert.match(
		validation.run,
		/\[\[ "\$OPERATION_ID" =~ \^\[A-Za-z0-9\]\[A-Za-z0-9\._:-\]\{7,127\}\$ \]\]/,
	);
	const validationIndex = steps.indexOf(validation);
	const firstAwsOrSecret = steps.findIndex(
		(step) =>
			/aws-actions\/configure-aws-credentials/.test(step.uses ?? "") ||
			/secrets\./.test(JSON.stringify(step.env ?? {})),
	);
	assert.ok(validationIndex < firstAwsOrSecret);
});

test("final aggregation is best effort while schema cleanup preserves the exact recovery stack on failure", async () => {
	const { steps } = await loadWorkflow();
	const aggregate = stepByName(steps, "Run final-aggregate");
	assert.equal(aggregate["continue-on-error"], true);
	assert.match(
		aggregate.run,
		/stats\?window=1h&metric=all&environment=production/,
	);
	assert.match(aggregate.run, /build-performance-snapshot\.mjs/);
	assert.match(aggregate.run, /schemaVersion!==2/);

	const schema = stepByName(
		steps,
		"DROP SCHEMA using exact schema-cleanup task",
	);
	assert.match(schema.if, /^always\(\)/);
	assert.doesNotMatch(schema.if, /steps\.aggregate\.outcome == 'success'/);
	assert.match(schema.run, /for attempt in 1 2 3/);
	assert.match(schema.run, /schemaDeleted.*false/s);

	const deletion = stepByName(steps, "Delete exact stable project stack");
	assert.match(deletion.if, /^always\(\)/);
	assert.match(deletion.if, /schema-cleanup\.outcome == 'success'/);
	assert.match(deletion.if, /expiry/);
	assert.match(deletion.run, /for attempt in 1 2 3/);
	assert.match(deletion.run, /stack-delete-complete/);
});

test("stop without a stack performs fixed residue readback and idempotent stopped callback", async () => {
	const { steps } = await loadWorkflow();
	const resolve = stepByName(steps, "Resolve fixed action and expiry");
	assert.match(resolve.run, /action=idempotent-stop/);
	const residue = stepByName(steps, "Verify zero project residue");
	assert.match(residue.if, /idempotent-stop/);
	assert.match(residue.run, /babysteps-performance-control/);
	assert.doesNotMatch(residue.run, /inputs\.|STACK_NAME=.*\$\{/);
	assert.doesNotMatch(residue.run, /"schemaDeleted":true/);
	assert.match(residue.run, /SCHEMA_CLEANUP_OUTCOME/);
	assert.match(residue.run, /schema_deleted=unknown/);
	const callback = stepByName(steps, "Publish idempotent stopped callback");
	assert.match(callback.if, /idempotent-stop/);
	assert.match(callback.if, /steps\.zero-residue\.outcome == 'success'/);
	assert.match(callback.run, /--arg status stopped/);
	assert.doesNotMatch(callback.run, /performance-snapshot/);
});

test("expiry retains the exact stack after schema failure and reports honest cleanup_required state", async () => {
	const { steps } = await loadWorkflow();
	const deletion = stepByName(steps, "Delete exact stable project stack");
	assert.match(deletion.if, /expiry/);
	assert.match(deletion.if, /schema-cleanup\.outcome == 'success'/);
	const cleanup = stepByName(
		steps,
		"Publish cleanup_required without claiming cleanup success",
	);
	assert.match(cleanup.if, /steps\.schema-cleanup\.outcome != 'success'/);
	assert.match(cleanup.run, /cleanupVerified:false/);
	assert.match(cleanup.run, /zeroResidualVerified:false/);
});

test("before-database-access failures bypass secret and ECS cleanup but still prove zero residue", async () => {
	const { steps } = await loadWorkflow();
	const resolve = stepByName(steps, "Resolve fixed action and expiry");
	assert.match(resolve.run, /database_state=before-database-access/);
	assert.match(resolve.run, /CLEANUP_STATE_PARAMETER/);
	assert.match(resolve.run, /\.databaseState/);
	assert.match(resolve.run, /database_state=\$database_state/);

	const runningMarker = stepByName(
		steps,
		"Mark persistent cleanup state running",
	);
	assert.match(runningMarker.run, /databaseState/);
	assert.match(runningMarker.run, /before-database-access/);

	const databaseAccess = stepByName(
		steps,
		"Mark database lifecycle access started",
	);
	assert.equal(databaseAccess.if, "steps.resolve.outputs.action == 'start'");
	assert.match(databaseAccess.run, /schema-initialized/);
	assert.ok(
		steps.indexOf(databaseAccess) <
			steps.indexOf(
				stepByName(steps, "Initialize exact project database schema"),
			),
	);

	for (const name of [
		"Resolve ephemeral origin token from exact stack secret",
		"Run final-aggregate",
		"DROP SCHEMA using exact schema-cleanup task",
	]) {
		assert.match(
			stepByName(steps, name).if,
			/steps\.resolve\.outputs\.database_state == 'schema-initialized'/,
		);
	}

	const deletion = stepByName(steps, "Delete exact stable project stack");
	assert.match(deletion.if, /database_state == 'before-database-access'/);
	assert.match(deletion.if, /schema-cleanup\.outcome == 'success'/);
	const residue = stepByName(steps, "Verify zero project residue");
	assert.equal(
		residue.env.DATABASE_STATE,
		"${{ steps.resolve.outputs.database_state }}",
	);
	assert.match(residue.run, /databaseState/);

	const terminal = stepByName(
		steps,
		"Publish verified stopped before database access callback",
	);
	assert.match(terminal.if, /database_state == 'before-database-access'/);
	assert.match(terminal.if, /zero-residue\.outcome == 'success'/);
	assert.match(terminal.run, /--arg status stopped/);
	assert.doesNotMatch(terminal.run, /performance-snapshot/);
});

test("scheduled and manual recovery callbacks bind to the persisted expected predecessor", async () => {
	const { steps } = await loadWorkflow();
	const resolve = stepByName(steps, "Resolve fixed action and expiry");
	assert.match(resolve.run, /expected_workflow_run_id="\$GITHUB_RUN_ID"/);
	assert.match(resolve.run, /\.expectedWorkflowRunId/);
	assert.match(
		resolve.run,
		/action=expiry\s+expected_workflow_run_id="\$persisted_expected_workflow_run_id"/,
		"scheduled expiry must retain the workflow Run already bound by the start operation",
	);
	assert.match(
		resolve.run,
		/test "\$REQUESTED_OPERATION_ID" = "\$active_operation_id"/,
	);
	assert.match(
		resolve.run,
		/expected_workflow_run_id=\$expected_workflow_run_id/,
	);

	const runningMarker = stepByName(
		steps,
		"Mark persistent cleanup state running",
	);
	assert.match(runningMarker.run, /expectedWorkflowRunId/);
	assert.match(runningMarker.run, /GITHUB_RUN_ID/);

	const lineage = stepByName(steps, "Persist recovery callback lineage");
	assert.match(lineage.if, /action == 'stop'/);
	assert.match(lineage.if, /action == 'expiry'/);
	assert.match(lineage.if, /action == 'idempotent-stop'/);
	assert.match(lineage.run, /expectedWorkflowRunId/);
	assert.match(lineage.run, /EXPECTED_WORKFLOW_RUN_ID/);

	for (const name of [
		"Publish running callback",
		"Publish verified stopped snapshot callback",
		"Publish verified stopped before database access callback",
		"Publish idempotent stopped callback",
		"Publish cleanup_required without claiming cleanup success",
	]) {
		const callback = stepByName(steps, name);
		assert.equal(
			callback.env.WORKFLOW_RUN_ID,
			"${{ steps.resolve.outputs.expected_workflow_run_id }}",
			`${name} must use the persisted expected predecessor`,
		);
		assert.match(callback.run, /delivery_id="github-\$\{GITHUB_RUN_ID\}/);
	}
});

test("legacy lifecycle records migrate only after independently verified stack absence", async () => {
	const { steps } = await loadWorkflow();
	const resolve = stepByName(steps, "Resolve fixed action and expiry");
	assert.match(
		resolve.run,
		/jq -r '\.Parameter\.Value \| fromjson \| \.expectedWorkflowRunId \/\/ ""'/,
		"legacy active-operation records must be parsed without crashing",
	);
	assert.match(
		resolve.run,
		/jq -r '\.Parameter\.Value \| fromjson \| \.databaseState \/\/ ""'/,
		"legacy cleanup markers must be parsed without crashing",
	);
	const legacyActive = JSON.stringify({
		Parameter: {
			Value: JSON.stringify({
				schemaVersion: "1.0",
				operationId: "legacy-operation-1",
				generation: 1,
				expiresAt: "2026-08-31T20:00:00Z",
			}),
		},
	});
	for (const field of ["expectedWorkflowRunId", "databaseState"]) {
		const result = spawnSync(
			"jq",
			["-r", `.Parameter.Value | fromjson | .${field} // ""`],
			{ input: legacyActive, encoding: "utf8" },
		);
		assert.equal(result.status, 0, `${field} legacy parse must exit zero`);
		assert.equal(result.stdout.trim(), "");
	}
	assert.match(resolve.run, /legacy_cleanup_state/);
	assert.match(
		resolve.run,
		/test "\$stack_presence" = 3.*test "\$legacy_cleanup_state" = cleanup_verified/s,
		"database cleanup may be inferred only after stack absence and prior cleanup verification",
	);
	assert.match(resolve.run, /database_state=schema-cleanup-verified/);
	assert.match(
		resolve.run,
		/test -n "\$persisted_expected_workflow_run_id"/,
		"replaying a legacy operation without its bound predecessor must fail closed",
	);
	const markerRequired = stepByName(
		steps,
		"Mark persistent cleanup state required",
	);
	assert.equal(
		markerRequired.env.DATABASE_STATE,
		"${{ steps.resolve.outputs.database_state }}",
	);
	assert.match(
		markerRequired.run,
		/jq -r '\.databaseState \/\/ ""'/,
		"downgrading a legacy verified marker must not exit before recording cleanup_required",
	);
	assert.match(markerRequired.run, /database_state="\$DATABASE_STATE"/);
});

test("start derives safe required deployment identity without raw approval material", async () => {
	const { job, steps } = await loadWorkflow();
	assert.equal(job.env.RUN_ID, "${{ github.run_id }}");
	const token = stepByName(
		steps,
		"Generate ephemeral origin token for this stack lifecycle",
	);
	assert.deepEqual(token.env, {
		OPERATION_ID: "${{ steps.resolve.outputs.operation_id }}",
		GENERATION: "${{ steps.resolve.outputs.generation }}",
		CALLBACK_SOURCE: "${{ steps.resolve.outputs.source }}",
	});
	assert.match(token.run, /APPROVAL_REFERENCE_HASH=/);
	assert.match(token.run, /sha256sum/);
	assert.doesNotMatch(token.run, /approval_reference|APPROVAL_REFERENCE\b/);

	const deploy = stepByName(steps, "Deploy existing single performance stack");
	assert.match(deploy.run, /--parameter-overrides[^\n]*RunId="\$RUN_ID"/);
	assert.match(deploy.run, /ApprovalReferenceHash="\$APPROVAL_REFERENCE_HASH"/);
});

test("final cleaner evidence comes from the exact ECS task stream and validates honest counters", async () => {
	const { steps } = await loadWorkflow();
	const aggregate = stepByName(steps, "Run final-aggregate");
	assert.match(aggregate.run, /\/babysteps\/performance\/\$ENVIRONMENT_NAME/);
	assert.match(aggregate.run, /cleaner\/cleaner\/\$task_id/);
	assert.match(aggregate.run, /logs get-log-events/);
	assert.match(aggregate.run, /evidence\/cleaner-summary\.json/);
	assert.match(aggregate.run, /retryableFailures/);
	assert.match(
		aggregate.run,
		/processed.*inserted.*deduplicated.*discarded.*retryableFailures/s,
	);
});

test("AWS absence checks use the classified helper and never negate describe commands", async () => {
	const { source, steps } = await loadWorkflow();
	assert.match(source, /source scripts\/aws-performance-control-state\.sh/);
	for (const step of steps) {
		if (!step.run) continue;
		assert.doesNotMatch(step.run, /if\s+!\s+aws\s+/);
		assert.doesNotMatch(
			step.run,
			/if\s+aws\s+(?:cloudformation|ecr|sqs|lambda|secretsmanager|apigatewayv2)\s+(?:describe|get)/,
		);
	}
});

test("persistent cleanup marker gates lifecycle and idempotent stopped callbacks", async () => {
	const { job, steps } = await loadWorkflow();
	assert.equal(
		job.env.CLEANUP_STATE_PARAMETER,
		"/babysteps/performance-control/cleanup-state",
	);
	const running = stepByName(steps, "Mark persistent cleanup state running");
	assert.match(running.if, /action == 'start'/);
	assert.match(running.run, /ssm put-parameter/);
	assert.match(running.run, /"running"/);

	const required = stepByName(steps, "Mark persistent cleanup state required");
	assert.match(required.if, /^always\(\)/);
	assert.match(required.run, /cleanup_required/);
	assert.match(required.run, /schemaResidue/);

	const verified = stepByName(steps, "Mark persistent cleanup state verified");
	assert.match(verified.if, /schema-cleanup\.outcome == 'success'/);
	assert.match(verified.if, /zero-residue\.outcome == 'success'/);
	assert.match(verified.run, /cleanup_verified/);

	const marker = stepByName(
		steps,
		"Read persistent cleanup marker for idempotent stop",
	);
	assert.match(marker.if, /idempotent-stop/);
	assert.match(marker.run, /ssm get-parameter/);
	const stopped = stepByName(steps, "Publish idempotent stopped callback");
	assert.match(
		stopped.if,
		/steps\.cleanup-marker\.outputs\.state == 'cleanup_verified'/,
	);
	const cleanup = stepByName(
		steps,
		"Publish cleanup_required without claiming cleanup success",
	);
	assert.match(cleanup.if, /idempotent-stop/);
	assert.match(
		cleanup.if,
		/cleanup-marker\.outputs\.state != 'cleanup_verified'/,
	);
	assert.match(
		required.if,
		/idempotent-stop'.*zero-residue\.outcome != 'success'/,
	);
	assert.match(
		cleanup.if,
		/idempotent-stop'.*zero-residue\.outcome != 'success'/,
	);
});

test("zero residue checks orphaned API Gateway resources by fixed tags and fails closed", async () => {
	const { steps } = await loadWorkflow();
	const residue = stepByName(steps, "Verify zero project residue");
	assert.match(residue.run, /resourcegroupstaggingapi get-resources/);
	assert.match(residue.run, /Key=Project,Values=babysteps-performance/);
	assert.match(residue.run, /Key=Environment,Values=control/);
	assert.match(residue.run, /resource-type-filters apigateway:apis/);
	assert.match(residue.run, /test "\$orphan_api_count" = "0"/);
	assert.match(residue.run, /ecs list-tasks/);
	assert.match(residue.run, /ecs_task_count/);
	assert.match(residue.run, /ecs list-task-definitions/);
	assert.match(residue.run, /iam get-role/);
	assert.doesNotMatch(residue.run, /iam list-roles/);
	assert.match(residue.run, /babysteps-performance-execution-control/);
	assert.match(residue.run, /iam_role_count/);
	assert.match(residue.run, /remainingRunnableProjectResources/);
	assert.match(residue.run, /inventory/);
	assert.match(residue.run, /cloudWatchLogGroups/);
	for (const logGroup of [
		"/babysteps/performance/control",
		"/aws/lambda/babysteps-performance-ingest-control",
		"/aws/lambda/babysteps-performance-query-control",
	]) {
		assert.match(residue.run, new RegExp(logGroup.replaceAll("/", "\\/")));
	}
	const deletion = stepByName(steps, "Delete exact stable project stack");
	assert.match(deletion.run, /delete-task-definitions/);
	assert.doesNotMatch(residue.run, /\|\|\s*true/);
});
