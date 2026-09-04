import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const HELPER = "scripts/aws-performance-control-state.sh";

function runBash(body) {
	return spawnSync("bash", ["-c", `source ${HELPER}\n${body}`], {
		cwd: process.cwd(),
		encoding: "utf8",
	});
}

test("explicit CloudFormation does-not-exist is the only stack absence result", async () => {
	const helper = await readFile(HELPER, "utf8").catch(() => "");
	assert.notEqual(helper, "", `${HELPER} must exist`);
	const result = runBash(`
attempts=0
fake_aws() { attempts=$((attempts + 1)); echo 'ValidationError: Stack with id fixed does not exist' >&2; return 255; }
set +e
aws_classify_to_file /tmp/control-state-test.out cloudformation-stack fake_aws
status=$?
set -e
printf 'status=%s attempts=%s\n' "$status" "$attempts"
`);
	assert.equal(result.status, 0);
	assert.match(result.stdout, /status=3 attempts=1/);
});

test("AccessDenied is retried and fails closed instead of becoming absent", () => {
	const result = runBash(`
attempt_file="$(mktemp)"; printf '0' > "$attempt_file"
fake_aws() { n="$(cat "$attempt_file")"; n=$((n + 1)); printf '%s' "$n" > "$attempt_file"; echo 'AccessDeniedException: denied' >&2; return 254; }
set +e
AWS_CLASSIFY_RETRY_DELAY_SECONDS=0 aws_classify_to_file /tmp/control-state-test.out secret fake_aws
status=$?
set -e
printf 'status=%s attempts=%s\n' "$status" "$(cat "$attempt_file")"
`);
	assert.equal(result.status, 0);
	assert.match(result.stdout, /status=1 attempts=3/);
	assert.match(result.stderr, /AccessDeniedException/);
});

test("throttle and unknown network errors never classify as absent", () => {
	for (const message of [
		"ThrottlingException: rate exceeded",
		"Could not connect to the endpoint URL",
	]) {
		const result = runBash(`
attempt_file="$(mktemp)"; printf '0' > "$attempt_file"
fake_aws() { n="$(cat "$attempt_file")"; n=$((n + 1)); printf '%s' "$n" > "$attempt_file"; echo '${message}' >&2; return 255; }
set +e
AWS_CLASSIFY_RETRY_DELAY_SECONDS=0 aws_classify_to_file /tmp/control-state-test.out ssm-parameter fake_aws
status=$?
set -e
printf 'status=%s attempts=%s\n' "$status" "$(cat "$attempt_file")"
`);
		assert.equal(result.status, 0);
		assert.match(result.stdout, /status=1 attempts=3/);
		assert.match(result.stderr, new RegExp(message));
	}
});

