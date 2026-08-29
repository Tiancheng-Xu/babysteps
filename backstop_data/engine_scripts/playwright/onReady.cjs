// BackstopJS loads engine scripts through CommonJS even though the repository is ESM.
module.exports = async (page) => {
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
