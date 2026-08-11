import {
	GetPublicKeyCommand,
	KMSClient,
	SignCommand,
} from "@aws-sdk/client-kms";
import {
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { Pool } from "pg";
import { type Address, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { z } from "zod";
import {
	ConfirmCompletionError,
	type ConfirmCompletionResult,
	confirmCompletion,
} from "./application/confirmCompletion.js";
import {
	verifyWebhook,
	WebhookAuthError,
	type WebhookClaims,
	type WebhookInput,
} from "./auth/webhook.js";
import {
	type PublicRpcLike,
	ViemMarketplaceClient,
} from "./chain/marketplaceClient.js";
import type { CompletionJobInput } from "./domain/completionJob.js";
import {
	PostgresCompletionJobs,
	PostgresNonceStore,
	type SqlPool,
} from "./repositories/postgresCompletionJobs.js";
import { initializeCompletionSchema } from "./repositories/schema.js";
import {
	KmsEthereumSigner,
	type KmsLike,
} from "./signing/kmsEthereumSigner.js";

const payloadSchema = z.object({
	purchaseId: z
		.string()
		.regex(/^[1-9]\d{0,77}$/)
		.transform(BigInt),
	evidenceHash: z
		.string()
		.regex(/^0x[0-9a-fA-F]{64}$/)
		.transform((value) => value as `0x${string}`),
	idempotencyKey: z
		.string()
		.min(8)
		.max(128)
		.regex(/^[a-zA-Z0-9._:-]+$/),
});

export type HandlerDependencies = {
	verifyWebhook(input: WebhookInput): Promise<WebhookClaims>;
	confirmCompletion(
		input: CompletionJobInput,
	): Promise<ConfirmCompletionResult>;
};

type JsonResponse = {
	statusCode: number;
	headers: Record<string, string>;
	body: string;
};

export function createHandler(dependencies: HandlerDependencies) {
	return async (
		event: Pick<APIGatewayProxyEventV2, "body" | "headers" | "isBase64Encoded">,
	): Promise<JsonResponse> => {
		const rawBody = event.body
			? event.isBase64Encoded
				? Buffer.from(event.body, "base64").toString("utf8")
				: event.body
			: "";
		try {
			await dependencies.verifyWebhook({
				rawBody,
				timestamp: header(event.headers, "x-babysteps-timestamp"),
				nonce: header(event.headers, "x-babysteps-nonce"),
				signature: header(event.headers, "x-babysteps-signature"),
			});

			let decoded: unknown;
			try {
				decoded = JSON.parse(rawBody);
			} catch {
				return response(400, { error: "INVALID_REQUEST" });
			}
			const parsed = payloadSchema.safeParse(decoded);
			if (!parsed.success) return response(400, { error: "INVALID_REQUEST" });

			const result = await dependencies.confirmCompletion(parsed.data);
			if (result.kind === "conflict") {
				return response(409, { error: "IDEMPOTENCY_CONFLICT" });
			}
			if (result.kind === "existing") {
				return response(200, {
					status: result.status,
					transactionHash: result.transactionHash,
				});
			}
			return response(202, {
				status: "submitted",
				transactionHash: result.transactionHash,
			});
		} catch (error) {
			if (error instanceof WebhookAuthError) {
				return response(401, { error: error.code });
			}
			if (error instanceof ConfirmCompletionError) {
				return response(error.code === "PERSISTENCE_FAILED" ? 500 : 503, {
					error: error.code,
				});
			}
			return response(500, { error: "INTERNAL_ERROR" });
		}
	};
}

let productionHandler: ReturnType<typeof createHandler> | undefined;

export const handler = async (event: APIGatewayProxyEventV2) => {
	productionHandler ??= await createProductionHandler();
	return productionHandler(event);
};

async function createProductionHandler() {
	const secrets = new SecretsManagerClient({});
	const [databaseSecret, webhookSecret] = await Promise.all([
		readJsonSecret(secrets, required("DATABASE_SECRET_ARN")),
		readJsonSecret(secrets, required("WEBHOOK_SECRET_ARN")),
	]);
	const pool = new Pool({
		host: required("DATABASE_HOST"),
		port: Number(required("DATABASE_PORT")),
		database: required("DATABASE_NAME"),
		user: stringField(databaseSecret, "username"),
		password: stringField(databaseSecret, "password"),
		max: 2,
		ssl: { rejectUnauthorized: true },
	});
	const sqlPool = adaptPool(pool);
	await initializeCompletionSchema(sqlPool);
	const repository = new PostgresCompletionJobs(sqlPool);
	const nonceStore = new PostgresNonceStore(sqlPool);
	const kmsClient = new KMSClient({});
	const signer = new KmsEthereumSigner(
		adaptKms(kmsClient),
		required("KMS_KEY_ID"),
	);
	const rpc = createPublicClient({
		chain: sepolia,
		transport: http(required("SEPOLIA_RPC_URL"), { timeout: 15_000 }),
	});
	const marketplace = new ViemMarketplaceClient(
		rpc as unknown as PublicRpcLike,
		required("MARKETPLACE_ADDRESS") as Address,
	);
	const certificateBaseUri = required("CERTIFICATE_BASE_URI");
	const hmacSecret = stringField(webhookSecret, "secret");

	return createHandler({
		verifyWebhook: (input) =>
			verifyWebhook(input, { secret: hmacSecret, nonceStore }),
		confirmCompletion: (input) =>
			confirmCompletion(input, {
				repository,
				signer,
				marketplace,
				certificateUriFor: (purchaseId) =>
					`${certificateBaseUri.replace(/\/$/, "")}/${purchaseId}.json`,
			}),
	});
}

function adaptPool(pool: Pool): SqlPool {
	const query = async (text: string, values?: readonly unknown[]) => {
		const result = await pool.query(text, values ? [...values] : undefined);
		return { rows: result.rows, rowCount: result.rowCount };
	};
	return {
		query,
		connect: async () => {
			const client = await pool.connect();
			return {
				query: async (text, values) => {
					const result = await client.query(
						text,
						values ? [...values] : undefined,
					);
					return { rows: result.rows, rowCount: result.rowCount };
				},
				release: () => client.release(),
			};
		},
	};
}

function adaptKms(client: KMSClient): KmsLike {
	return {
		getPublicKey: async ({ KeyId }) =>
			client.send(new GetPublicKeyCommand({ KeyId })),
		sign: async (input) => client.send(new SignCommand(input)),
	};
}

async function readJsonSecret(client: SecretsManagerClient, secretId: string) {
	const result = await client.send(
		new GetSecretValueCommand({ SecretId: secretId }),
	);
	if (!result.SecretString) throw new Error("SECRET_VALUE_MISSING");
	const parsed: unknown = JSON.parse(result.SecretString);
	if (!parsed || typeof parsed !== "object")
		throw new Error("SECRET_VALUE_INVALID");
	return parsed as Record<string, unknown>;
}

function stringField(value: Record<string, unknown>, key: string) {
	const field = value[key];
	if (typeof field !== "string" || field.length === 0) {
		throw new Error("SECRET_FIELD_INVALID");
	}
	return field;
}

function required(name: string) {
	const value = process.env[name];
	if (!value) throw new Error("CONFIGURATION_MISSING");
	return value;
}

function header(headers: Record<string, string | undefined>, name: string) {
	const found = Object.entries(headers).find(
		([headerName]) => headerName.toLowerCase() === name,
	);
	return found?.[1];
}

function response(statusCode: number, body: Record<string, unknown>) {
	return {
		statusCode,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	};
}
