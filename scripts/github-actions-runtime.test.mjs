import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

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

function findStaleActions(workflows) {
	const stale = [];
	const observed = new Set();
	for (const { name, source } of workflows) {
		const jobs = parse(source)?.jobs ?? {};
		for (const job of Object.values(jobs)) {
			const steps = Array.isArray(job?.steps) ? job.steps : [];
			for (const step of steps) {
				if (typeof step?.uses !== "string") continue;
				const separator = step.uses.lastIndexOf("@");
				if (separator <= 0) continue;
				const action = step.uses.slice(0, separator);
				const reference = step.uses.slice(separator + 1);
				const expected = node24Actions.get(action);
				if (!expected) continue;
				observed.add(action);
				if (reference !== expected) {
					stale.push(`${name}: ${action}@${reference} -> @${expected}`);
				}
			}
		}
	}
	return { stale, observed };
}

test("runtime contract rejects quoted stale majors and unverified SHA pins", () => {
	const { stale, observed } = findStaleActions([
		{
			name: "fixture.yml",
			source: `jobs:
  verify:
    steps:
      - uses: "actions/checkout@v4"
      - uses: actions/setup-node@0123456789abcdef0123456789abcdef01234567
      - uses: ./local-composite-action
      - uses: docker://alpine:3.20
`,
		},
	]);

	assert.deepEqual(stale, [
		"fixture.yml: actions/checkout@v4 -> @v7",
		"fixture.yml: actions/setup-node@0123456789abcdef0123456789abcdef01234567 -> @v7",
	]);
	assert.deepEqual([...observed].sort(), [
		"actions/checkout",
		"actions/setup-node",
	]);
});

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

	const { stale, observed } = findStaleActions(workflows);

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
	assert.equal(evidence.workflow, undefined);
	assert.equal(evidence.result, undefined);
	assert.equal(
		evidence.baselineEvidence.role,
		"first-controlled-closed-loop-proof",
	);
	assert.equal(evidence.baselineEvidence.workflow.runId, 31765573258);
	assert.equal(
		evidence.baselineEvidence.result.remainingProjectRuntimeResources,
		0,
	);
	assert.deepEqual(evidence.remainingTodos.zeroIncrementalCost, [
		"keep Node 24 GitHub Action contracts and historical Evidence current",
	]);
	assert.deepEqual(evidence.remainingTodos.blocked, [
		"do not restore or replace the terminal shared RDS instance",
		"do not dispatch an AWS performance start without separate cost approval",
	]);
});
