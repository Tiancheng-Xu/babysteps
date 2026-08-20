import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";

const expectedTables = [
	"audit_logs",
	"auth_challenges",
	"comments",
	"completion_submissions",
	"performance_rate_limits",
	"profiles",
	"published_tasks",
	"sessions",
	"task_drafts",
];

describe("Worker health and D1 schema", () => {
	it("returns the service and schema version", async () => {
		const response = await app.request("/api/health", undefined, env);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: "ok",
			service: "babysteps-worker",
			schemaVersion: 1,
		});
	});

	it("allows credentialed API requests only from the configured application", async () => {
		const allowed = await app.request(
			"/api/health",
			{
				method: "OPTIONS",
				headers: {
					Origin: "https://babysteps.baby2b.online",
					"Access-Control-Request-Method": "GET",
				},
			},
			env,
		);
		expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://babysteps.baby2b.online",
		);
		expect(allowed.headers.get("Access-Control-Allow-Credentials")).toBe(
			"true",
		);

		const rejected = await app.request(
			"/api/health",
			{
				method: "OPTIONS",
				headers: {
					Origin: "https://example.invalid",
					"Access-Control-Request-Method": "GET",
				},
			},
			env,
		);
		expect(rejected.headers.has("Access-Control-Allow-Origin")).toBe(false);
	});

	it("allows the profile PUT request through the browser preflight", async () => {
		const response = await app.request(
			"/api/profile",
			{
				method: "OPTIONS",
				headers: {
					Origin: "https://babysteps.baby2b.online",
					"Access-Control-Request-Method": "PUT",
					"Access-Control-Request-Headers": "content-type",
				},
			},
			env,
		);

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
			"PUT",
		);
	});

	it("applies all initial tables and critical indexes", async () => {
		const tables = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' AND name <> 'd1_migrations' ORDER BY name",
		).all<{ name: string }>();
		const indexes = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name",
		).all<{ name: string }>();

		expect(tables.results.map(({ name }) => name)).toEqual(expectedTables);
		expect(indexes.results.map(({ name }) => name)).toEqual(
			expect.arrayContaining([
				"idx_audit_resource",
				"idx_challenges_lookup",
				"idx_comments_visible",
				"idx_published_chain_task",
				"idx_sessions_token",
			]),
		);
	});

	it("returns a stable error envelope for unknown routes", async () => {
		const response = await app.request("/missing", undefined, env);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "NOT_FOUND",
				message: "Route not found",
			},
		});
	});
});
