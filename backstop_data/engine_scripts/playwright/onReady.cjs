// BackstopJS loads engine scripts through CommonJS even though the repository is ESM.
module.exports = async (page) => {
	const pageErrors = [];
	const collectPageError = (error) => pageErrors.push(error.message);
	page.on("pageerror", collectPageError);
	try {
		await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
		const timeZone = await page.evaluate(() => {
			document.documentElement.lang = "zh-CN";
			return Intl.DateTimeFormat().resolvedOptions().timeZone;
		});
		if (timeZone !== "UTC") {
			throw new Error(`visual timezone must be UTC, received ${timeZone}`);
		}
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
		await page.waitForLoadState("networkidle", { timeout: 8_000 });

		await page.evaluate(async () => {
			for (const video of document.querySelectorAll("video")) {
				const posterSource = video.getAttribute("poster");
				if (!posterSource) {
					throw new Error("visual video fixture requires a stable poster");
				}
				const rect = video.getBoundingClientRect();
				const style = getComputedStyle(video);
				const poster = document.createElement("img");
				poster.dataset.visualVideoPoster = "true";
				poster.src = posterSource;
				poster.alt = video.getAttribute("aria-label") ?? "视频海报";
				poster.loading = "eager";
				poster.decoding = "sync";
				poster.draggable = false;
				poster.style.cssText = `
					display: block;
					width: 100%;
					max-width: 100%;
					height: ${rect.height}px;
					object-fit: ${style.objectFit};
					border: ${style.border};
					border-radius: ${style.borderRadius};
					background: ${style.backgroundColor};
					box-sizing: ${style.boxSizing};
				`;
				video.replaceWith(poster);
			}

			const images = [...document.images];
			for (const image of images) image.setAttribute("loading", "eager");
			await Promise.all(
				images.map((image) => image.decode().catch(() => undefined)),
			);
			await document.fonts?.ready;
		});

		const pendingCopy = [
			"正在初始化 Privy 身份服务",
			"正在读取 Sepolia 成长任务",
		];
		await page.waitForFunction(
			(copy) => !copy.some((text) => document.body.innerText.includes(text)),
			pendingCopy,
			{ timeout: 8_000 },
		);

		let previousFingerprint = "";
		let stableSamples = 0;
		let stable = false;
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const fingerprint = await page.evaluate(() =>
				JSON.stringify({
					height: document.documentElement.scrollHeight,
					text: document.body.innerText,
				}),
			);
			stableSamples =
				fingerprint === previousFingerprint ? stableSamples + 1 : 0;
			previousFingerprint = fingerprint;
			await page.waitForTimeout(250);
			if (attempt >= 7 && stableSamples >= 3) {
				stable = true;
				break;
			}
		}
		if (!stable) throw new Error("visual page did not reach a stable layout");
		if (pageErrors.length > 0) {
			throw new Error(`visual pageerror: ${pageErrors.join(" | ")}`);
		}
		const overflow = await page.evaluate(() =>
			Math.max(
				0,
				document.documentElement.scrollWidth -
					document.documentElement.clientWidth,
				document.body.scrollWidth - window.innerWidth,
			),
		);
		if (overflow > 1) {
			throw new Error(`root horizontal overflow: ${Math.ceil(overflow)}px`);
		}
	} finally {
		page.off("pageerror", collectPageError);
	}
};
