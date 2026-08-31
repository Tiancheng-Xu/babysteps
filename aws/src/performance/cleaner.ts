import type { PerformanceEvent, StoredPerformanceEvent } from "./pipeline";

function normalizeRoute(route: string) {
	const [path] = route.split(/[?#]/, 1);
	const normalized = path
		.split("/")
		.map((segment) => {
			if (/^\d+$/.test(segment)) return ":id";
			if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ":id";
			if (/^0x[0-9a-f]{40}$/i.test(segment)) return ":id";
			return segment;
		})
		.join("/");
	return normalized || "/";
}

export function cleanPerformanceEvent(input: unknown): StoredPerformanceEvent {
	if (!input || typeof input !== "object")
		throw new Error("PERMANENT_SCHEMA_INVALID");
	const event = input as Record<string, unknown>;
	const required = [
		"eventId",
		"timestamp",
		"type",
		"name",
		"value",
		"unit",
		"route",
		"environment",
		"version",
	] as const;
	if (required.some((key) => event[key] === undefined)) {
		throw new Error("PERMANENT_SCHEMA_INVALID");
	}
	return {
		eventId: String(event.eventId),
		timestamp: Number(event.timestamp),
		type: event.type as PerformanceEvent["type"],
		name: String(event.name),
		value: Number(event.value),
		unit: event.unit as PerformanceEvent["unit"],
		...(event.category !== undefined
			? { category: event.category as PerformanceEvent["category"] }
			: {}),
		...(event.outcome !== undefined
			? { outcome: event.outcome as PerformanceEvent["outcome"] }
			: {}),
		route: normalizeRoute(String(event.route)),
		environment: String(event.environment),
		version: String(event.version),
	};
}

export function classifyCleanerError(error: unknown): "retry" | "discard" {
	return error instanceof Error && error.message.startsWith("PERMANENT_")
		? "discard"
		: "retry";
}
