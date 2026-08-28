import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

test("the AWS unit suite owns the executable performance event contract", async () => {
	const source = await readFile("aws/test/performancePipeline.test.ts", "utf8");

	assert.match(source, /parsePerformanceBatch/);
	assert.match(source, /accepts v1 and v2 whitelisted events/);
	assert.match(source, /schemaVersion:\s*1/);
	assert.match(source, /schemaVersion:\s*2/);
	assert.match(source, /https:\/\/private\.example\/a\?token=x/);
});

test("performance workflow is manual, OIDC-only, validated and self-cleaning", async () => {
	const source = await readFile(
		".github/workflows/aws-performance.yml",
		"utf8",
	);
	const workflow = parse(source);
	assert.ok(workflow);
	for (const job of Object.values(workflow.jobs)) {
		for (const step of job.steps ?? []) {
			assert.doesNotMatch(
				step.run ?? "",
				/\$\{\{\s*inputs\./,
				`${step.name ?? "unnamed step"} interpolates an untrusted input into shell`,
			);
		}
	}
	assert.match(source, /APPROVAL_REFERENCE:\s*\$\{\{ inputs\.approval_reference \}\}/);
	assert.match(source, /workflow_dispatch:/);
	assert.match(source, /environment: aws-performance/);
	assert.match(source, /id-token: write/);
	assert.match(source, /docker\/setup-qemu-action@v3/);
	assert.match(source, /platforms: arm64/);
	assert.match(source, /docker\/setup-buildx-action@v3/);
	assert.match(source, /timeout-minutes:\s*50/);
	assert.match(source, /delete-stack/);
	assert.match(source, /concurrency:/);
	assert.match(source, /github\.run_id/);
	assert.match(source, /schema-cleanup/);
	assert.match(source, /schemaDeleted.*true/s);
	assert.match(source, /ecs list-tasks/);
	assert.match(source, /ecsTasks/);
	assert.match(source, /cleanup-incomplete\.json/);
	assert.match(source, /data-retention verification/);
	assert.match(source, /DatabaseAdminTaskDefinitionArn/);
	assert.match(source, /id: deploy/);
	assert.match(source, /steps\.schema-cleanup\.outcome == 'success'/);
	assert.match(source, /steps\.database-init\.outputs\.task == ''/);
	assert.match(source, /steps\.database-init\.outputs\.task != ''/);
	assert.match(source, /describe-stacks --stack-name "\$STACK_NAME"/);
	assert.match(source, /Start temporary Worker proxy/);
	assert.match(source, /wrangler dev --local/);
	assert.match(source, /run-performance-browser-journey\.mjs/);
	assert.match(source, /playwright install --with-deps chromium/);
	assert.match(source, /APP_URI=http:\/\/127\.0\.0\.1:/);
	assert.match(source, /Browser journey/);
	assert.match(source, /PERFORMANCE_ORIGIN_TOKEN/);
	assert.match(source, /approvalReferenceSha256/);
	assert.match(source, /logs get-log-events/);
	assert.match(source, /cleaner\/cleaner\/\$task_id/);
	assert.match(source, /evidence\/cleaner-summary\.json/);
	assert.match(source, /retryableFailures/);
	assert.doesNotMatch(source, /event\.json/);
	assert.doesNotMatch(source, /value:\s*321|p50\s*!==\s*321/);
	for (const inventory of [
		"cloudformation",
		"ecr",
		"ecs",
		"task-definition",
		"sqs",
		"apigatewayv2",
		"lambda",
		"logs",
		"secretsmanager",
		"security-groups",
		"iam",
	]) {
		assert.match(source, new RegExp(inventory));
	}
	assert.match(source, /shared.*(?:explicit deny|protected)/is);
	assert.match(source, /remainingProjectResources/);
	assert.match(source, /test "\$remaining" = "0"/);
	assert.doesNotMatch(
		source,
		/curl[^\n]*x-babysteps-origin-token[^\n]*\$api\/events/,
	);
	assert.doesNotMatch(source, /evidence\/worker-proxy\.log/);
	assert.doesNotMatch(source, /^\s*(?:push|schedule):/m);
	assert.doesNotMatch(source, /AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/);
});

test("the AWS workspace owns the cleaner bundler required by a clean CI install", async () => {
	const packageJson = JSON.parse(await readFile("aws/package.json", "utf8"));
	assert.equal(packageJson.devDependencies.esbuild, "0.28.1");
	assert.match(packageJson.scripts["build:performance:cleaner"], /^esbuild /);
});

test("the Chromium journey emits only a bounded sanitized summary", async () => {
	const { journeyRoutes, sanitizeJourneyFailure, sanitizeJourneySummary } = await import(
		"./run-performance-browser-journey.mjs"
	);
	assert.deepEqual(
		journeyRoutes.map(({ path, heading }) => [path, heading]),
		[
			["/", "BabySteps · 成长星球"],
			["/tasks", "成长任务市集"],
			["/profile", "个人中心"],
			["/performance", "BabySteps 性能观测站"],
			["/evidence", "链上工作证据"],
		],
	);
	const journeySource = await readFile(
		"scripts/run-performance-browser-journey.mjs",
		"utf8",
	);
	assert.match(journeySource, /getByRole\("heading"/);
	assert.match(journeySource, /marketplace-task-card, \.empty-state/);
	const summary = sanitizeJourneySummary({
		routes: ["/", "/tasks", "/profile", "/performance", "/evidence"],
		coverage: ["LCP", "navigation.dns", "navigation.tls"],
		batchCount: 2,
		eventCount: 14,
		privateUrl: "https://private.example/a?token=redacted-fixture",
		cookie: "session=redacted-fixture",
		body: { authorization: "redacted-fixture" },
	});
	assert.deepEqual(summary, {
		routes: ["/", "/tasks", "/profile", "/performance", "/evidence"],
		coverage: {
			observed: ["LCP"],
			unavailable: ["navigation.dns", "navigation.tls"],
		},
		batchCount: 2,
		eventCount: 14,
	});
	assert.doesNotMatch(
		JSON.stringify(summary),
		/secret|private\.example|cookie|authorization/i,
	);
	assert.equal(
		sanitizeJourneyFailure(
			new Error(
				"Timeout at https://private.example/profile?token=redacted-fixture",
			),
			"/profile",
		),
		"ROUTE_TIMEOUT_PROFILE",
	);
	assert.equal(
		sanitizeJourneyFailure(new Error("socket closed"), "/performance"),
		"ROUTE_FAILED_PERFORMANCE",
	);
	assert.doesNotMatch(
		sanitizeJourneyFailure(
			new Error("secret=https://private.example/?token=redacted-fixture"),
			"/evidence",
		),
		/secret|private\.example|token/i,
	);
});

test("the real browser run boots production config and preserves visual Evidence", async () => {
	const source = await readFile(
		".github/workflows/aws-performance.yml",
		"utf8",
	);
	const workflow = parse(source);
	const steps = workflow.jobs["prove-and-clean"].steps;
	const byName = (name) => steps.find((step) => step.name === name);

	assert.match(
		byName("Start local Web at the exact Worker APP_URI origin").run,
		/--mode production/,
	);
	assert.match(
		byName("Browser journey through real Chromium").run,
		/--artifacts-dir evidence\/browser/,
	);
	assert.match(
		byName("Capture live performance dashboard Evidence").run,
		/--dashboard-only/,
	);
	assert.match(
		byName("Capture live performance dashboard Evidence").run,
		/--version "\$\{GITHUB_SHA:0:12\}"/,
	);
	assert.match(
		byName("Query and verify real browser aggregates").run,
		/environment=production/,
	);
	assert.doesNotMatch(
		byName("Query and verify real browser aggregates").run,
		/environment=development/,
	);
	assert.match(
		byName("Capture real control-plane snapshot before cleanup").run,
		/OutputKey=='ApiEndpoint'/,
	);
	assert.doesNotMatch(
		byName("Capture real control-plane snapshot before cleanup").run,
		/cloudformation describe-stack-resource/,
	);
	const upload = steps.find(
		(step) => step.uses === "actions/upload-artifact@v4",
	);
	assert.equal(upload.with.path, "evidence/");
	assert.equal(upload.with["if-no-files-found"], "error");
});

test("ephemeral Evidence lifecycle permissions stay inside the run prefix", async () => {
	const policy = JSON.parse(
		await readFile(
			"aws/iam/performance-evidence-lifecycle-policy.json",
			"utf8",
		),
	);
	const list = policy.Statement.find((statement) =>
		(Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes(
			"ecs:ListTasks",
		),
	);
	assert.equal(list.Effect, "Allow");
	assert.equal(list.Resource, "*");
	assert.equal(
		list.Condition.StringEquals["aws:RequestedRegion"],
		"us-east-1",
	);
	assert.equal(
		list.Condition.ArnLike["ecs:cluster"],
		"arn:aws:ecs:us-east-1:782086108248:cluster/babysteps-performance-e*",
	);

	const remove = policy.Statement.find((statement) =>
		(Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes(
			"ecs:DeleteTaskDefinitions",
		),
	);
	assert.equal(remove.Effect, "Allow");
	assert.deepEqual(remove.Resource, [
		"arn:aws:ecs:us-east-1:782086108248:task-definition/babysteps-performance-cleaner-e*:*",
		"arn:aws:ecs:us-east-1:782086108248:task-definition/babysteps-performance-db-admin-e*:*",
	]);
	assert.equal(
		remove.Condition.StringEquals["aws:RequestedRegion"],
		"us-east-1",
	);
	assert.deepEqual(
		new Set(
			policy.Statement.flatMap((statement) =>
				Array.isArray(statement.Action) ? statement.Action : [statement.Action],
			),
		),
		new Set(["ecs:DeleteTaskDefinitions", "ecs:ListTasks"]),
	);
});

test("the production cleaner bundle boots under Node without an ESM dynamic-require crash", async () => {
	const packageJson = JSON.parse(await readFile("aws/package.json", "utf8"));
	const buildScript = packageJson.scripts["build:performance:cleaner"];
	const output = buildScript.match(/--outfile=([^\s]+)/)?.[1];
	assert.ok(output, "cleaner build must declare an output file");

	execFileSync(
		"pnpm",
		["--filter", "@babysteps/aws", "build:performance:cleaner"],
		{
			stdio: "pipe",
		},
	);
	const boot = spawnSync(process.execPath, [`aws/${output}`], {
		encoding: "utf8",
		env: { PATH: process.env.PATH, PERFORMANCE_RUN_ID: "123" },
	});

	assert.doesNotMatch(
		boot.stderr,
		/Dynamic require of "node:https" is not supported/,
	);
	assert.match(boot.stderr, /MISSING_QUEUE_URL/);
});

test("a manual OIDC recovery gate can remove only an exact failed performance stack", async () => {
	const recovery = await readFile(
		".github/workflows/aws-performance-recovery.yml",
		"utf8",
	).catch(() => "");
	const workflow = parse(recovery);
	assert.ok(workflow);
	const steps = workflow.jobs["recover-exact-stack"].steps;
	for (const step of steps) {
		assert.doesNotMatch(
			step.run ?? "",
			/\$\{\{\s*inputs\./,
			`${step.name ?? "unnamed step"} interpolates an untrusted input into shell`,
		);
	}
	const stepByName = (name) => steps.find((step) => step.name === name);
	const validation = stepByName(
		"Validate exact recovery target and capture sanitized state",
	);
	assert.equal(validation.id, "validate-target");
	assert.match(validation.run, /Project/);
	assert.match(validation.run, /RunId/);
	assert.match(validation.run, /test "\$project" = "babysteps-performance"/);
	assert.match(validation.run, /test "\$tagged_run_id" = "\$run_id"/);
	assert.match(validation.run, /validated=true.*GITHUB_OUTPUT/s);
	assert.match(validation.run, /stack_state=.*GITHUB_OUTPUT/s);

	assert.match(stepByName("Drop and verify exact run-scoped schema").if, /^always\(\)/);
	assert.match(
		stepByName("Drop and verify exact run-scoped schema").if,
		/steps\.validate-target\.outcome == 'success'/,
	);
	assert.match(
		stepByName("Drop and verify exact run-scoped schema").if,
		/steps\.validate-target\.outputs\.stack_state == 'present'/,
	);
	assert.match(stepByName("Delete exact failed project stack").if, /schema-cleanup\.outcome == 'success'/);
	assert.match(stepByName("Delete exact failed project stack").if, /database_state != 'schema-initialized'/);
	assert.match(
		stepByName("Delete exact failed project stack").if,
		/steps\.validate-target\.outcome == 'success'/,
	);
	assert.match(
		stepByName("Delete exact failed project stack").if,
		/steps\.validate-target\.outputs\.stack_state == 'present'/,
	);
	const orphanedTaskDefinitions = stepByName(
		"Delete exact orphaned task definitions",
	);
	assert.equal(orphanedTaskDefinitions.id, "delete-task-definitions");
	assert.match(
		orphanedTaskDefinitions.if,
		/steps\.validate-target\.outcome == 'success'/,
	);
	assert.match(
		orphanedTaskDefinitions.if,
		/steps\.validate-target\.outputs\.validated == 'true'/,
	);
	assert.match(
		orphanedTaskDefinitions.if,
		/outputs\.stack_state == 'absent'/,
	);
	assert.match(
		orphanedTaskDefinitions.if,
		/steps\.delete-stack\.outcome == 'success'/,
	);
	assert.match(
		orphanedTaskDefinitions.run,
		/babysteps-performance-cleaner-\$ENVIRONMENT_NAME/,
	);
	assert.match(
		orphanedTaskDefinitions.run,
		/babysteps-performance-db-admin-\$ENVIRONMENT_NAME/,
	);
	assert.match(orphanedTaskDefinitions.run, /test "\$actual_family" = "\$family"/);
	const inventory = stepByName("Verify exact prefix and tag inventory is zero");
	assert.match(
		inventory.if,
		/steps\.validate-target\.outcome == 'success'/,
	);
	assert.match(
		inventory.if,
		/outputs\.stack_state == 'absent'/,
	);
	assert.match(
		inventory.if,
		/steps\.delete-task-definitions\.outcome == 'success'/,
	);
	assert.equal(
		inventory.run.match(
			/ecs_task_remaining=\$\(\(ecs_task_remaining \+ count\)\)/g,
		)?.length,
		1,
		"each ECS task count must be accumulated exactly once",
	);

	const awsWritePattern =
		/aws (?:ecs run-task|cloudformation delete-stack|ecs delete-task-definitions)\b/;
	const writeSteps = steps.filter((step) => awsWritePattern.test(step.run ?? ""));
	assert.ok(writeSteps.length >= 2);
	for (const step of writeSteps) {
		assert.match(
			step.if ?? "",
			/steps\.validate-target\.outcome == 'success'/,
			`${step.name} can write AWS state after target validation failed`,
		);
		assert.match(
			step.if ?? "",
			/steps\.validate-target\.outputs\.validated == 'true'/,
			`${step.name} can write AWS state without the validated target output`,
		);
		if (/aws (?:ecs run-task|cloudformation delete-stack)\b/.test(step.run ?? "")) {
			assert.match(
				step.if ?? "",
				/steps\.validate-target\.outputs\.stack_state == 'present'/,
				`${step.name} can write stack-owned AWS state for an absent stack`,
			);
		}
	}
	assert.doesNotMatch(validation.run, awsWritePattern);
	assert.match(recovery, /APPROVAL_REFERENCE:\s*\$\{\{ inputs\.approval_reference \}\}/);
	assert.match(recovery, /ecs list-tasks/);
	assert.match(recovery, /workflow_dispatch:/);
	assert.match(recovery, /environment: aws-performance/);
	assert.match(recovery, /id-token: write/);
	assert.match(recovery, /\^babysteps-performance-\[0-9\]\+\$/);
	assert.match(recovery, /if aws cloudformation describe-stacks/);
	assert.match(recovery, /delete-stack --stack-name "\$STACK_NAME"/);
	assert.match(recovery, /stack-delete-complete/);
	assert.match(recovery, /sqs get-queue-url --queue-name/);
	assert.match(recovery, /lambda list-functions/);
	assert.match(recovery, /apigatewayv2 get-apis/);
	assert.match(recovery, /secretsmanager list-secrets/);
	assert.match(recovery, /logs describe-log-groups/);
	assert.match(recovery, /ec2 describe-security-groups/);
	assert.match(recovery, /iam list-roles/);
	assert.match(recovery, /ecs describe-task-definition --task-definition/);
	assert.match(recovery, /cloudFormationStackAbsent.*true/);
	assert.match(recovery, /remainingProjectResources/);
	assert.match(recovery, /test "\$remaining" = "0"/);
	assert.match(recovery, /shared.*(?:explicit deny|protected)/is);
	assert.match(recovery, /cleanup_required/);
	for (const logGroup of [
		"/babysteps/performance/$ENVIRONMENT_NAME",
		"/aws/lambda/babysteps-performance-ingest-$ENVIRONMENT_NAME",
		"/aws/lambda/babysteps-performance-query-$ENVIRONMENT_NAME",
	]) {
		assert.ok(recovery.includes(logGroup), `recovery inventory is missing ${logGroup}`);
	}
	assert.doesNotMatch(recovery, /AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/);
});

test("every SAM deploy supplies the required run and approval hash parameters", async () => {
	for (const workflowPath of [
		".github/workflows/aws-performance.yml",
		".github/workflows/aws-performance-control.yml",
	]) {
		const workflow = parse(await readFile(workflowPath, "utf8"));
		const deploys = Object.values(workflow.jobs).flatMap((job) =>
			(job.steps ?? []).filter((step) => /\bsam deploy\b/.test(step.run ?? "")),
		);
		assert.ok(deploys.length > 0, `${workflowPath} must deploy through SAM`);
		for (const deploy of deploys) {
			assert.match(deploy.run, /RunId="\$RUN_ID"/);
			assert.match(deploy.run, /ApprovalReferenceHash="\$APPROVAL_REFERENCE_HASH"/);
		}
	}
});

test("a scheduled TTL janitor dispatches the existing exact recovery deep module", async () => {
	const source = await readFile(
		".github/workflows/aws-performance-recovery.yml",
		"utf8",
	);
	const workflow = parse(source);
	assert.match(JSON.stringify(workflow.on.schedule), /\*\/15 \* \* \* \*/);
	const janitor = workflow.jobs["dispatch-expired-recovery"];
	assert.equal(janitor.if, "github.event_name == 'schedule'");
	assert.equal(janitor.permissions.actions, "write");
	assert.equal(janitor.permissions["id-token"], "write");
	const run = janitor.steps.find((step) => step.name === "Dispatch one exact expired recovery").run;
	assert.match(run, /gh run list/);
	assert.match(run, /databaseId/);
	assert.match(run, /--arg current "\$GITHUB_RUN_ID"/);
	assert.match(run, /databaseId\s*\|\s*tostring/);
	assert.match(run, /babysteps-performance-\[0-9\]\+/);
	assert.match(run, /Project/);
	assert.match(run, /RunId/);
	assert.match(run, /ExpiresAt/);
	assert.match(run, /aws-performance-recovery\.yml/);
	assert.match(run, /database_state=schema-initialized/);
	assert.doesNotMatch(run, /cloudformation (?:delete-stack|update-stack|create-stack)/);
	assert.doesNotMatch(run, /ecs run-task/);
});
test("the browser journey installs Chromium with runner dependencies", async () => {
  const { readFile } = await import("node:fs/promises");
  const workflow = await readFile(
    new URL("../.github/workflows/aws-performance.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /pnpm exec playwright install --with-deps chromium/);
  assert.doesNotMatch(workflow, /pnpm exec playwright install chromium/);
});
