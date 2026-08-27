import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedReadActions = [
	"apigateway:GET",
	"cloudformation:DescribeStacks",
	"ecr:DescribeRepositories",
	"ecs:DescribeClusters",
	"ecs:DescribeTaskDefinition",
	"lambda:GetFunction",
	"logs:DescribeLogGroups",
	"secretsmanager:DescribeSecret",
	"sqs:GetQueueUrl",
	"tag:GetResources",
];

test("preflight readback policy covers every zero-residue AWS read and no mutation", async () => {
	const workflow = await readFile(
		".github/workflows/aws-performance-control.yml",
		"utf8",
	);
	const policy = JSON.parse(
		await readFile("aws/iam/performance-control-readback-policy.json", "utf8"),
	);
	const actions = new Set(
		policy.Statement.flatMap((statement) =>
			Array.isArray(statement.Action) ? statement.Action : [statement.Action],
		),
	);

	assert.deepEqual([...actions].sort(), expectedReadActions);
	for (const command of [
		"cloudformation describe-stacks",
		"ecs describe-clusters",
		"ecr describe-repositories",
		"sqs get-queue-url",
		"lambda get-function",
		"logs describe-log-groups",
		"secretsmanager describe-secret",
		"resourcegroupstaggingapi get-resources",
		"ecs describe-task-definition",
	]) {
		assert.match(workflow, new RegExp(command.replaceAll("-", "\\-")));
	}
	for (const action of actions) {
		assert.doesNotMatch(
			action,
			/(?:Create|Delete|Put|Update|Run|Stop|Execute|PassRole)/,
		);
	}
	assert.equal(policy.Statement.at(-1).Resource, "arn:aws:apigateway:us-east-1::/apis/*");
	assert.ok(
		policy.Statement.filter((statement) => statement.Resource === "*").every(
			(statement) =>
				statement.Condition?.StringEquals?.["aws:RequestedRegion"] ===
				"us-east-1",
		),
	);
});
