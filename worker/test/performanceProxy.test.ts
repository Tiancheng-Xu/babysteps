import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";

const configuredEnv = {
	...env,
	PERFORMANCE_API_URL: "https://metrics.example.test",
	PERFORMANCE_ORIGIN_TOKEN: "server-only-token",
};

const browserHeaders = {
	"content-type": "application/json",
	origin: "https://babysteps.baby2b.online",
};

describe("performance same-origin proxy", () => {
	it("forwards the bounded event endpoint with server-only authentication", async () => {
		const upstream = vi.fn(
			async (_request: Request) =>
				new Response('{"accepted":1}', { status: 202 }),
		);
		const app = createApp({ performanceFetch: upstream });
		const response = await app.request(
			"/api/performance/events",
			{
				method: "POST",
				headers: browserHeaders,
				body: JSON.stringify({
					schemaVersion: 1,
					events: [{ route: "/performance" }],
				}),
			},
			configuredEnv,
		);

		expect(response.status).toBe(202);
		const request = upstream.mock.calls[0]?.[0] as Request;
		expect(request.url).toBe("https://metrics.example.test/events");
		expect(request.headers.get("x-babysteps-origin-token")).toBe(
			"server-only-token",
		);
		expect(request.headers.get("x-request-id")).toBeTruthy();
		expect(await request.text()).not.toContain("server-only-token");
	});

	it("preserves a configured API Gateway stage path", async () => {
		const upstream = vi.fn(
			async (_request: Request) => new Response(null, { status: 202 }),
		);
		const app = createApp({ performanceFetch: upstream });
		const response = await app.request(
			"/api/performance/events",
			{
				method: "POST",
				headers: browserHeaders,
				body: JSON.stringify({ schemaVersion: 1, events: [{ route: "/" }] }),
			},
			{
				...configuredEnv,
				PERFORMANCE_API_URL: "https://metrics.example.test/prod",
			},
		);

		expect(response.status).toBe(202);
		const forwardedRequest = upstream.mock.calls[0]?.[0];
		expect(forwardedRequest).toBeInstanceOf(Request);
		expect((forwardedRequest as Request).url).toBe(
			"https://metrics.example.test/prod/events",
		);
	});

	it("enforces a server-side per-minute event quota before AWS forwarding", async () => {
		await env.DB.prepare("DELETE FROM performance_rate_limits").run();
		const upstream = vi.fn(
			async (_request: Request) => new Response(null, { status: 202 }),
		);
		const app = createApp({ performanceFetch: upstream });
		const eventBatch = {
			method: "POST",
			headers: browserHeaders,
			body: JSON.stringify({
				schemaVersion: 1,
				events: Array.from({ length: 20 }, () => ({ route: "/performance" })),
			}),
		};
		let response = new Response();
		for (let index = 0; index < 7; index += 1) {
			response = await app.request(
				"/api/performance/events",
				eventBatch,
				configuredEnv,
			);
		}
		expect(response.status).toBe(429);
		expect(upstream).toHaveBeenCalledTimes(6);
	});

	it("rejects non-HTTPS upstreams, foreign origins and PII-shaped routes", async () => {
		const upstream = vi.fn();
		const app = createApp({ performanceFetch: upstream });
		const insecure = await app.request(
			"/api/performance/events",
			{ method: "POST", headers: browserHeaders, body: "{}" },
			{ ...configuredEnv, PERFORMANCE_API_URL: "http://metrics.example.test" },
		);
		const foreign = await app.request(
			"/api/performance/events",
			{
				method: "POST",
				headers: { ...browserHeaders, origin: "https://evil.example" },
				body: "{}",
			},
			configuredEnv,
		);
		const pii = await app.request(
			"/api/performance/events",
			{
				method: "POST",
				headers: browserHeaders,
				body: JSON.stringify({
					schemaVersion: 1,
					events: [{ route: "/users/alice@example.com" }],
				}),
			},
			configuredEnv,
		);

		expect(insecure.status).toBe(503);
		expect(foreign.status).toBe(403);
		expect(pii.status).toBe(400);
		expect(upstream).not.toHaveBeenCalled();
	});

	it("forwards only allowlisted query filters", async () => {
		const upstream = vi.fn(async (request: Request) =>
			Response.json({ url: request.url }),
		);
		const app = createApp({ performanceFetch: upstream });
		const response = await app.request(
			"/api/performance/stats?window=24h&route=%2Ftasks&metric=LCP&token=leak",
			undefined,
			configuredEnv,
		);
		const body = await response.json<{ url: string }>();

		expect(body.url).toContain("window=24h");
		expect(body.url).toContain("route=%2Ftasks");
		expect(body.url).toContain("metric=LCP");
		expect(body.url).not.toContain("token");
	});

	it("fails safely when unconfigured or upstream is unavailable", async () => {
		const unconfigured = await createApp().request(
			"/api/performance/stats",
			undefined,
			env,
		);
		expect(unconfigured.status).toBe(503);

		const app = createApp({
			performanceFetch: vi
				.fn()
				.mockRejectedValue(new Error("secret internal URL")),
		});
		const failed = await app.request(
			"/api/performance/stats",
			undefined,
			configuredEnv,
		);
		expect(failed.status).toBe(502);
		expect(await failed.text()).not.toContain("secret internal URL");
	});

	it("rejects unsupported methods and oversized batches before forwarding", async () => {
		const upstream = vi.fn();
		const app = createApp({ performanceFetch: upstream });
		const method = await app.request(
			"/api/performance/events",
			{ method: "PUT" },
			configuredEnv,
		);
		const oversized = await app.request(
			"/api/performance/events",
			{ method: "POST", headers: browserHeaders, body: "x".repeat(131_073) },
			configuredEnv,
		);

		expect(method.status).toBe(404);
		expect(oversized.status).toBe(413);
		expect(upstream).not.toHaveBeenCalled();
	});
});