test("Lambda absence uses regional inventory and exact name filtering", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "lambda-inventory-"));
	const awsPath = path.join(directory, "aws");
	const argvPath = path.join(directory, "aws-argv.txt");
	const outputPath = path.join(directory, "lambda-result.json");
	await writeFile(
		awsPath,
		"#!/usr/bin/env bash\nprintf '%s\\n' \"$*\" > \"$FAKE_AWS_ARGV\"\nprintf '%s\\n' '{\"Functions\":[]}'\n",
	);
	await chmod(awsPath, 0o755);

	const result = spawnSync(
		"bash",
		[
			"-c",
			`source ${HELPER}\naws_assert_exact_lambda_absent babysteps-performance-query-control \"$LAMBDA_RESULT\"`,
		],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				PATH: directory + ":" + process.env.PATH,
				AWS_REGION: "us-east-1",
				FAKE_AWS_ARGV: argvPath,
				LAMBDA_RESULT: outputPath,
			},
		},
	);

	try {
		assert.equal(result.status, 0, result.stderr);
		assert.equal(await readFile(outputPath, "utf8"), "[]\n");
		const argv = await readFile(argvPath, "utf8");
		assert.match(argv, /^lambda list-functions /);
		assert.doesNotMatch(argv, /get-function/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("Lambda inventory fails closed when the exact function is present", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "lambda-inventory-"));
	const awsPath = path.join(directory, "aws");
	const outputPath = path.join(directory, "lambda-result.json");
	await writeFile(
		awsPath,
		"#!/usr/bin/env bash\nprintf '%s\\n' '{\"Functions\":[{\"FunctionName\":\"babysteps-performance-query-control\"},{\"FunctionName\":\"unrelated\"}]}'\n",
	);
	await chmod(awsPath, 0o755);

	const result = spawnSync(
		"bash",
		[
			"-c",
			`source ${HELPER}\naws_assert_exact_lambda_absent babysteps-performance-query-control \"$LAMBDA_RESULT\"`,
		],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				PATH: directory + ":" + process.env.PATH,
				AWS_REGION: "us-east-1",
				LAMBDA_RESULT: outputPath,
			},
		},
	);

	try {
		assert.equal(result.status, 1);
		assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), [
			{ FunctionName: "babysteps-performance-query-control" },
		]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("callback retries preserve body, delivery, timestamp, and signature bytes", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "performance-callback-"));
	const curlPath = path.join(directory, "curl");
	const sleepPath = path.join(directory, "sleep");
	const logPath = path.join(directory, "curl-argv.bin");
	await writeFile(
		curlPath,
		"#!/usr/bin/env bash\nprintf '%s\\0' \"$@\" >> \"$FAKE_CURL_LOG\"\nprintf '\\036' >> \"$FAKE_CURL_LOG\"\nexit 22\n",
	);
	await writeFile(sleepPath, "#!/usr/bin/env bash\nexit 0\n");
	await Promise.all([chmod(curlPath, 0o755), chmod(sleepPath, 0o755)]);

	const body =
		'{"schemaVersion":"1.0","deliveryId":"delivery-retry-1","source":"control","operationId":"operation-retry-1","generation":3,"workflowRunId":"987654321","status":"running","occurredAt":"2026-08-26T13:00:00.000Z","cleanupVerified":false,"zeroResidualVerified":false}';
	const secret = "retry-fixture-secret";
	const result = spawnSync(
		"bash",
		[
			"-c",
			"source " +
				HELPER +
				'\nperformance_post_callback "$CALLBACK_URL" "$CALLBACK_SECRET" "$CALLBACK_BODY"',
		],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				PATH: directory + ":" + process.env.PATH,
				FAKE_CURL_LOG: logPath,
				CALLBACK_URL: "https://callback.invalid/fixed",
				CALLBACK_SECRET: secret,
				CALLBACK_BODY: body,
			},
		},
	);

	try {
		assert.equal(result.status, 1);
		const bytes = await readFile(logPath);
		const attempts = [];
		let start = 0;
		for (let index = 0; index < bytes.length; index += 1) {
			if (bytes[index] !== 0x1e) continue;
			attempts.push(
				bytes
					.subarray(start, index)
					.toString("utf8")
					.split("\0")
					.filter(Boolean),
			);
			start = index + 1;
		}
		assert.equal(attempts.length, 3);
		assert.deepEqual(attempts[1], attempts[0]);
		assert.deepEqual(attempts[2], attempts[0]);

		const args = attempts[0];
		const headers = args
			.map((value, index) => (value === "-H" ? args[index + 1] : undefined))
			.filter(Boolean);
		const dataIndex = args.indexOf("--data-binary");
		assert.notEqual(dataIndex, -1);
		assert.equal(args[dataIndex + 1], body);
		assert.ok(headers.includes("x-performance-delivery-id: delivery-retry-1"));
		const timestamp = headers
			.find((header) => header.startsWith("x-performance-timestamp: "))
			?.slice("x-performance-timestamp: ".length);
		assert.match(timestamp ?? "", /^\d+$/);
		const expectedSignature = createHmac("sha256", secret)
			.update(timestamp + "." + body)
			.digest("hex");
		assert.ok(
			headers.includes(
				"x-performance-signature-256: sha256=" + expectedSignature,
			),
		);
		assert.equal(
			JSON.parse(body).deliveryId,
			headers
				.find((header) =>
					header.startsWith("x-performance-delivery-id: "),
				)
				?.slice("x-performance-delivery-id: ".length),
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
