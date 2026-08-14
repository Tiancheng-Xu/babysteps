import { describe, expect, it } from "vitest";

import { classifyRequest } from "./requestPolicy";

describe("Pages SSR request policy", () => {
	it("passes the API namespace root through to the asset binding", () => {
		expect(
			classifyRequest(
				new Request("https://babysteps.example/api", {
					headers: { accept: "text/html" },
				}),
			),
		).toEqual({ kind: "asset" });
	});

	it("renders allowlisted document routes", () => {
		expect(
			classifyRequest(
				new Request("https://babysteps.example/keepsakes", {
					headers: { accept: "text/html" },
				}),
			),
		).toEqual({ kind: "document", status: 200 });
	});

	it("keeps unknown documents as real 404 SSR pages", () => {
		expect(
			classifyRequest(
				new Request("https://babysteps.example/missing", {
					headers: { accept: "text/html" },
				}),
			),
		).toEqual({ kind: "document", status: 404 });
	});

	it("never rewrites assets, API routes, non-HTML or mutation requests", () => {
		for (const request of [
			new Request("https://babysteps.example/assets/app.js"),
			new Request("https://babysteps.example/metadata/card.json"),
			new Request("https://babysteps.example/api/health", {
				headers: { accept: "text/html" },
			}),
			new Request("https://babysteps.example/tasks", {
				headers: { accept: "application/json" },
			}),
			new Request("https://babysteps.example/tasks", {
				method: "POST",
				headers: { accept: "text/html" },
			}),
		]) {
			expect(classifyRequest(request)).toEqual({ kind: "asset" });
		}
	});
});
