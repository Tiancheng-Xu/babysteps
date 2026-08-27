import { readFile } from "node:fs/promises";

const [workflow, recovery, template, journey] = await Promise.all([
	readFile(".github/workflows/aws-performance.yml", "utf8"),
	readFile(".github/workflows/aws-performance-recovery.yml", "utf8"),
	readFile("aws/performance-template.yaml", "utf8"),
	readFile("scripts/run-performance-browser-journey.mjs", "utf8"),
]);

const required = [
	[workflow, "workflow_dispatch:", "workflow must be manual"],
	[workflow, "environment: aws-performance", "approval environment is missing"],
	[workflow, "id-token: write", "OIDC permission is missing"],
	[workflow, "docker/setup-qemu-action@v3", "ARM64 emulation setup is missing"],
	[
		workflow,
		"docker/setup-buildx-action@v3",
		"multi-platform builder setup is missing",
	],
	[
		workflow,
		"timeout-minutes: 50",
		"cleanup timeout must cover VPC Lambda ENI release",
	],
	[workflow, "aws-budget-guard", "budget gate is missing"],
	[workflow, "describe-nat-gateways", "shared NAT readiness gate is missing"],
	[
		workflow,
		"describe-db-instances",
		"shared database readiness gate is missing",
	],
	[workflow, "run-task", "controlled ECS cleaner task is missing"],
	[workflow, "wait tasks-stopped", "ECS task verification is missing"],
	[workflow, "sampleCount", "real statistics assertion is missing"],
	[
		workflow,
		"run-performance-browser-journey.mjs",
		"real Chromium journey is missing",
	],
	[
		workflow,
		"APP_URI=http://127.0.0.1:4173",
		"Worker APP_URI must equal the local Web origin",
	],
	[journey, "navigation.dns", "localhost DNS coverage must be unavailable"],
	[journey, "navigation.tls", "localhost TLS coverage must be unavailable"],
	[workflow, "schemaAbsenceVerified", "schema absence verification is missing"],
	[
		workflow,
		"list-task-definitions",
		"task definition cleanup inventory is missing",
	],
	[workflow, "apigatewayv2 get-apis", "API cleanup inventory is missing"],
	[workflow, "lambda list-functions", "Lambda cleanup inventory is missing"],
	[workflow, "logs describe-log-groups", "log cleanup inventory is missing"],
	[
		workflow,
		"secretsmanager list-secrets",
		"secret cleanup inventory is missing",
	],
	[
		workflow,
		"ec2 describe-security-groups",
		"security group cleanup inventory is missing",
	],
	[workflow, "iam list-roles", "IAM cleanup inventory is missing"],
	[
		workflow,
		"path: evidence",
		"artifacts must be restricted to sanitized evidence",
	],
	[
		recovery,
		"database_state",
		"recovery must branch from verified database state",
	],
	[recovery, "verify-schema-absent", "recovery must verify schema absence"],
	[
		recovery,
		"remainingProjectResources",
		"recovery zero-residue inventory is missing",
	],
	[journey, '"/tasks"', "Chromium journey must visit tasks"],
	[journey, '"/profile"', "Chromium journey must visit profile"],
	[journey, '"/performance"', "Chromium journey must visit performance"],
	[journey, '"/evidence"', "Chromium journey must visit evidence"],
	[workflow, "delete-stack", "project cleanup is missing"],
	[workflow, "DROP SCHEMA", "schema cleanup assertion is missing"],
	[workflow, "schemaDeleted", "schema deletion evidence gate is missing"],
	[template, "NODE_EXTRA_CA_CERTS", "RDS CA verification is missing"],
	[template, "AWS::ECS::TaskDefinition", "ECS cleaner definition is missing"],
	[template, "maxReceiveCount: 3", "DLQ retry policy is missing"],
	[
		template,
		'AllowedPattern: "^[0-9]+$"',
		"numeric RunId validation is missing",
	],
	[template, "PERFORMANCE_RUN_ID", "run-scoped database boundary is missing"],
	[template, "ApprovalReferenceHash", "hashed approval reference is missing"],
];

const errors = required.flatMap(([source, fragment, message]) =>
	source.includes(fragment) ? [] : [message],
);
if (/^\s*(?:push|schedule):/m.test(workflow))
	errors.push("automatic paid deployment triggers are forbidden");
if (!workflow.includes("concurrency:") || !workflow.includes("github.run_id"))
	errors.push("unique serialized cloud runs are required");
if (/AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/.test(workflow))
	errors.push("long-lived AWS credentials are forbidden");
if (/event\.json|value:\s*321|p50\s*!==\s*321/u.test(workflow))
	errors.push("fixed or handwritten performance events are forbidden");
if (!workflow.includes('test "$remaining" = "0"'))
	errors.push("cleanup must fail on any project residue");
if (!recovery.includes('test "$remaining" = "0"'))
	errors.push("recovery must fail on any project residue");
if (
	!workflow.includes("explicit deny cleanup") ||
	!recovery.includes("explicit deny cleanup")
)
	errors.push("shared foundation cleanup must be explicitly denied");
if (/path:\s+evidence\s*$/mu.test(workflow))
	errors.push("artifact upload must select sanitized JSON only");
if (
	/AWS::(?:RDS::DBInstance|EC2::NatGateway|ElasticLoadBalancingV2::LoadBalancer)/.test(
		template,
	)
)
	errors.push("duplicate heavy foundation is forbidden");

if (errors.length) {
	for (const error of errors) console.error(error);
	process.exit(1);
}
console.log("BabySteps performance pipeline contract: ok");
