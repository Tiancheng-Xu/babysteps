import { describe, expect, it, vi } from "vitest";

import { createPagesHandler, type PagesEnvironment } from "./pages-worker";

const template =
	'<!doctype html><html><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';

function environment(): PagesEnvironment {
	return {
		ASSETS: {
			fetch: vi.fn(async (request: Request) => {
				const path = new URL(request.url).pathname;
				if (path === "/index.html") {
					return new Response(template, {
						headers: { "content-type": "text/html" },
					});
				}
				return new Response("asset", {
					status: path.includes("missing") ? 404 : 200,
				});
			}),
		},
	};
}

function appStream(markup: string): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(markup));
			controller.close();
		},
	});
}

describe("Cloudflare Pages SSR worker", () => {
	it("passes static assets through without masking their status", async () => {
		const env = environment();
		const handler = createPagesHandler({
			render: vi.fn(async () => appStream("unused")),
		});
		const response = await handler.fetch(
			new Request("https://example.test/assets/missing.js"),
			env,
		);
		expect(response.status).toBe(404);
		expect(response.headers.get("x-babysteps-render-mode")).toBeNull();
	});

	it("returns SSR generated through React Web Streams with truthful headers", async () => {
		const handler = createPagesHandler({
			render: vi.fn(async () => appStream("<h1>星宝纪念馆</h1>")),
			version: "test-build",
		});
		const response = await handler.fetch(
			new Request("https://example.test/keepsakes", {
				headers: { accept: "text/html" },
			}),
			environment(),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("x-babysteps-render-mode")).toBe("ssr");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(await response.text()).toContain("<h1>星宝纪念馆</h1>");
	});

	it("keeps unknown document routes as HTTP 404", async () => {
		const handler = createPagesHandler({
			render: vi.fn(async () => appStream("<h1>页面没有找到</h1>")),
		});
		const response = await handler.fetch(
			new Request("https://example.test/unknown", {
				headers: { accept: "text/html" },
			}),
			environment(),
		);
		expect(response.status).toBe(404);
		expect(await response.text()).toContain("页面没有找到");
	});

	it("falls back to pure CSR when SSR fails", async () => {
		const handler = createPagesHandler({
			render: vi.fn(async () => {
				throw new Error("render failed");
			}),
			version: "test-build",
		});
		const response = await handler.fetch(
			new Request("https://example.test/profile", {
				headers: { accept: "text/html" },
			}),
			environment(),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("x-babysteps-render-mode")).toBe(
			"csr-fallback",
		);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.text()).toContain(
			'<div id="root" data-render-mode="csr-fallback"></div>',
		);
	});

	it("aborts a stalled SSR request and returns the same CSR recovery shell", async () => {
		let aborted = false;
		const handler = createPagesHandler({
			timeoutMs: 5,
			render: vi.fn(
				(_pathname, signal) =>
					new Promise<ReadableStream<Uint8Array>>((_resolve) => {
						signal.addEventListener("abort", () => {
							aborted = true;
						});
					}),
			),
		});
		const response = await handler.fetch(
			new Request("https://example.test/tasks", {
				headers: { accept: "text/html" },
			}),
			environment(),
		);
		expect(aborted).toBe(true);
		expect(response.headers.get("x-babysteps-render-mode")).toBe(
			"csr-fallback",
		);
	});

	it("falls back when the SSR stream stalls after it is created", async () => {
		const handler = createPagesHandler({
			timeoutMs: 5,
			render: vi.fn(async () => new ReadableStream<Uint8Array>()),
		});
		const response = await handler.fetch(
			new Request("https://example.test/tasks", {
				headers: { accept: "text/html" },
			}),
			environment(),
		);
		expect(response.headers.get("x-babysteps-render-mode")).toBe(
			"csr-fallback",
		);
		expect(await response.text()).toContain('data-render-mode="csr-fallback"');
	});

	it("falls back when the SSR stream errors after it is created", async () => {
		const handler = createPagesHandler({
			render: vi.fn(
				async () =>
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.error(new Error("late stream failure"));
						},
					}),
			),
		});
		const response = await handler.fetch(
			new Request("https://example.test/tasks", {
				headers: { accept: "text/html" },
			}),
			environment(),
		);
		expect(response.headers.get("x-babysteps-render-mode")).toBe(
			"csr-fallback",
		);
	});

	it("treats trailing-slash routes as valid documents", async () => {
		const handler = createPagesHandler({
			render: vi.fn(async () => appStream("<h1>个人中心</h1>")),
		});
		const response = await handler.fetch(
			new Request("https://example.test/profile/", {
				headers: { accept: "text/html" },
			}),
			environment(),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	it("disables shared document caching for authenticated or queried requests", async () => {
		const handler = createPagesHandler({
			render: vi.fn(async () => appStream("<h1>任务</h1>")),
		});
		for (const request of [
			new Request("https://example.test/tasks", {
				headers: { accept: "text/html", authorization: "Bearer test" },
			}),
			new Request("https://example.test/tasks?preview=1", {
				headers: { accept: "text/html" },
			}),
		]) {
			const response = await handler.fetch(request, environment());
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(response.headers.get("vary")).toContain("Accept");
		}
	});
});
