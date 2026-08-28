import { SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import type { PerformanceEvent } from "./pipeline";

type SqsBatchSender = {
	send(command: SendMessageBatchCommand): Promise<{
		Failed?: Array<{ Id?: string }>;
	}>;
};

const sqsBatchLimit = 10;

export async function enqueuePerformanceEvents(
	client: SqsBatchSender,
	queueUrl: string,
	events: PerformanceEvent[],
): Promise<void> {
	for (let offset = 0; offset < events.length; offset += sqsBatchLimit) {
		const chunk = events.slice(offset, offset + sqsBatchLimit);
		const result = await client.send(
			new SendMessageBatchCommand({
				QueueUrl: queueUrl,
				Entries: chunk.map((event, index) => ({
					Id: String(offset + index),
					MessageBody: JSON.stringify(event),
				})),
			}),
		);
		if (result.Failed?.length) {
			throw new Error("SQS_BATCH_PARTIAL_FAILURE");
		}
	}
}
