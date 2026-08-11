import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function runWorkerBuild(timeoutMs = 5_000) {
	return new Promise((resolve, reject) => {
		const child = spawn("pnpm", ["--filter", "@babysteps/worker", "build"], {
			cwd: repositoryRoot,
			detached: true,
			env: {
				...process.env,
				WRANGLER_SEND_METRICS: "false",
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		let output = "";
		const appendOutput = (chunk) => {
			output = `${output}${chunk}`.slice(-4_000);
		};
		child.stdout.on("data", appendOutput);
		child.stderr.on("data", appendOutput);

		const timeout = setTimeout(() => {
			process.kill(-child.pid, "SIGKILL");
			reject(new Error(`Worker build did not exit within ${timeoutMs}ms\n${output}`));
		}, timeoutMs);

		child.on("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.on("close", (code, signal) => {
			clearTimeout(timeout);
			resolve({ code, output, signal });
		});
	});
}

test("Worker production dry-run exits successfully", async () => {
	const result = await runWorkerBuild();
	assert.equal(result.signal, null, result.output);
	assert.equal(result.code, 0, result.output);
});
