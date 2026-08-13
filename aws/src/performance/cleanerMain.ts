import { readFile } from "node:fs/promises";
import {
	DeleteMessageCommand,
	ReceiveMessageCommand,
	SQSClient,
} from "@aws-sdk/client-sqs";
import { classifyCleanerError, cleanPerformanceEvent } from "./cleaner";
import {
	cleanupPerformanceDatabase,
	initializePerformanceDatabase,
} from "./databaseAccess";
import { createPerformancePool, readDatabaseSecret, required } from "./runtime";
import { PostgresPerformanceStore } from "./storage";

const queueUrl = required("QUEUE_URL");
const sqs = new SQSClient({});
const projectCredentials = await readDatabaseSecret(
	required("PROJECT_DATABASE_SECRET_ARN"),
);

if (
	process.env.CLEANER_MODE === "initialize-schema" ||
	process.env.CLEANER_MODE === "cleanup-schema"
) {
	const masterPool = await createPerformancePool(
		required("MASTER_DATABASE_SECRET_ARN"),
	);
	if (process.env.CLEANER_MODE === "cleanup-schema") {
		await cleanupPerformanceDatabase(masterPool, projectCredentials.username);
	} else {
		const migration = await readFile(
			new URL("./migrations/0002_performance.sql", import.meta.url),
			"utf8",
		);
		await initializePerformanceDatabase(
			masterPool,
			projectCredentials,
			migration,
		);
	}
	await masterPool.end();
	process.exit(0);
}
const pool = await createPerformancePool();
const store = new PostgresPerformanceStore(pool);
let emptyPolls = 0;
let retryableFailures = 0;

while (emptyPolls < 2) {
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
		try {
			await store.insert(cleanPerformanceEvent(JSON.parse(message.Body ?? "")));
			await sqs.send(
				new DeleteMessageCommand({
					QueueUrl: queueUrl,
					ReceiptHandle: message.ReceiptHandle,
				}),
			);
		} catch (error) {
			if (classifyCleanerError(error) === "discard") {
				await sqs.send(
					new DeleteMessageCommand({
						QueueUrl: queueUrl,
						ReceiptHandle: message.ReceiptHandle,
					}),
				);
			} else {
				retryableFailures += 1;
			}
		}
	}
}

await pool.end();
if (retryableFailures > 0) process.exitCode = 2;
