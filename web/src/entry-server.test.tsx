import { describe, expect, it } from "vitest";

import { renderRouteStream } from "./entry-server";

describe("edge SSR route rendering", () => {
	it("renders public HTML without browser wallet state", async () => {
		const controller = new AbortController();
		const html = await new Response(
			await renderRouteStream("/", controller.signal),
		).text();
		expect(html).toContain("BabySteps · 成长星球");
		expect(html).toContain("连接测试钱包后继续链上成长");
		expect(html).not.toContain("可用 BabyCoin");
		expect(html).not.toMatch(/authorization|cookie|private key/iu);
	});

	it("renders a deterministic client-only shell for identity routes", async () => {
		const controller = new AbortController();
		const html = await new Response(
			await renderRouteStream("/profile", controller.signal),
		).text();
		expect(html).toContain("个人中心");
		expect(html).toContain("身份、钱包和实时链上数据只在浏览器中加载");
		expect(html).not.toContain("Privy 待配置");
	});
});
