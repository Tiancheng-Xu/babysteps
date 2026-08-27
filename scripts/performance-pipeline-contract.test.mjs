import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

test("the performance event contract accepts bounded v1 and v2 names only", () => {
	const script = `
		import { parsePerformanceBatch } from "./src/performance/pipeline.ts";
		const event = (type, name, unit, extra = {}) => ({
			eventId: "00000000-0000-4000-8000-000000000001", timestamp: 1,
			type, name, value: 1, unit, route: "/", environment: "test", version: "test", ...extra,
		});
		parsePerformanceBatch({ schemaVersion: 1, events: [event("web3", "contract.write", "ms")] });
		parsePerformanceBatch({ schemaVersion: 2, events: [event("resource", "resource.image.duration", "ms", { category: "image" })] });
		let rejected = false;
		try { parsePerformanceBatch({ schemaVersion: 2, events: [event("resource", "https://private.example/a?token=x", "ms")] }); } catch { rejected = true; }
		if (!rejected) process.exit(1);
	`;
	const result = spawnSync(
		"pnpm",
		["--filter", "@babysteps/aws", "exec", "tsx", "-e", script],
		{
			cwd: process.cwd(),
			encoding: "utf8",
		},
	);
	assert.equal(result.status, 0, result.stderr);
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
	const { journeyRoutes, sanitizeJourneySummary } = await import(
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
	assert.match(stepByName("Drop and verify exact run-scoped schema").if, /^always\(\)/);
	assert.match(stepByName("Delete exact failed project stack").if, /^always\(\)/);
	assert.match(stepByName("Verify exact prefix and tag inventory is zero").if, /^always\(\)/);
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
	assert.doesNotMatch(recovery, /AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/);
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
