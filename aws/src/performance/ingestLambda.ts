import { SQSClient } from "@aws-sdk/client-sqs";
import { createPerformanceIngestHandler } from "./handlers";
import { required } from "./runtime";
import { enqueuePerformanceEvents } from "./sqsTransport";

const client = new SQSClient({});
export const handler = createPerformanceIngestHandler({
	originToken: required("ORIGIN_TOKEN"),
	enqueueBatch: (events) =>
		enqueuePerformanceEvents(client, required("QUEUE_URL"), events),
});
