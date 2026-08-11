import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type CloudFormationTemplate = {
	Globals?: {
		Function?: { Tags?: Record<string, unknown> };
	};
	Parameters?: Record<string, Record<string, unknown>>;
	Resources?: Record<
		string,
		{ Type?: string; Properties?: Record<string, unknown> }
	>;
};

const REQUIRED_TAGS = {
	Project: "babysteps",
	Environment: { Ref: "EnvironmentName" },
	ManagedBy: "cloudformation",
	ExpiresAt: { Ref: "ExpiresAt" },
} as const;

function tagMap(
	resource: { Properties?: Record<string, unknown> } | undefined,
) {
	const tags = resource?.Properties?.Tags;
	if (!Array.isArray(tags)) return {};
	return Object.fromEntries(
		tags.map((tag) => {
			const item = tag as { Key: string; Value: unknown };
			return [item.Key, item.Value];
		}),
	);
}

async function loadTemplate(): Promise<CloudFormationTemplate> {
	const source = await readFile(
		path.join(import.meta.dirname, "..", "template.yaml"),
		"utf8",
	);
	return parse(source) as CloudFormationTemplate;
}

describe("AWS readiness runtime template", () => {
	it("defines the approved private runtime resources", async () => {
		const template = await loadTemplate();
		const resources = template.Resources ?? {};

		expect(resources.BabystepsVpc?.Type).toBe("AWS::EC2::VPC");
		expect(resources.PublicSubnetA?.Type).toBe("AWS::EC2::Subnet");
		expect(resources.PublicSubnetB?.Type).toBe("AWS::EC2::Subnet");
		expect(resources.PrivateSubnetA?.Type).toBe("AWS::EC2::Subnet");
		expect(resources.PrivateSubnetB?.Type).toBe("AWS::EC2::Subnet");
		expect(resources.NatGateway?.Type).toBe("AWS::EC2::NatGateway");
		expect(
			Object.values(resources).filter(
				(resource) => resource.Type === "AWS::EC2::NatGateway",
			),
		).toHaveLength(1);
		expect(resources.Database?.Type).toBe("AWS::RDS::DBInstance");
		expect(resources.DatabaseSecret?.Type).toBe("AWS::SecretsManager::Secret");
		expect(resources.WebhookSecret?.Type).toBe("AWS::SecretsManager::Secret");
		expect(resources.RelayerKey?.Type).toBe("AWS::KMS::Key");
		expect(resources.CompletionApi?.Type).toBe("AWS::Serverless::HttpApi");
		expect(resources.RelayerFunction?.Type).toBe("AWS::Serverless::Function");
		expect(resources.Database?.Properties?.PubliclyAccessible).toBe(false);
		expect(resources.Database?.Properties).toMatchObject({
			Engine: "postgres",
			DBInstanceClass: "db.t4g.micro",
			AllocatedStorage: 20,
			StorageType: "gp3",
			MultiAZ: false,
		});
		expect(resources.DatabaseIngress?.Properties).toMatchObject({
			IpProtocol: "tcp",
			FromPort: 5432,
			ToPort: 5432,
			SourceSecurityGroupId: { Ref: "RelayerSecurityGroup" },
			GroupId: { Ref: "DatabaseSecurityGroup" },
		});
		expect(resources.RelayerKey?.Properties).toMatchObject({
			KeySpec: "ECC_SECG_P256K1",
			KeyUsage: "SIGN_VERIFY",
			PendingWindowInDays: 7,
		});
		expect(resources.RelayerLogGroup?.Properties?.RetentionInDays).toBe(7);
	});

	it("tags every taggable boundary resource for ownership and expiry", async () => {
		const template = await loadTemplate();
		const resources = template.Resources ?? {};
		const taggableResources = [
			"BabystepsVpc",
			"PublicSubnetA",
			"PublicSubnetB",
			"PrivateSubnetA",
			"PrivateSubnetB",
			"NatGateway",
			"Database",
			"DatabaseSecret",
			"WebhookSecret",
			"RelayerKey",
		];

		for (const logicalId of taggableResources) {
			expect(tagMap(resources[logicalId]), logicalId).toMatchObject(
				REQUIRED_TAGS,
			);
		}

		expect(
			template.Globals?.Function?.Tags,
			"RelayerFunction Globals",
		).toMatchObject(REQUIRED_TAGS);
	});

	it("contains no credential, private key, or account identifier literal", async () => {
		const source = await readFile(
			path.join(import.meta.dirname, "..", "template.yaml"),
			"utf8",
		);

		expect(source).not.toMatch(/AKIA[0-9A-Z]{16}/);
		expect(source).not.toMatch(/BEGIN (?:RSA |EC )?PRIVATE KEY/);
		expect(source).not.toMatch(/\b\d{12}\b/);

		const template = await loadTemplate();
		const expectedDynamicReference = [
			"{{resolve:secretsmanager:",
			"$",
			"{DatabaseSecret}",
			":SecretString:password}}",
		].join("");
		expect(
			template.Resources?.Database?.Properties?.MasterUserPassword,
		).toEqual({
			"Fn::Sub": expectedDynamicReference,
		});
	});
});
