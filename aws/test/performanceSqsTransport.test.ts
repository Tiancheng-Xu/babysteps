import type { SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { describe, expect, it, vi } from "vitest";
import type { PerformanceEvent } from "../src/performance/pipeline";
import { enqueuePerformanceEvents } from "../src/performance/sqsTransport";

function event(index: number): PerformanceEvent {
	return {
		eventId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
		timestamp: 1_787_906_238_514,
		type: "metric",
		name: "LCP",
		value: index,
		unit: "ms",
		route: "/performance",
		environment: "production",
		version: "963a11baa4b2",
	};
}

describe("performance SQS transport", () => {
	it("chunks accepted events into the AWS maximum of ten entries", async () => {
		const commands: SendMessageBatchCommand[] = [];
		const send = vi.fn(async (command: SendMessageBatchCommand) => {
			commands.push(command);
			return { Failed: [] };
		});
		const events = Array.from({ length: 23 }, (_, index) => event(index));

		await enqueuePerformanceEvents(
			{ send },
			"https://sqs.example/queue",
			events,
		);

		expect(send).toHaveBeenCalledTimes(3);
		expect(commands.map((command) => command.input.Entries?.length)).toEqual([
			10, 10, 3,
		]);
		expect(
			commands.flatMap((command) =>
				(command.input.Entries ?? []).map(
					({ MessageBody }) => JSON.parse(MessageBody ?? "null").eventId,
				),
			),
		).toEqual(events.map(({ eventId }) => eventId));
	});

	it("fails closed when any SQS chunk reports a partial failure", async () => {
		let call = 0;
		const send = vi.fn(
			async (
				_command: SendMessageBatchCommand,
			): Promise<{ Failed?: Array<{ Id?: string }> }> => {
				call += 1;
				return call === 2 ? { Failed: [{ Id: "10" }] } : { Failed: [] };
			},
		);

		await expect(
			enqueuePerformanceEvents(
				{ send },
				"https://sqs.example/queue",
				Array.from({ length: 11 }, (_, index) => event(index)),
			),
		).rejects.toThrow("SQS_BATCH_PARTIAL_FAILURE");
	});
});
