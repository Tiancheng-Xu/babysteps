import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
	DeleteMessageCommand,
	ReceiveMessageCommand,
	SQSClient,
} from "@aws-sdk/client-sqs";
import { classifyCleanerError, cleanPerformanceEvent } from "./cleaner";
import {
	cleanupPerformanceDatabase,
	initializePerformanceDatabase,
	performanceSchemaExists,
} from "./databaseAccess";
import { createPerformancePool, readDatabaseSecret, required } from "./runtime";
import { PostgresPerformanceStore } from "./storage";

export type CleanerSummary = {
	processed: number;
	inserted: number;
	deduplicated: number;
	discarded: number;
	retryableFailures: number;
	writeDurationMs: number;
	durationMs: number;
};

export function formatCleanerSummary(summary: CleanerSummary) {
	return `${JSON.stringify(summary)}\n`;
}

export function withinCleanerRuntime(
	startedAt: number,
	maxRuntimeMs: number,
	now = Date.now(),
) {
	return now - startedAt < maxRuntimeMs;
}

function cleanerMaxRuntimeMs() {
	const value = Number.parseInt(
		process.env.CLEANER_MAX_RUNTIME_MS ?? "180000",
		10,
	);
	if (!Number.isSafeInteger(value) || value < 30_000 || value > 600_000) {
		throw new Error("INVALID_CLEANER_MAX_RUNTIME_MS");
	}
	return value;
}

async function runDatabaseMode(mode: string, runId: string) {
	const projectCredentials = await readDatabaseSecret(
		required("PROJECT_DATABASE_SECRET_ARN"),
	);
	const masterPool = await createPerformancePool(
		required("MASTER_DATABASE_SECRET_ARN"),
	);
	try {
		if (mode === "verify-schema" || mode === "verify-schema-absent") {
			const exists = await performanceSchemaExists(masterPool, runId);
			if (exists !== (mode === "verify-schema")) {
				throw new Error("SCHEMA_VERIFICATION_FAILED");
			}
		} else if (mode === "cleanup-schema") {
			await cleanupPerformanceDatabase(
				masterPool,
				runId,
				projectCredentials.username,
			);
		} else {
			const migration = await readFile(
				new URL("./migrations/0002_performance.sql", import.meta.url),
				"utf8",
			);
			await initializePerformanceDatabase(
				masterPool,
				runId,
				projectCredentials,
				migration,
			);
		}
	} finally {
		await masterPool.end();
	}
}

export async function runCleaner() {
	const startedAt = Date.now();
	const runId = required("PERFORMANCE_RUN_ID");
	const mode = process.env.CLEANER_MODE;
	if (
		mode === "initialize-schema" ||
		mode === "cleanup-schema" ||
		mode === "verify-schema" ||
		mode === "verify-schema-absent"
	) {
		await runDatabaseMode(mode, runId);
		return;
	}

	const queueUrl = required("QUEUE_URL");
	const maxRuntimeMs = cleanerMaxRuntimeMs();
	const sqs = new SQSClient({});
	const pool = await createPerformancePool();
	const store = new PostgresPerformanceStore(pool, Date.now, runId);
	const summary: CleanerSummary = {
		processed: 0,
		inserted: 0,
		deduplicated: 0,
		discarded: 0,
		retryableFailures: 0,
		writeDurationMs: 0,
		durationMs: 0,
	};
	let emptyPolls = 0;

	try {
		while (emptyPolls < 2 && withinCleanerRuntime(startedAt, maxRuntimeMs)) {
			const batch = await sqs.send(
				new ReceiveMessageCommand({
					QueueUrl: queueUrl,
					MaxNumberOfMessages: 10,
					WaitTimeSeconds: 10,
					VisibilityTimeout: 60,
				}),
			);
			if (!batch.Messages?.length) {
				emptyPolls += 1;
				continue;
			}
			emptyPolls = 0;
			for (const message of batch.Messages) {
				if (!message.ReceiptHandle) continue;
				summary.processed += 1;
				try {
					const writeStartedAt = Date.now();
					const outcome = await store.insert(
						cleanPerformanceEvent(JSON.parse(message.Body ?? "")),
					);
					summary.writeDurationMs += Date.now() - writeStartedAt;
					summary[outcome] += 1;
					await sqs.send(
						new DeleteMessageCommand({
							QueueUrl: queueUrl,
							ReceiptHandle: message.ReceiptHandle,
						}),
					);
				} catch (error) {
					if (classifyCleanerError(error) === "discard") {
						summary.discarded += 1;
						await sqs.send(
							new DeleteMessageCommand({
								QueueUrl: queueUrl,
								ReceiptHandle: message.ReceiptHandle,
							}),
						);
					} else {
						summary.retryableFailures += 1;
					}
				}
			}
		}
	} finally {
		await pool.end();
	}

	summary.durationMs = Date.now() - startedAt;
	process.stdout.write(formatCleanerSummary(summary));
	if (
		summary.retryableFailures > 0 ||
		(emptyPolls < 2 && !withinCleanerRuntime(startedAt, maxRuntimeMs))
	) {
		process.exitCode = 2;
	}
}

const isEntrypoint = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1]
	: false;
if (isEntrypoint) {
	await runCleaner().catch((error: unknown) => {
		const code = error instanceof Error ? error.message : "CLEANER_FAILED";
		process.stderr.write(
			`${/^MISSING_[A-Z0-9_]+$/u.test(code) ? code : "CLEANER_FAILED"}\n`,
		);
		process.exitCode = 2;
	});
}
