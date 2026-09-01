import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const onReady = require("../backstop_data/engine_scripts/playwright/onReady.cjs");

async function withPage(markup, run) {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		locale: "zh-CN",
		timezoneId: "UTC",
		viewport: { width: 375, height: 900 },
	});
	const page = await context.newPage();
	try {
		await page.setContent(markup, { waitUntil: "domcontentloaded" });
		await run(page);
	} finally {
		await browser.close();
	}
}

test("visual readiness rejects a page with root-level horizontal overflow", async () => {
	await withPage('<main style="width: 500px">overflow</main>', async (page) => {
		await assert.rejects(onReady(page), /root horizontal overflow: \d+px/u);
	});
});

test("visual readiness rejects an uncaught page error emitted while settling", async () => {
	await withPage("<main>ready</main>", async (page) => {
		setTimeout(() => {
			page
				.evaluate(() => {
					setTimeout(() => {
						throw new Error("visual fixture exploded");
					}, 0);
				})
				.catch(() => undefined);
		}, 25);
		await assert.rejects(onReady(page), /visual fixture exploded/u);
	});
});

test("visual readiness pins reduced motion and the document locale", async () => {
	await withPage("<main>ready</main>", async (page) => {
		await onReady(page);
		const environment = await page.evaluate(() => ({
			language: document.documentElement.lang,
			reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
		}));
		assert.deepEqual(environment, {
			language: "zh-CN",
			reducedMotion: true,
		});
	});
});

test("visual readiness replaces native video layers with their stable poster", async () => {
	await withPage(
		'<main><video controls poster="/stable-poster.png" aria-label="proof video"></video></main>',
		async (page) => {
			await onReady(page);
			assert.equal(await page.locator("video").count(), 0);
			const poster = await page
				.locator("img[data-visual-video-poster]")
				.evaluate((element) => ({
					src: element.getAttribute("src"),
					alt: element.getAttribute("alt"),
				}));
			assert.deepEqual(poster, {
				src: "/stable-poster.png",
				alt: "proof video",
			});
		},
	);
});
