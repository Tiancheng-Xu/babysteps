import type { PerformanceClient } from "./types";

let runtimeClient: Pick<PerformanceClient, "markOperation"> | undefined;

export function setPerformanceClient(
	client: Pick<PerformanceClient, "markOperation">,
) {
	runtimeClient = client;
}

export function measurePerformance<T>(
	name: string,
	operation: () => Promise<T>,
): Promise<T> {
	return runtimeClient?.markOperation(name, operation) ?? operation();
}
