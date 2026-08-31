// BackstopJS loads engine scripts through CommonJS even though the repository is ESM.
module.exports = async (page) => {
	await page.addStyleTag({
		content: `
			*, *::before, *::after {
				font-family: Arial, "PingFang SC", sans-serif !important;
				animation: none !important;
				transition: none !important;
				caret-color: transparent !important;
			}
		`,
	});
	await page
		.waitForLoadState("networkidle", { timeout: 8_000 })
		.catch(() => undefined);

	await page.evaluate(async () => {
		const images = [...document.images];
		for (const image of images) image.setAttribute("loading", "eager");
		await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
		await document.fonts?.ready;
	});

	const pendingCopy = ["正在初始化 Privy 身份服务", "正在读取 Sepolia 成长任务"];
	await page
		.waitForFunction(
			(copy) => !copy.some((text) => document.body.innerText.includes(text)),
			pendingCopy,
			{ timeout: 8_000 },
		)
		.catch(() => undefined);

	await page.locator("video").evaluateAll((videos) => {
		for (const video of videos) {
			video.pause();
			video.currentTime = 0;
		}
	});

	let previousFingerprint = "";
	let stableSamples = 0;
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const fingerprint = await page.evaluate(() =>
			JSON.stringify({
				height: document.documentElement.scrollHeight,
				text: document.body.innerText,
			}),
		);
		stableSamples = fingerprint === previousFingerprint ? stableSamples + 1 : 0;
		previousFingerprint = fingerprint;
		await page.waitForTimeout(250);
		if (attempt >= 7 && stableSamples >= 3) break;
	}
};
