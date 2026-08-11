import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Resource = {
	Type?: string;
	DeletionPolicy?: string;
	UpdateReplacePolicy?: string;
	Properties?: Record<string, unknown>;
};

async function template() {
	const source = await readFile(
		path.join(import.meta.dirname, "..", "bootstrap.yaml"),
		"utf8",
	);
	return {
		source,
		value: parse(source) as { Resources?: Record<string, Resource> },
	};
}

describe("AWS CI bootstrap template", () => {
	it("restricts GitHub OIDC trust to the approved repository environment", async () => {
		const { source, value } = await template();
		const role = value.Resources?.GitHubPipelineRole;
		expect(role?.Type).toBe("AWS::IAM::Role");
		expect(
			JSON.stringify(role?.Properties?.AssumeRolePolicyDocument),
		).toContain("repo:Tiancheng-Xu/babysteps:environment:aws-readiness");
		expect(source).toContain("token.actions.githubusercontent.com:aud");
		expect(source).toContain("sts.amazonaws.com");
	});

	it("uses encrypted S3 source and one small CodeBuild worker", async () => {
		const { source, value } = await template();
		const resources = value.Resources ?? {};
		expect(resources.SourceBucket?.Type).toBe("AWS::S3::Bucket");
		expect(resources.SourceBucket?.Properties).toMatchObject({
			PublicAccessBlockConfiguration: {
				BlockPublicAcls: true,
				BlockPublicPolicy: true,
				IgnorePublicAcls: true,
				RestrictPublicBuckets: true,
			},
		});
		expect(resources.ReadinessCodeBuild?.Properties).toMatchObject({
			ConcurrentBuildLimit: 1,
			Source: { Type: "S3" },
			Environment: {
				ComputeType: "BUILD_GENERAL1_SMALL",
				Type: "LINUX_CONTAINER",
			},
		});
		expect(source).not.toMatch(/GITHUB_TOKEN|oauth/i);
		expect(source).toContain("Key: Project");
		expect(source).toContain("Value: babysteps");
	});

	it("retains the shared OIDC provider and scopes RDS bootstrap permissions", async () => {
		const { source, value } = await template();
		expect(value.Resources?.GitHubOidcProvider).toMatchObject({
			Type: "AWS::IAM::OIDCProvider",
			DeletionPolicy: "Retain",
			UpdateReplacePolicy: "Retain",
		});
		expect(source).toContain("iam:AWSServiceName\": rds.amazonaws.com");
		expect(source).toContain("ec2:RevokeSecurityGroupEgress");
		expect(source).not.toContain("ec2:CreateNatGateway");
	});
});
