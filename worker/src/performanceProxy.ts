import { Hono } from "hono";
import type { WorkerApp } from "./auth/session";
import { AppError } from "./http/errors";

type PerformanceBindings = {
	PERFORMANCE_API_URL?: string;
	PERFORMANCE_ORIGIN_TOKEN?: string;
};

export type PerformanceFetch = (request: Request) => Promise<Response>;

const MAX_BODY_BYTES = 128 * 1024;
const PII_PATTERN = /@|%40|(?:bearer|authorization|cookie|token|password)/iu;
const MAX_EVENTS_PER_MINUTE = 120;
const MAX_QUERIES_PER_MINUTE = 60;
const ALLOWED_QUERY_KEYS = new Set([
	"window",
	"route",
	"metric",
	"environment",
	"version",
]);

function readPerformanceConfig(env: Env): {
	apiUrl: string;
	originToken: string;
} {
	const bindings = env as Env & PerformanceBindings;
	const apiUrl = bindings.PERFORMANCE_API_URL?.trim();
	const originToken = bindings.PERFORMANCE_ORIGIN_TOKEN?.trim();
	if (!apiUrl || !originToken) {
		throw new AppError(
			503,
			"PERFORMANCE_UNAVAILABLE",
			"Performance service is unavailable",
		);
	}

	try {
		const parsed = new URL(apiUrl);
		if (parsed.protocol !== "https:") throw new Error("HTTPS_REQUIRED");
		return {
			apiUrl: parsed.toString().replace(/\/$/u, ""),
			originToken,
		};
	} catch {
		throw new AppError(
			503,
			"PERFORMANCE_UNAVAILABLE",
			"Performance service is unavailable",
		);
	}
}

async function consumeQuota(
	database: D1Database,
	quotaKey: "events" | "queries",
	units: number,
	limit: number,
) {
	const minuteBucket = Math.floor(Date.now() / 60_000);
	const result = await database
		.prepare(
			`INSERT INTO performance_rate_limits (quota_key, minute_bucket, units)
			 VALUES (?, ?, ?)
			 ON CONFLICT(quota_key, minute_bucket) DO UPDATE SET units = units + excluded.units
			 RETURNING units`,
		)
		.bind(quotaKey, minuteBucket, units)
		.first<{ units: number }>();
	if ((result?.units ?? limit + 1) > limit) {
		throw new AppError(
			429,
			"PERFORMANCE_RATE_LIMITED",
			"Performance request quota exceeded",
		);
	}
}

async function forward(
	request: Request,
	env: Env,
	requestId: string,
	path: "/events" | "/stats",
	performanceFetch: PerformanceFetch,
): Promise<Response> {
	const config = readPerformanceConfig(env);
	const sourceUrl = new URL(request.url);
	const upstreamUrl = new URL(`${config.apiUrl.replace(/\/$/u, "")}${path}`);
	if (path === "/stats") {
		await consumeQuota(env.DB, "queries", 1, MAX_QUERIES_PER_MINUTE);
		for (const [key, value] of sourceUrl.searchParams) {
			if (ALLOWED_QUERY_KEYS.has(key)) upstreamUrl.searchParams.set(key, value);
		}
	}

	const headers = new Headers({
		accept: "application/json",
		"x-babysteps-origin-token": config.originToken,
		"x-request-id": requestId,
	});
	let body: string | undefined;
	if (path === "/events") {
		const expectedOrigin = new URL((env as Env & { APP_URI: string }).APP_URI)
			.origin;
		if (request.headers.get("origin") !== expectedOrigin) {
			throw new AppError(403, "PERFORMANCE_ORIGIN_DENIED", "Origin denied");
		}
		body = await request.text();
		if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
			throw new AppError(
				413,
				"PERFORMANCE_BATCH_TOO_LARGE",
				"Performance event batch is too large",
			);
		}
		if (PII_PATTERN.test(body)) {
			throw new AppError(
				400,
				"PERFORMANCE_PII_REJECTED",
				"Performance event contains a forbidden field",
			);
		}
		let eventCount = 0;
		try {
			const parsed = JSON.parse(body) as { events?: unknown[] };
			eventCount = Array.isArray(parsed.events) ? parsed.events.length : 0;
		} catch {
			throw new AppError(400, "PERFORMANCE_JSON_INVALID", "Invalid JSON");
		}
		await consumeQuota(env.DB, "events", eventCount, MAX_EVENTS_PER_MINUTE);
		headers.set("content-type", "application/json");
	}

	try {
		const response = await performanceFetch(
			new Request(upstreamUrl, {
				method: path === "/events" ? "POST" : "GET",
				headers,
				body,
			}),
		);
		return new Response(response.body, {
			status: response.status,
			headers: {
				"content-type":
					response.headers.get("content-type") ?? "application/json",
			},
		});
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw new AppError(
			502,
			"PERFORMANCE_UPSTREAM_FAILED",
			"Performance service request failed",
		);
	}
}

export function createPerformanceRoutes(
	performanceFetch: PerformanceFetch = (request) => fetch(request),
) {
	const routes = new Hono<WorkerApp>();
	routes.post("/events", (context) =>
		forward(
			context.req.raw,
			context.env,
			context.get("requestId"),
			"/events",
			performanceFetch,
		),
	);
	routes.get("/stats", (context) =>
		forward(
			context.req.raw,
			context.env,
			context.get("requestId"),
			"/stats",
			performanceFetch,
		),
	);
	return routes;
}
