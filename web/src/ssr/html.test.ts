import { describe, expect, it } from "vitest";

import { buildCsrFallbackDocument, composeSsrDocument } from "./html";

const template =
	'<!doctype html><html><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';

async function read(stream: ReadableStream<Uint8Array>): Promise<string> {
	return new Response(stream).text();
}

describe("SSR HTML composition", () => {
	it("streams React markup into the built client template", async () => {
		const app = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("<h1>星宝纪念馆</h1>"));
				controller.close();
			},
		});
		const document = await read(
			composeSsrDocument(template, app, {
				mode: "ssr",
				pathname: "/keepsakes",
				version: "v1",
			}),
		);

		expect(document).toContain(
			'<div id="root" data-render-mode="ssr"><h1>星宝纪念馆</h1></div>',
		);
		expect(document).toContain('id="__BABYSTEPS_RENDER_STATE__"');
		expect(document).toContain("/assets/app.js");
	});

	it("builds a non-hydrating CSR fallback without inventing server content", () => {
		const document = buildCsrFallbackDocument(template, {
			mode: "csr-fallback",
			pathname: "/profile",
			version: "v1",
		});
		expect(document).toContain(
			'<div id="root" data-render-mode="csr-fallback"></div>',
		);
		expect(document).not.toContain('data-render-mode="ssr"');
	});

	it("rejects a template without the exact root boundary", () => {
		expect(() =>
			buildCsrFallbackDocument("<html><body></body></html>", {
				mode: "csr-fallback",
				pathname: "/",
				version: "v1",
			}),
		).toThrow(/root marker/u);
	});
});
