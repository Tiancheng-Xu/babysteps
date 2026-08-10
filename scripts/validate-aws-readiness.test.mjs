import assert from "node:assert/strict";
import { test } from "node:test";
import {
	assertPaidDeploymentGate,
	validateAwsReadiness,
} from "./validate-aws-readiness.mjs";

const valid = {
	workflow: `workflow_dispatch:\npermissions:\n  id-token: write\nenvironment: aws-readiness\naws-actions/configure-aws-credentials@v4\naws s3 cp source.zip\n--source-type-override S3\n--source-location-override\n`,
	bootstrap: `repo:Tiancheng-Xu/babysteps:environment:aws-readiness\nConcurrentBuildLimit: 1\nType: S3\nComputeType: BUILD_GENERAL1_SMALL\n`,
	buildspec: `pnpm --filter @babysteps/aws test\npnpm --filter @babysteps/aws typecheck\nsam validate\nnode scripts/validate-aws-readiness.mjs --deploy\nsam deploy\n`,
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

test("paid deployment gate is closed unless explicitly enabled", () => {
	assert.throws(() => assertPaidDeploymentGate({}), /ALLOW_AWS_PAID_DEPLOYMENT/);
	assert.throws(
		() => assertPaidDeploymentGate({ ALLOW_AWS_PAID_DEPLOYMENT: "false" }),
		/ALLOW_AWS_PAID_DEPLOYMENT/,
	);
	assert.doesNotThrow(() =>
		assertPaidDeploymentGate({ ALLOW_AWS_PAID_DEPLOYMENT: "true" }),
	);
});
