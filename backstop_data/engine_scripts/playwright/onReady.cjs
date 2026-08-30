// BackstopJS loads engine scripts through CommonJS even though the repository is ESM.
module.exports = async (page) => {
	await page.evaluate(async () => {
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

	let previousFingerprint = "";
	let stableSamples = 0;
	for (let attempt = 0; attempt < 12 && stableSamples < 3; attempt += 1) {
		const fingerprint = await page.evaluate(() =>
			JSON.stringify({
				height: document.documentElement.scrollHeight,
				text: document.body.innerText,
			}),
		);
		stableSamples = fingerprint === previousFingerprint ? stableSamples + 1 : 0;
		previousFingerprint = fingerprint;
		await page.waitForTimeout(250);
	}

	await page.locator("video").evaluateAll((videos) => {
		for (const video of videos) {
			video.pause();
			video.currentTime = 0;
		}
	});
	await page.addStyleTag({
		content: `
			*, *::before, *::after {
				animation-duration: 0s !important;
				animation-delay: 0s !important;
				transition-duration: 0s !important;
				caret-color: transparent !important;
			}
		`,
	});
};
