export type PerformanceEventType =
	| "metric"
	| "resource"
	| "error"
	| "custom"
	| "web3"
	| "business";

export const businessOperationNames = [
	"business.growth.activity",
	"business.growth.transfer",
	"business.notebook.write",
	"business.babycoin.activity",
	"business.marketplace.approve",
	"business.marketplace.buy",
	"business.marketplace.content_unlock",
	"business.marketplace.completion_submit",
	"business.provider.create",
	"business.owner.approve",
	"business.owner.reject",
	"business.owner.completion_confirm",
	"business.keepsake.draw",
	"business.keepsake.fuse",
	"business.keepsake.recover",
	"business.exchange.quote",
	"business.exchange.swap",
	"business.identity.login",
	"business.identity.session",
	"business.profile.write",
] as const;

export type BusinessOperationName = (typeof businessOperationNames)[number];

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
	markBusinessOperation<T>(
		name: BusinessOperationName,
		operation: () => Promise<T>,
	): Promise<T>;
};
