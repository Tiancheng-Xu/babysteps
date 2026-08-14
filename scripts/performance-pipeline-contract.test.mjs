import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

test("performance workflow is manual, OIDC-only, validated and self-cleaning", async () => {
	const source = await readFile(
		".github/workflows/aws-performance.yml",
		"utf8",
	);
	assert.doesNotThrow(() => parse(source));
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
	assert.match(source, /eventIds/);
	assert.match(source, /Initialize exact project database schema/);
	assert.match(source, /DatabaseAdminTaskDefinitionArn/);
	assert.match(source, /id: deploy/);
	assert.match(source, /steps\.schema-cleanup\.outcome == 'success'/);
	assert.match(source, /steps\.database-init\.outputs\.task == ''/);
	assert.match(source, /steps\.database-init\.outputs\.task != ''/);
	assert.match(source, /describe-stacks --stack-name "\$STACK_NAME"/);
	assert.match(source, /Start temporary Worker proxy/);
	assert.match(source, /wrangler dev --local/);
	assert.match(source, /PERFORMANCE_ORIGIN_TOKEN/);
	assert.match(source, /approvalReferenceSha256/);
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

test("the production cleaner bundle boots under Node without an ESM dynamic-require crash", async () => {
	const packageJson = JSON.parse(await readFile("aws/package.json", "utf8"));
	const buildScript = packageJson.scripts["build:performance:cleaner"];
	const output = buildScript.match(/--outfile=([^\s]+)/)?.[1];
	assert.ok(output, "cleaner build must declare an output file");

	execFileSync("pnpm", ["--filter", "@babysteps/aws", "build:performance:cleaner"], {
		stdio: "pipe",
	});
	const boot = spawnSync(process.execPath, [`aws/${output}`], {
		encoding: "utf8",
		env: { PATH: process.env.PATH },
	});

	assert.doesNotMatch(boot.stderr, /Dynamic require of "node:https" is not supported/);
	assert.match(boot.stderr, /MISSING_QUEUE_URL/);
});

test("a manual OIDC recovery gate can remove only an exact failed performance stack", async () => {
	const recovery = await readFile(
		".github/workflows/aws-performance-recovery.yml",
		"utf8",
	).catch(() => "");
	assert.doesNotThrow(() => parse(recovery));
	assert.match(recovery, /workflow_dispatch:/);
	assert.match(recovery, /environment: aws-performance/);
	assert.match(recovery, /id-token: write/);
	assert.match(recovery, /\^babysteps-performance-\[0-9\]\+\$/);
	assert.match(recovery, /if aws cloudformation describe-stacks/);
	assert.match(recovery, /delete-stack --stack-name "\$STACK_NAME"/);
	assert.match(recovery, /stack-delete-complete/);
	assert.match(recovery, /sqs get-queue-url --queue-name/);
	assert.doesNotMatch(recovery, /sqs list-queues/);
	assert.doesNotMatch(recovery, /lambda list-functions/);
	assert.doesNotMatch(recovery, /apigatewayv2 get-apis/);
	assert.doesNotMatch(recovery, /secretsmanager list-secrets/);
	assert.doesNotMatch(recovery, /logs describe-log-groups/);
	assert.match(recovery, /ecs describe-task-definition --task-definition/);
	assert.match(recovery, /cloudFormationStackAbsent.*true/);
	assert.match(recovery, /remainingRunnableProjectResources.*0/);
	assert.doesNotMatch(recovery, /AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/);
});
