export type PerformanceEventType =
	| "metric"
	| "resource"
	| "error"
	| "custom"
	| "web3";

export type PerformanceUnit = "ms" | "score" | "count";

export type PerformanceOutcome = "success" | "failure" | "unavailable";

export type PerformanceCategory =
	| "fetch"
	| "xhr"
	| "script"
	| "stylesheet"
	| "image"
	| "font"
	| "type_error"
	| "network"
	| "timeout"
	| "user_rejected"
	| "unknown";

export type PerformanceEventInput = {
	type: PerformanceEventType;
	name: string;
	value: number;
	unit: PerformanceUnit;
	category?: PerformanceCategory;
	outcome?: PerformanceOutcome;
};

export type PerformanceEvent = PerformanceEventInput & {
	eventId: string;
	timestamp: number;
	route: string;
	environment: string;
	version: string;
};

export type PerformanceBatch = {
	schemaVersion: 1 | 2;
	sentAt: number;
	events: PerformanceEvent[];
};

export type PerformanceClient = {
	start(): void;
	stop(): void;
	record(event: PerformanceEventInput): void;
	flush(): Promise<void>;
	markOperation<T>(name: string, operation: () => Promise<T>): Promise<T>;
};
