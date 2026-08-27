import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { z } from "zod";
import {
	acceptPerformanceBatch,
	computePerformanceOverview,
	computePerformanceStats,
	type PerformanceEvent,
	PerformanceRequestError,
	type StoredPerformanceEvent,
} from "./pipeline";
import type { PerformanceFilters } from "./storage";

type JsonResponse = {
	statusCode: number;
	headers: Record<string, string>;
	body: string;
};
const filtersSchema = z.object({
	window: z.enum(["1h", "24h", "7d"]).default("24h"),
	route: z.string().max(160).optional(),
	metric: z.string().max(64).default("LCP"),
	environment: z.string().max(32).optional(),
	version: z.string().max(64).optional(),
});

const windowMilliseconds = {
	"1h": 3_600_000,
	"24h": 86_400_000,
	"7d": 604_800_000,
} as const;

const response = (statusCode: number, body: unknown): JsonResponse => ({
	statusCode,
	headers: { "content-type": "application/json", "cache-control": "no-store" },
	body: JSON.stringify(body),
});

export function createPerformanceIngestHandler(dependencies: {
	originToken: string;
	enqueueBatch: (events: PerformanceEvent[]) => Promise<void>;
	now?: () => number;
}) {
	return async (
		event: Pick<APIGatewayProxyEventV2, "body" | "headers" | "isBase64Encoded">,
	): Promise<JsonResponse> => {
		try {
			const rawBody = event.body
				? event.isBase64Encoded
					? Buffer.from(event.body, "base64").toString("utf8")
					: event.body
				: "";
			const body: unknown = JSON.parse(rawBody);
			const result = await acceptPerformanceBatch({
				originToken: dependencies.originToken,
				providedToken: Object.entries(event.headers).find(
					([key]) => key.toLowerCase() === "x-babysteps-origin-token",
				)?.[1],
				body,
				now: dependencies.now?.() ?? Date.now(),
				enqueueBatch: dependencies.enqueueBatch,
			});
			return response(202, result);
		} catch (error) {
			if (error instanceof PerformanceRequestError)
				return response(error.status, { error: error.message });
			if (error instanceof SyntaxError)
				return response(400, { error: "invalid request" });
			return response(503, { error: "ingest unavailable" });
		}
	};
}

export function createPerformanceQueryHandler(dependencies: {
	originToken: string;
	query: (filters: PerformanceFilters) => Promise<StoredPerformanceEvent[]>;
	now?: () => number;
}) {
	return async (
		event: Pick<
			APIGatewayProxyEventV2,
			"headers" | "rawPath" | "queryStringParameters"
		>,
	): Promise<JsonResponse> => {
		const providedToken = Object.entries(event.headers).find(
			([key]) => key.toLowerCase() === "x-babysteps-origin-token",
		)?.[1];
		if (!providedToken || providedToken !== dependencies.originToken) {
			return response(401, { error: "origin authentication failed" });
		}
		const parsed = filtersSchema.safeParse(event.queryStringParameters ?? {});
		if (!parsed.success) return response(400, { error: "invalid filters" });
		try {
			const events = await dependencies.query(parsed.data);
			if (parsed.data.metric === "all") {
				const now = dependencies.now?.() ?? Date.now();
				return response(200, {
					schemaVersion: "performance-overview/v2",
					window: {
						preset: parsed.data.window,
						from: new Date(
							now - windowMilliseconds[parsed.data.window],
						).toISOString(),
						to: new Date(now).toISOString(),
					},
					filters: Object.fromEntries(
						Object.entries(parsed.data).filter(
							([key, value]) => key !== "metric" && value !== undefined,
						),
					),
					...computePerformanceOverview(events),
				});
			}
			return response(200, {
				window: parsed.data.window,
				...computePerformanceStats(events, parsed.data.metric),
			});
		} catch {
			return response(503, { error: "statistics unavailable" });
		}
	};
}
