import { readFile } from "node:fs/promises";

const [
	workflow,
	recovery,
	template,
	journey,
	manifestSource,
	readback,
	implementedJourney,
	implementedPreflight,
	implementedSchema,
	controlWorkflow,
	bootstrapContract,
] = await Promise.all([
	readFile(".github/workflows/aws-performance.yml", "utf8"),
	readFile(".github/workflows/aws-performance-recovery.yml", "utf8"),
	readFile("aws/performance-template.yaml", "utf8"),
	readFile("scripts/run-performance-browser-journey.mjs", "utf8"),
	readFile("scripts/performance-journey.manifest.json", "utf8"),
	readFile("scripts/validate-performance-readback.mjs", "utf8"),
	readFile("scripts/run-implemented-feature-journey.mjs", "utf8"),
	readFile("scripts/run-implemented-feature-preflight.mjs", "utf8"),
	readFile("scripts/implemented-feature-journey.schema.json", "utf8"),
	readFile(".github/workflows/aws-performance-control.yml", "utf8"),
	readFile("scripts/performance-control-bootstrap.mjs", "utf8"),
]);
const manifest = JSON.parse(manifestSource);
const expectedBusinessMetrics = [
	"business.growth.activity",
	"business.growth.transfer",
	"business.notebook.write",
	"business.babycoin.activity",
	"business.marketplace.approve",
	"business.marketplace.buy",
	"business.marketplace.content_unlock",
	"business.marketplace.completion_submit",
	"business.provider.create",
	"business.owner.approve",
	"business.owner.reject",
	"business.owner.completion_confirm",
	"business.keepsake.draw",
	"business.keepsake.fuse",
	"business.keepsake.recover",
	"business.exchange.quote",
	"business.exchange.swap",
	"business.identity.login",
	"business.identity.session",
	"business.profile.write",
];

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
	[
		workflow,
		"CLEANER_WATCHDOG_MAX_ATTEMPTS=36",
		"bounded ECS cleaner watchdog is missing",
	],
	[
		workflow,
		"babysteps-performance-cleaner-time-budget-exceeded",
		"ECS cleaner timeout stop path is missing",
	],
	[
		workflow,
		"validate-performance-readback.mjs",
		"exact per-metric statistics assertion is missing",
	],
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
	[
		journey,
		"performance-journey.manifest.json",
		"browser journey manifest is missing",
	],
	[
		implementedJourney,
		"WAITING_FOR_USER_",
		"visible wallet journey checkpoints are missing",
	],
	[
		implementedJourney,
		"telemetryAccepted",
		"implemented journey telemetry gate is missing",
	],
	[
		implementedPreflight,
		"AWS_BUDGET_GUARD_NOT_PASSED",
		"implemented journey Budget Guard preflight is missing",
	],
	[
		implementedPreflight,
		"AWS_RUNTIME_NOT_STOPPED",
		"implemented journey preflight must refuse a running AWS runtime",
	],
	[
		implementedPreflight,
		"PREFLIGHT_SNAPSHOT_STALE",
		"implemented journey preflight must reject stale readback",
	],
	[
		controlWorkflow,
		"babysteps-performance-control-bootstrap-v1",
		"dedicated stopped bootstrap source is missing",
	],
	[
		controlWorkflow,
		"Publish initial verified stopped bootstrap callback",
		"stopped bootstrap callback step is missing",
	],
	[
		bootstrapContract,
		"insert-initial-stopped-row",
		"bootstrap must remain insert-only for an absent control row",
	],
	[
		bootstrapContract,
		"github-actions-artifact+aws-zero-residue-readback",
		"bootstrap dual-authority cleanup proof is missing",
	],
	[
		implementedSchema,
		'"maxItems": 31',
		"implemented journey schema must remain exactly bounded",
	],
	[
		readback,
		"performance-journey.manifest.json",
		"readback manifest is missing",
	],
	[readback, "requiredMetrics", "readback must enforce required metrics"],
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
for (const path of ["/tasks", "/profile", "/performance", "/evidence"]) {
	if (!manifest.routes?.some((route) => route.path === path))
		errors.push(`Chromium journey must visit ${path}`);
}
if (!(manifest.requiredMetrics?.length > 0))
	errors.push("browser journey required metrics are missing");
if (
	JSON.stringify(manifest.businessMetrics) !==
	JSON.stringify(expectedBusinessMetrics)
)
	errors.push("bounded business metric catalog is incomplete or reordered");
if (manifest.implementedFeatureJourneys?.length !== 31)
	errors.push(
		"implemented feature journey catalog must contain exactly 31 items",
	);
if (
	new Set(
		manifest.implementedFeatureJourneys?.map(({ journeyId }) => journeyId) ??
			[],
	).size !== 31
)
	errors.push("implemented feature journey ids must be unique");
for (const metric of ["navigation.dns", "navigation.tcp", "navigation.tls"]) {
	if (!manifest.conditionalAvailabilityMetrics?.includes(metric))
		errors.push(`localhost ${metric} coverage must be conditionally available`);
}
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
