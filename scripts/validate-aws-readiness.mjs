import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function assertPausableDeploymentGate(environment) {
	if (environment.ALLOW_AWS_PAUSABLE_DEPLOYMENT !== "true") {
		throw new Error(
			"ALLOW_AWS_PAUSABLE_DEPLOYMENT=true is required before the cost-gated AWS deployment write",
		);
	}
}

export function validateAwsReadiness({ workflow, bootstrap, buildspec }) {
	const errors = [];
	const requirements = [
		[workflow, "workflow_dispatch:", "workflow must be manual"],
		[workflow, "id-token: write", "workflow must request OIDC"],
		[workflow, "environment: aws-readiness", "workflow must use approval environment"],
		[workflow, "aws-actions/configure-aws-credentials@v4", "workflow must use OIDC action"],
		[workflow, "aws s3 cp source.zip", "workflow must upload immutable source"],
		[workflow, "--source-type-override S3", "workflow must override source with S3"],
		[workflow, "ALLOW_AWS_PAUSABLE_DEPLOYMENT", "workflow must open only the pausable gate"],
		[bootstrap, "repo:Tiancheng-Xu/babysteps:environment:aws-readiness", "OIDC sub is not restricted"],
		[bootstrap, "ConcurrentBuildLimit: 1", "CodeBuild concurrency must be one"],
		[bootstrap, "ComputeType: BUILD_GENERAL1_SMALL", "CodeBuild must use small compute"],
		[bootstrap, "ALLOW_AWS_PAUSABLE_DEPLOYMENT", "CodeBuild must default the pausable gate closed"],
		[buildspec, "pnpm --filter @babysteps/aws test", "buildspec must test"],
		[buildspec, "pnpm --filter @babysteps/aws typecheck", "buildspec must typecheck"],
		[buildspec, "sam validate", "buildspec must validate SAM"],
		[buildspec, "node scripts/validate-aws-readiness.mjs --deploy", "paid gate is missing"],
		[buildspec, "--template-file aws/pausable-template.yaml", "buildspec must deploy only the pausable template"],
		[buildspec, "sam deploy", "buildspec deploy command is missing"],
	];
	for (const [source, fragment, message] of requirements) {
		if (!source.includes(fragment)) errors.push(message);
	}

	if (/^\s*(?:push|schedule):/m.test(workflow)) {
		errors.push("automatic AWS workflow triggers are forbidden");
	}
	if (/AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)|\$\{\{\s*secrets\./i.test(workflow)) {
		errors.push("long-lived AWS secrets are forbidden");
	}
	if (
		/CreateNatGateway|AllocateAddress|AWS::KMS::Key|kms:CreateKey|AWS::SecretsManager::Secret|secretsmanager:CreateSecret/u.test(
			bootstrap,
		)
	) {
		errors.push("persistent-charge AWS permissions are forbidden in the pausable stage");
	}
	if (/aws\/template\.yaml/u.test(buildspec)) {
		errors.push("the full runtime template is forbidden in the pausable stage");
	}
	if (/ALLOW_AWS_PAID_DEPLOYMENT|ALLOW_AWS_PERSISTENT_DEPLOYMENT/u.test(`${workflow}\n${bootstrap}\n${buildspec}`)) {
		errors.push("a persistent deployment gate is forbidden in the pausable workflow");
	}
	const testIndex = buildspec.indexOf("pnpm --filter @babysteps/aws test");
	const gateIndex = buildspec.indexOf("validate-aws-readiness.mjs --deploy");
	const deployIndex = buildspec.indexOf("sam deploy");
	if (!(testIndex >= 0 && testIndex < gateIndex && gateIndex < deployIndex)) {
		errors.push("test and paid gate must run before sam deploy");
	}
	return errors;
}

async function main() {
	const [workflow, bootstrap, buildspec] = await Promise.all([
		readFile(".github/workflows/aws-readiness.yml", "utf8"),
		readFile("aws/bootstrap.yaml", "utf8"),
		readFile("aws/buildspec.yml", "utf8"),
	]);
	const errors = validateAwsReadiness({ workflow, bootstrap, buildspec });
	if (errors.length > 0) {
		for (const error of errors) console.error(error);
		process.exitCode = 1;
		return;
	}
	if (process.argv.includes("--deploy")) {
		assertPausableDeploymentGate(process.env);
	}
	console.log("AWS readiness pipeline contract: ok");
}

const executedPath = process.argv[1]
	? pathToFileURL(resolve(process.argv[1])).href
	: "";
if (import.meta.url === executedPath) await main();
