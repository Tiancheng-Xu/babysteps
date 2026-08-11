import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Template = {
	Parameters?: Record<string, Record<string, unknown>>;
	Resources?: Record<string, { Type?: string; Properties?: Record<string, unknown> }>;
};

async function load() {
	const source = await readFile(
		path.join(import.meta.dirname, "..", "pausable-template.yaml"),
		"utf8",
	);
	return { source, template: parse(source) as Template };
}

describe("AWS pausable readiness stage", () => {
	it("contains only idle-free or explicitly stoppable resources", async () => {
		const { source, template } = await load();
		const resources = template.Resources ?? {};
		expect(resources.BabystepsVpc?.Type).toBe("AWS::EC2::VPC");
		expect(resources.PrivateSubnetA?.Type).toBe("AWS::EC2::Subnet");
		expect(resources.PrivateSubnetB?.Type).toBe("AWS::EC2::Subnet");
		expect(resources.Database?.Type).toBe("AWS::RDS::DBInstance");
		expect(resources.StopDatabaseFunction?.Type).toBe("AWS::Serverless::Function");
		expect(resources.ReadinessApi?.Type).toBe("AWS::Serverless::HttpApi");
		expect(source).not.toMatch(/NatGateway|AWS::EC2::EIP/u);
		expect(source).not.toMatch(/AWS::KMS::Key|AWS::SecretsManager::Secret/u);
	});

	it("auto-stops the database and keeps its credentials out of source", async () => {
		const { source, template } = await load();
		expect(template.Parameters?.DatabaseMasterPassword?.NoEcho).toBe(true);
		expect(template.Resources?.Database?.Properties).toMatchObject({
			DBInstanceClass: "db.t4g.micro",
			AllocatedStorage: 20,
			BackupRetentionPeriod: 0,
			MultiAZ: false,
			PubliclyAccessible: false,
		});
		expect(template.Resources?.StopDatabaseSchedule?.Properties).toMatchObject({
			ScheduleExpression: "rate(5 minutes)",
			State: "ENABLED",
		});
		expect(template.Resources?.Database?.Properties?.MasterUserPassword).toEqual({
			Ref: "DatabaseMasterPassword",
		});
		expect(source).toContain("stop_db_instance");
	});
});
