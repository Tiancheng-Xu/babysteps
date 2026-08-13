import {
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { Pool } from "pg";
import { z } from "zod";

const databaseSecretSchema = z.object({
	host: z.string().min(1),
	port: z.coerce.number().int().positive().default(5432),
	username: z.string().min(1),
	password: z.string().min(1),
	dbname: z.string().min(1).default("postgres"),
});

export async function readDatabaseSecret(secretArn: string) {
	const response = await new SecretsManagerClient({}).send(
		new GetSecretValueCommand({ SecretId: secretArn }),
	);
	return databaseSecretSchema.parse(JSON.parse(response.SecretString ?? "{}"));
}

export async function createPerformancePool(
	secretArn = required("PROJECT_DATABASE_SECRET_ARN"),
) {
	const secret = await readDatabaseSecret(secretArn);
	return new Pool({
		host: secret.host,
		port: secret.port,
		user: secret.username,
		password: secret.password,
		database: secret.dbname,
		ssl: { rejectUnauthorized: true },
		max: 2,
		connectionTimeoutMillis: 8_000,
	});
}

export function required(name: string) {
	const value = process.env[name];
	if (!value) throw new Error(`MISSING_${name}`);
	return value;
}
