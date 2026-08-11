import assert from "node:assert/strict";
import { test } from "node:test";
import {
	assertPausableDeploymentGate,
	validateAwsReadiness,
} from "./validate-aws-readiness.mjs";

const valid = {
	workflow: `workflow_dispatch:\npermissions:\n  id-token: write\nenvironment: aws-readiness\naws-actions/configure-aws-credentials@v4\naws s3 cp source.zip\n--source-type-override S3\n--source-location-override\nALLOW_AWS_PAUSABLE_DEPLOYMENT\n`,
	bootstrap: `repo:Tiancheng-Xu/babysteps:environment:aws-readiness\nConcurrentBuildLimit: 1\nType: S3\nComputeType: BUILD_GENERAL1_SMALL\nALLOW_AWS_PAUSABLE_DEPLOYMENT\n`,
	buildspec: `pnpm --filter @babysteps/aws test\npnpm --filter @babysteps/aws typecheck\nsam validate --template-file aws/pausable-template.yaml\nnode scripts/validate-aws-readiness.mjs --deploy\nsam deploy --template-file aws/pausable-template.yaml\n`,
};

test("accepts the gated OIDC, S3, and CodeBuild contract", () => {
	assert.deepEqual(validateAwsReadiness(valid), []);
});

test("rejects long-lived AWS secrets and automatic triggers", () => {
	const errors = validateAwsReadiness({
		...valid,
		workflow: `${valid.workflow}\npush:\nAWS_ACCESS_KEY_ID: secret`,
	});
	assert.match(errors.join("\n"), /long-lived|automatic/i);
});

test("pausable deployment gate is closed unless explicitly enabled", () => {
	assert.throws(
		() => assertPausableDeploymentGate({}),
		/ALLOW_AWS_PAUSABLE_DEPLOYMENT/,
	);
	assert.throws(
		() =>
			assertPausableDeploymentGate({
				ALLOW_AWS_PAUSABLE_DEPLOYMENT: "false",
			}),
		/ALLOW_AWS_PAUSABLE_DEPLOYMENT/,
	);
	assert.doesNotThrow(() =>
		assertPausableDeploymentGate({
			ALLOW_AWS_PAUSABLE_DEPLOYMENT: "true",
		}),
	);
});

test("rejects persistent-charge resources and the full runtime template", () => {
	const forbiddenBootstrap = `${valid.bootstrap}\nec2:CreateNatGateway\nkms:CreateKey`;
	const forbiddenBuildspec = `${valid.buildspec}\nsam deploy --template-file aws/template.yaml`;
	const errors = validateAwsReadiness({
		...valid,
		bootstrap: forbiddenBootstrap,
		buildspec: forbiddenBuildspec,
	});
	assert.match(errors.join("\n"), /persistent|pausable/i);
});
