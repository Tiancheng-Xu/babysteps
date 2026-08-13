import { readFile } from "node:fs/promises";

const template = await readFile("aws/performance-template.yaml", "utf8");
const approval = JSON.parse(await readFile("aws/performance-budget-approved-exceptions.json", "utf8"));
const forbidden = ["AWS::EC2::NatGateway", "AWS::RDS::DBInstance", "AWS::ElasticLoadBalancingV2::LoadBalancer", "AWS::ECS::Service"];
for (const resource of forbidden) {
	if (template.includes(resource)) throw new Error(`forbidden paid or persistent resource: ${resource}`);
}
const exception = approval.exceptions?.find((item) => item.logical_id === "PerformanceCluster" && item.resource_type === "AWS::ECS::Cluster");
if (!exception || Date.parse(`${exception.expires_at}T23:59:59Z`) < Date.now()) throw new Error("missing exact unexpired ECS cluster approval");
if (!template.includes("DeletionPolicy: Delete")) throw new Error("project cleanup policy is missing");
console.log("BabySteps performance aws-budget-guard contract: ok");
