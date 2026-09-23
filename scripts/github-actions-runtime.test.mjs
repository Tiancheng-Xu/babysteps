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

const approvedReusableWorkflows = new Set([
	"Tiancheng-Xu/.github/.github/workflows/verify-project.yml@main",
	"Tiancheng-Xu/.github/.github/workflows/verify-repository-policy.yml@main",
]);

function isLocalOrDockerAction(uses) {
	return uses.startsWith("./") || uses.startsWith("docker://");
}

function findStaleActions(workflows) {
	const stale = [];
	const observed = new Set();
	for (const { name, source } of workflows) {
		const jobs = parse(source)?.jobs ?? {};
		for (const job of Object.values(jobs)) {
			if (
				typeof job?.uses === "string" &&
				!approvedReusableWorkflows.has(job.uses)
			) {
				stale.push(`${name}: unapproved reusable workflow ${job.uses}`);
			}
			const steps = Array.isArray(job?.steps) ? job.steps : [];
			for (const step of steps) {
				if (typeof step?.uses !== "string") continue;
				if (isLocalOrDockerAction(step.uses)) continue;
				const separator = step.uses.lastIndexOf("@");
				if (separator <= 0) {
					stale.push(`${name}: malformed remote step action ${step.uses}`);
					continue;
				}
				const action = step.uses.slice(0, separator);
				const reference = step.uses.slice(separator + 1);
				const expected = node24Actions.get(action);
				if (!expected) {
					stale.push(`${name}: unapproved remote step action ${step.uses}`);
					continue;
				}
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
      - uses: actions/cache@v4
      - uses: ./local-composite-action
      - uses: docker://alpine:3.20
  delegated:
    uses: untrusted/example/.github/workflows/build.yml@main
`,
		},
	]);

	assert.deepEqual(stale, [
		"fixture.yml: actions/checkout@v4 -> @v7",
		"fixture.yml: actions/setup-node@0123456789abcdef0123456789abcdef01234567 -> @v7",
		"fixture.yml: unapproved remote step action actions/cache@v4",
		"fixture.yml: unapproved reusable workflow untrusted/example/.github/workflows/build.yml@main",
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

	assert.equal(evidence.status, "planned");
	assert.equal(evidence.dataMode, "historical-verified-snapshot");
	assert.match(evidence.nextStep, /read-only AWS snapshot/);
	assert.deepEqual(evidence.currentReleaseEvidence, {
		status: "repository-and-site-verified",
		runId: 35810476221,
		url: "https://github.com/Tiancheng-Xu/babysteps/actions/runs/35810476221",
		sourceCommit: "5360c3e5455964d9a7c623a47443fc864c4d1a11",
		productionDeploymentId: "d08d933c-412a-4400-96c4-604ab4d1bdb6",
	});
	assert.deepEqual(evidence.currentBoundary, {
		observedAt: null,
		mode: "cost-sleep",
		verification: "pending-fresh-read-only-aws-snapshot",
		verificationBlocker: "aws-cli-session-expired",
		sharedDatabaseAction: "blocked-pending-fresh-readback",
		awsWritePolicy: "blocked-unless-separately-cost-approved",
	});
	assert.equal(evidence.historicalEvidence.latest.runId, 33370197607);
	assert.equal(evidence.workflow, undefined);
	assert.equal(evidence.result, undefined);
	assert.equal(evidence.proof, undefined);
	assert.equal(
		evidence.historicalEvidence.baseline.role,
		"first-controlled-closed-loop-proof",
	);
	assert.equal(evidence.historicalEvidence.baseline.workflow.runId, 31765573258);
	assert.equal(
		evidence.historicalEvidence.baseline.result.remainingProjectRuntimeResources,
		0,
	);
	assert.equal(evidence.historicalEvidence.baseline.proof.length, 6);
	assert.deepEqual(evidence.remainingTodos.zeroIncrementalCost, [
		"keep Node 24 GitHub Action contracts and historical Evidence current",
	]);
	assert.deepEqual(evidence.remainingTodos.blocked, [
		"do not restore or replace the terminal shared RDS instance",
		"do not dispatch an AWS performance start without separate cost approval",
	]);
});
