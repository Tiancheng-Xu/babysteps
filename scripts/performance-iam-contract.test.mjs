import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedReadActions = [
	"apigateway:GET",
	"cloudformation:DescribeStacks",
	"ec2:DescribeSecurityGroupRules",
	"ec2:DescribeSecurityGroups",
	"ecr:DescribeRepositories",
	"ecs:DescribeClusters",
	"ecs:DescribeTaskDefinition",
	"ecs:ListTaskDefinitions",
	"ecs:ListTasks",
	"iam:GetRole",
	"iam:ListRoles",
	"lambda:GetFunction",
	"lambda:ListFunctions",
	"logs:DescribeLogGroups",
	"secretsmanager:DescribeSecret",
	"secretsmanager:GetSecretValue",
	"secretsmanager:ListSecrets",
	"sqs:GetQueueUrl",
	"tag:GetResources",
];

test("preflight readback policy covers every zero-residue AWS read and no mutation", async () => {
	const workflow = await readFile(
		".github/workflows/aws-performance-control.yml",
		"utf8",
	);
	const recoveryWorkflow = await readFile(
		".github/workflows/aws-performance-recovery.yml",
		"utf8",
	);
	const classifier = await readFile(
		"scripts/aws-performance-control-state.sh",
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
		"ecs list-task-definitions",
		"ecs list-tasks",
		"iam get-role",
	]) {
		assert.match(workflow, new RegExp(command.replaceAll("-", "\\-")));
	}
	for (const action of actions) {
		assert.doesNotMatch(
			action,
			/(?:Create|Delete|Put|Update|Run|Stop|Execute|PassRole)/,
		);
	}
	assert.deepEqual(policy.Statement.at(-1).Resource, [
		"arn:aws:apigateway:us-east-1::/apis",
		"arn:aws:apigateway:us-east-1::/apis/*",
	]);
	assert.doesNotMatch(workflow, /iam list-roles/);
	for (const command of [
		"lambda list-functions",
		"secretsmanager list-secrets",
		"ec2 describe-security-groups",
		"ec2 describe-security-group-rules",
		"iam list-roles",
	]) {
		assert.match(recoveryWorkflow, new RegExp(command.replaceAll("-", "\\-")));
	}
	assert.match(classifier, /iam-role\) printf '%s' 'NoSuchEntity'/);
	const roleStatement = policy.Statement.find((statement) =>
		(Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes(
			"iam:GetRole",
		),
	);
	assert.deepEqual(roleStatement?.Resource, [
		"arn:aws:iam::782086108248:role/babysteps-performance-db-admin-control",
		"arn:aws:iam::782086108248:role/babysteps-performance-execution-control",
		"arn:aws:iam::782086108248:role/babysteps-performance-query-control",
		"arn:aws:iam::782086108248:role/babysteps-performance-task-control",
	]);
	const secretStatements = policy.Statement.filter((statement) =>
		(Array.isArray(statement.Action) ? statement.Action : [statement.Action]).some(
			(action) => action.startsWith("secretsmanager:"),
		),
	);
	const describeSecret = secretStatements.find((statement) =>
		(Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes(
			"secretsmanager:DescribeSecret",
		),
	);
	assert.deepEqual(describeSecret?.Resource, [
		"arn:aws:secretsmanager:us-east-1:782086108248:secret:babysteps-performance-db-control-*",
		"arn:aws:secretsmanager:us-east-1:782086108248:secret:babysteps-performance-origin-control-*",
	]);
	const readOriginValue = secretStatements.filter((statement) =>
		(Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes(
			"secretsmanager:GetSecretValue",
		),
	);
	assert.equal(readOriginValue.length, 1);
	assert.equal(
		readOriginValue[0].Resource,
		"arn:aws:secretsmanager:us-east-1:782086108248:secret:babysteps-performance-origin-control-*",
	);
	for (const statement of secretStatements) {
		for (const action of Array.isArray(statement.Action)
			? statement.Action
			: [statement.Action]) {
			assert.doesNotMatch(action, /\*/);
		}
	}
	assert.ok(
		policy.Statement.filter((statement) => statement.Resource === "*").every(
			(statement) =>
				statement.Condition?.StringEquals?.["aws:RequestedRegion"] ===
				"us-east-1",
		),
	);
});
