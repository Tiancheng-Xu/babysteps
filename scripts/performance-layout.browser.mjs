import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "playwright";

// Run through `pnpm visual:layout` so the deterministic local server lifecycle is isolated.

const dashboardUrl =
	process.env.PERFORMANCE_DASHBOARD_URL ??
	"http://127.0.0.1:4176/performance?mode=history";

async function sectionBox(page, heading) {
	return page
		.getByRole("heading", { name: heading, exact: true })
		.evaluate((element) => {
			const section = element.closest("section");
			if (!section)
				throw new Error(`missing section for ${element.textContent}`);
			const rect = section.getBoundingClientRect();
			return {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
			};
		});
}

test("performance modules use priority and content density instead of equal half-width cards", async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({
			viewport: { width: 1440, height: 1000 },
		});
		const pageErrors = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));
		const response = await page.goto(dashboardUrl, {
			waitUntil: "domcontentloaded",
		});
		assert.ok(response?.ok(), "performance route must return HTTP success");
		await page.getByRole("heading", { name: "Core Web Vitals" }).waitFor();

		const cockpit = await page.locator(".performance-cockpit").boundingBox();
		assert.ok(cockpit, "performance cockpit must render");

		const overview = await sectionBox(page, "运行状态与总览");
		const vitals = await sectionBox(page, "Core Web Vitals");
		const navigation = await sectionBox(page, "导航阶段");
		const trends = await sectionBox(page, "趋势与版本");
		const routes = await sectionBox(page, "页面路径");
		const resources = await sectionBox(page, "资源与主线程");
		const errors = await sectionBox(page, "稳定性错误");
		const web3 = await sectionBox(page, "Web3 操作");
		const pipeline = await sectionBox(page, "AWS 管道健康");
		const evidence = await sectionBox(page, "Evidence 与口径");

		for (const [name, box] of [
			["overview", overview],
			["Core Web Vitals", vitals],
			["navigation", navigation],
			["resources", resources],
			["stability errors", errors],
			["Web3 operations", web3],
		]) {
			assert.ok(
				box.width >= cockpit.width * 0.9,
				`${name} must use the full dashboard width`,
			);
		}

		for (const [left, right, label] of [
			[trends, routes, "trend and route analysis"],
			[pipeline, evidence, "pipeline and evidence notes"],
		]) {
			assert.ok(
				Math.abs(left.y - right.y) <= 2,
				`${label} must share a desktop row`,
			);
			assert.ok(
				Math.abs(left.width - right.width) <= 2,
				`${label} must use balanced desktop columns`,
			);
		}
		assert.deepEqual(pageErrors, [], "desktop route must not emit page errors");
	} finally {
		await browser.close();
	}
});

test("performance modules stack without root overflow on supported mobile widths", async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		for (const width of [375, 390, 430]) {
			const page = await browser.newPage({
				viewport: { width, height: 900 },
			});
			const pageErrors = [];
			page.on("pageerror", (error) => pageErrors.push(error.message));
			const response = await page.goto(dashboardUrl, {
				waitUntil: "domcontentloaded",
			});
			assert.ok(response?.ok(), `${width}px route must return HTTP success`);
			await page.getByRole("heading", { name: "Core Web Vitals" }).waitFor();

			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth,
			);
			assert.ok(
				overflow <= 1,
				`${width}px viewport must not overflow the root`,
			);

			const overview = await sectionBox(page, "运行状态与总览");
			const vitals = await sectionBox(page, "Core Web Vitals");
			assert.ok(
				vitals.y > overview.y + overview.height,
				`${width}px viewport must stack priority modules`,
			);
			assert.deepEqual(
				pageErrors,
				[],
				`${width}px route must not emit page errors`,
			);
			await page.close();
		}
	} finally {
		await browser.close();
	}
});
