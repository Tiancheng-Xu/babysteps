import { describe, expect, it } from "vitest";

import {
	parseRenderState,
	type RenderState,
	safeSerializeRenderState,
} from "./renderState";

describe("SSR render state", () => {
	it("escapes executable HTML and Unicode separators", () => {
		const state: RenderState = {
			mode: "ssr",
			pathname: "/<script>&\u2028\u2029",
			version: "build<1>",
		};
		const serialized = safeSerializeRenderState(state);

		expect(serialized).not.toContain("<script>");
		expect(serialized).not.toContain("</script>");
		expect(serialized).not.toContain("\u2028");
		expect(serialized).not.toContain("\u2029");
		expect(parseRenderState(serialized)).toEqual(state);
	});

	it("rejects user-shaped or invalid boot state", () => {
		expect(
			parseRenderState(
				JSON.stringify({
					mode: "ssr",
					pathname: "/",
					version: "v1",
					wallet: "0xprivate",
				}),
			),
		).toBeUndefined();
		expect(parseRenderState("not-json")).toBeUndefined();
	});
});
