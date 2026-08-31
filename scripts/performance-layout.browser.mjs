import assert from "node:assert/strict";
import { test } from "node:test";

import { chromium } from "playwright";

// Run through `pnpm visual:layout` so the deterministic local server lifecycle is isolated.

const dashboardUrl =
	process.env.PERFORMANCE_DASHBOARD_URL ??
	"http://127.0.0.1:4176/performance?mode=history";

const routeHeadings = [
	["/", "BabySteps · 成长星球"],
	["/tasks", "成长任务市集"],
	["/parent", "家长成长中心"],
	["/keepsakes", "星宝纪念馆"],
	["/provider", "机构与育婴师控制台"],
	["/exchange", "BabyCoin 兑换"],
	["/profile", "个人中心"],
	["/performance?mode=history", "BabySteps 性能观测站"],
	["/evidence", "链上工作证据"],
];

const testOrigin = new URL(dashboardUrl).origin;

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
		const rendering = await sectionBox(page, "渲染与路由");
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
			["rendering and routing", rendering],
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

test("all implemented product routes preserve HTTP semantics, headings, and root containment", async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		for (const width of [375, 390, 430, 1440]) {
			const page = await browser.newPage({
				viewport: { width, height: width === 1440 ? 1000 : 900 },
			});
			const pageErrors = [];
			page.on("pageerror", (error) => pageErrors.push(error.message));
			for (const [route, heading] of routeHeadings) {
				const errorsBefore = pageErrors.length;
				const response = await page.goto(
					new URL(route, testOrigin).toString(),
					{
						waitUntil: "domcontentloaded",
					},
				);
				assert.ok(
					response?.ok(),
					`${width}px ${route} must return HTTP success`,
				);
				await page
					.getByRole("heading", { name: heading, exact: true })
					.waitFor();
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - window.innerWidth,
				);
				assert.ok(
					overflow <= 1,
					`${width}px ${route} must not overflow the root`,
				);
				assert.equal(
					pageErrors.length,
					errorsBefore,
					`${width}px ${route} must not emit a pageerror`,
				);
			}
			await page.close();
		}
	} finally {
		await browser.close();
	}
});

test("the role architecture stays out of the first render and opens in a sandboxed responsive iframe", async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		for (const width of [375, 390, 430, 1440]) {
			const page = await browser.newPage({
				viewport: { width, height: width === 1440 ? 1000 : 900 },
			});
			const pageErrors = [];
			const roleArtifactRequests = [];
			const remoteFontRequests = [];
			page.on("pageerror", (error) => pageErrors.push(error.message));
			page.on("request", (request) => {
				if (
					request.resourceType() === "document" &&
					request.url().includes("babysteps-role-boundaries")
				) {
					roleArtifactRequests.push({
						url: request.url(),
						redirectedFrom: request.redirectedFrom()?.url() ?? null,
					});
				}
				if (/fonts\.googleapis\.com\/.*JetBrains\+Mono/u.test(request.url())) {
					remoteFontRequests.push(request.url());
				}
			});

			const response = await page.goto(
				new URL("/evidence", testOrigin).toString(),
				{
					waitUntil: "domcontentloaded",
				},
			);
			assert.ok(
				response?.ok(),
				`${width}px Evidence route must return HTTP success`,
			);
			await page
				.getByRole("heading", { name: "全角色与权限边界", exact: true })
				.waitFor();
			assert.equal(
				await page
					.locator('iframe[title="BabySteps 全角色与信任边界"]')
					.count(),
				0,
				`${width}px first render must not mount the role iframe`,
			);
			assert.deepEqual(
				roleArtifactRequests,
				[],
				`${width}px first render must not request the role artifact`,
			);

			await page.getByRole("button", { name: "打开全角色架构图" }).click();
			const iframe = page.locator('iframe[title="BabySteps 全角色与信任边界"]');
			await iframe.waitFor();
			assert.equal(
				await iframe.getAttribute("sandbox"),
				"allow-scripts allow-downloads",
			);
			await page
				.frameLocator('iframe[title="BabySteps 全角色与信任边界"]')
				.getByRole("heading", {
					name: "BabySteps 全角色与信任边界",
					exact: true,
				})
				.waitFor();
			const rootRoleArtifactRequests = roleArtifactRequests.filter(
				({ redirectedFrom }) => redirectedFrom === null,
			);
			assert.equal(
				rootRoleArtifactRequests.length,
				1,
				`${width}px click must start exactly one role artifact navigation`,
			);
			for (let index = 1; index < roleArtifactRequests.length; index += 1) {
				assert.equal(
					roleArtifactRequests[index].redirectedFrom,
					roleArtifactRequests[index - 1].url,
					`${width}px extra role artifact requests must belong to the same redirect chain`,
				);
			}
			assert.deepEqual(
				remoteFontRequests,
				[],
				`${width}px role artifact must not request remote fonts`,
			);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth,
			);
			assert.ok(
				overflow <= 1,
				`${width}px open role iframe must not overflow the root`,
			);
			await page.getByRole("button", { name: "关闭全角色架构图" }).click();
			assert.equal(await iframe.count(), 0);
			assert.deepEqual(
				pageErrors,
				[],
				`${width}px role architecture must not emit a pageerror`,
			);
			await page.close();
		}
	} finally {
		await browser.close();
	}
});
