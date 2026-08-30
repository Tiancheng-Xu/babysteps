import type { PerformanceClient, PerformanceEventInput } from "./types";

let runtimeClient:
	| Pick<PerformanceClient, "markOperation" | "record">
	| undefined;

export function setPerformanceClient(
	client: Pick<PerformanceClient, "markOperation" | "record">,
) {
	runtimeClient = client;
}

export function measurePerformance<T>(
	name: string,
	operation: () => Promise<T>,
): Promise<T> {
	return runtimeClient?.markOperation(name, operation) ?? operation();
}

export function recordPerformance(event: PerformanceEventInput): void {
	runtimeClient?.record(event);
}
