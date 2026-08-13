import { readFile } from "node:fs/promises";

const [workflow, template] = await Promise.all([
	readFile(".github/workflows/aws-performance.yml", "utf8"),
	readFile("aws/performance-template.yaml", "utf8"),
]);

const required = [
	[workflow, "workflow_dispatch:", "workflow must be manual"],
	[workflow, "environment: aws-performance", "approval environment is missing"],
	[workflow, "id-token: write", "OIDC permission is missing"],
	[workflow, "aws-budget-guard", "budget gate is missing"],
	[workflow, "describe-nat-gateways", "shared NAT readiness gate is missing"],
	[workflow, "describe-db-instances", "shared database readiness gate is missing"],
	[workflow, "run-task", "controlled ECS cleaner task is missing"],
	[workflow, "wait tasks-stopped", "ECS task verification is missing"],
	[workflow, "sampleCount", "real statistics assertion is missing"],
	[workflow, "delete-stack", "project cleanup is missing"],
	[workflow, "DROP SCHEMA", "schema cleanup assertion is missing"],
	[workflow, "schemaDeleted", "schema deletion evidence gate is missing"],
	[template, "NODE_EXTRA_CA_CERTS", "RDS CA verification is missing"],
	[template, "AWS::ECS::TaskDefinition", "ECS cleaner definition is missing"],
	[template, "maxReceiveCount: 3", "DLQ retry policy is missing"],
];

const errors = required.flatMap(([source, fragment, message]) => source.includes(fragment) ? [] : [message]);
if (/^\s*(?:push|schedule):/m.test(workflow)) errors.push("automatic paid deployment triggers are forbidden");
if (!workflow.includes("concurrency:") || !workflow.includes("github.run_id")) errors.push("unique serialized cloud runs are required");
if (/AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/.test(workflow)) errors.push("long-lived AWS credentials are forbidden");
if (/AWS::(?:RDS::DBInstance|EC2::NatGateway|ElasticLoadBalancingV2::LoadBalancer)/.test(template)) errors.push("duplicate heavy foundation is forbidden");

if (errors.length) {
	for (const error of errors) console.error(error);
	process.exit(1);
}
console.log("BabySteps performance pipeline contract: ok");
