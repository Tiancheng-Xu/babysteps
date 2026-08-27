import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

async function load() {
	const source = await readFile(
		path.join(import.meta.dirname, "..", "performance-template.yaml"),
		"utf8",
	);
	return {
		source,
		template: parse(source) as {
			Resources?: Record<
				string,
				{ Type?: string; Properties?: Record<string, unknown> }
			>;
			Parameters?: Record<string, unknown>;
		},
	};
}

describe("performance observability infrastructure", () => {
	it("uses only project-level serverless, queue and on-demand ECS resources", async () => {
		const { template } = await load();
		const resources = template.Resources ?? {};
		const types = Object.values(resources).map((resource) => resource.Type);
		expect(types).toContain("AWS::Serverless::HttpApi");
		expect(types.filter((type) => type === "AWS::SQS::Queue")).toHaveLength(2);
		expect(types).toContain("AWS::ECS::Cluster");
		expect(types).toContain("AWS::ECS::TaskDefinition");
		expect(types).not.toContain("AWS::ECS::Service");
		expect(types).not.toContain("AWS::EC2::NatGateway");
		expect(types).not.toContain("AWS::RDS::DBInstance");
		expect(types).not.toContain("AWS::ElasticLoadBalancingV2::LoadBalancer");
	});

	it("requires shared network and database boundaries as parameters", async () => {
		const { source, template } = await load();
		expect(template.Parameters).toMatchObject({
			SharedVpcId: {},
			PrivateSubnetIds: {},
			SharedDatabaseSecurityGroupId: {},
			SharedDatabaseSecretArn: {},
		});
		expect(source).toContain("babysteps-performance");
		expect(source).toContain("RetentionInDays: 7");
		expect(source).toContain("maxReceiveCount: 3");
		expect(source).toContain("DeletionPolicy: Delete");
		expect(source).toContain("AWS::SecretsManager::Secret");
		expect(source).toContain(
			"Name: !Sub babysteps-performance-db-${EnvironmentName}",
		);
		expect(source).toContain("PROJECT_DATABASE_SECRET_ARN");
		expect(source).toContain("OriginTokenSecret");
		expect(source).toContain("OriginTokenSecretArn");
		expect(source).toContain(
			"Name: !Sub babysteps-performance-origin-${EnvironmentName}",
		);
		expect(source).toContain("MASTER_DATABASE_SECRET_ARN");
		expect(source).toContain("DatabaseAdminTaskRole");
		expect(source).toContain("DatabaseAdminTaskDefinition");
		expect(source).toContain("DatabaseAdminTaskDefinitionArn");
		const cleanerRole = source.slice(
			source.indexOf("CleanerTaskRole:"),
			source.indexOf("DatabaseAdminTaskRole:"),
		);
		expect(cleanerRole).toContain("ProjectDatabaseSecret");
		expect(cleanerRole).not.toContain("SharedDatabaseSecretArn");
	});

	it("contains no account, credential or private endpoint literal", async () => {
		const { source } = await load();
		expect(source).not.toMatch(/AKIA[0-9A-Z]{16}/);
		expect(source).not.toMatch(/BEGIN (?:RSA |EC )?PRIVATE KEY/);
		expect(source).not.toMatch(/\b\d{12}\b/);
		expect(source).not.toMatch(/postgres(?:ql)?:\/\//i);
	});

	it("verifies the RDS server certificate in Lambda and ECS runtimes", async () => {
		const { source } = await load();
		const runtime = await readFile(
			path.join(import.meta.dirname, "..", "src/performance/runtime.ts"),
			"utf8",
		);
		const dockerfile = await readFile(
			path.join(import.meta.dirname, "..", "performance.Dockerfile"),
			"utf8",
		);
		expect(runtime).toContain("rejectUnauthorized: true");
		expect(runtime).not.toContain("rejectUnauthorized: false");
		expect(source).toContain("NODE_EXTRA_CA_CERTS");
		expect(source).toContain("/var/runtime/ca-cert.pem");
		expect(dockerfile).toContain("us-east-1-bundle.pem");
		expect(dockerfile).toContain("NODE_EXTRA_CA_CERTS");
	});
});
