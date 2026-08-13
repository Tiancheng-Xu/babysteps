import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createPerformanceIngestHandler } from "./handlers";
import { required } from "./runtime";

const client = new SQSClient({});
export const handler = createPerformanceIngestHandler({
	originToken: required("ORIGIN_TOKEN"),
	enqueueBatch: async (events) => {
		const result = await client.send(
			new SendMessageBatchCommand({
				QueueUrl: required("QUEUE_URL"),
				Entries: events.map((event, index) => ({
					Id: String(index),
					MessageBody: JSON.stringify(event),
				})),
			}),
		);
		if (result.Failed?.length) throw new Error("SQS_BATCH_PARTIAL_FAILURE");
	},
});
