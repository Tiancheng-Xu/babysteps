import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const workflowsDirectory = ".github/workflows";

const node24Actions = new Map([
	["actions/checkout", "v7"],
	["actions/setup-node", "v7"],
	["actions/upload-artifact", "v7"],
	["aws-actions/configure-aws-credentials", "v6"],
	["pnpm/action-setup", "v6"],
	["docker/setup-qemu-action", "v4"],
	["docker/setup-buildx-action", "v4"],
]);

test("JavaScript GitHub Actions use the repository's Node 24 compatible majors", async () => {
	const workflowNames = (await readdir(workflowsDirectory)).filter((name) =>
		/\.ya?ml$/u.test(name),
	);
	const workflows = await Promise.all(
		workflowNames.map(async (name) => ({
			name,
			source: await readFile(`${workflowsDirectory}/${name}`, "utf8"),
		})),
	);

	const stale = [];
	const observed = new Set();
	for (const { name, source } of workflows) {
		for (const match of source.matchAll(/uses:\s*([^\s#]+)@(v\d+)/gu)) {
			const [, action, major] = match;
			const expected = node24Actions.get(action);
			if (!expected) continue;
			observed.add(action);
			if (major !== expected) stale.push(`${name}: ${action}@${major} -> @${expected}`);
		}
	}

	assert.deepEqual(stale, []);
	assert.deepEqual(
		[...observed].sort(),
		[...node24Actions.keys()].sort(),
		"the contract must cover every Node 24 action family used by AWS workflows",
	);
});

test("performance Evidence stays historical while AWS remains in cost-sleep", async () => {
	const evidence = JSON.parse(
		await readFile("docs/evidence/performance-observability.json", "utf8"),
	);

	assert.equal(evidence.dataMode, "historical-verified-snapshot");
	assert.deepEqual(evidence.currentBoundary, {
		observedAt: "2026-09-21",
		mode: "cost-sleep",
		runtimeActive: false,
		activePerformanceResourceCount: 0,
		natGatewayCount: 0,
		sharedDatabase: "blocked-terminal-inaccessible-encryption-credentials",
		awsWritePolicy: "blocked-unless-separately-cost-approved",
	});
	assert.equal(evidence.latestVerifiedEvidence.runId, 33370197607);
	assert.equal(evidence.result.remainingProjectRuntimeResources, 0);
	assert.deepEqual(evidence.remainingTodos.zeroIncrementalCost, [
		"keep Node 24 GitHub Action contracts and historical Evidence current",
	]);
	assert.deepEqual(evidence.remainingTodos.blocked, [
		"do not restore or replace the terminal shared RDS instance",
		"do not dispatch an AWS performance start without separate cost approval",
	]);
});
