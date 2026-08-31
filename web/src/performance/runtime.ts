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

export type BusinessOperationLifecycle = {
	start(name: BusinessOperationName): boolean;
	succeed(): void;
	fail(): void;
	isPending(): boolean;
};

export function createBusinessOperationLifecycle(): BusinessOperationLifecycle {
	let pending:
		| {
				resolve: () => void;
				reject: (error: Error) => void;
		  }
		| undefined;

	return {
		start(name) {
			if (pending) return false;
			const operation = new Promise<void>((resolve, reject) => {
				pending = { resolve, reject };
			});
			void measureBusinessPerformance(name, () => operation).catch(
				() => undefined,
			);
			return true;
		},
		succeed() {
			const current = pending;
			pending = undefined;
			current?.resolve();
		},
		fail() {
			const current = pending;
			pending = undefined;
			current?.reject(new Error("business operation failed"));
		},
		isPending() {
			return pending !== undefined;
		},
	};
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
