import type {
	BusinessOperationName,
	PerformanceClient,
	PerformanceEventInput,
} from "./types";

let runtimeClient:
	| Pick<
			PerformanceClient,
			"markOperation" | "markBusinessOperation" | "record"
	  >
	| undefined;

export function setPerformanceClient(
	client: Pick<
		PerformanceClient,
		"markOperation" | "markBusinessOperation" | "record"
	>,
) {
	runtimeClient = client;
}

export function measureBusinessPerformance<T>(
	name: BusinessOperationName,
	operation: () => Promise<T>,
): Promise<T> {
	return runtimeClient?.markBusinessOperation(name, operation) ?? operation();
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
