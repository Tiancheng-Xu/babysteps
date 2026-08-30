const testUrl =
	process.env.BACKSTOP_TEST_URL ??
	"http://127.0.0.1:4176/performance?mode=history";
const referenceUrl = process.env.BACKSTOP_REFERENCE_URL ?? testUrl;
const testOrigin = new URL(testUrl).origin;
const referenceOrigin = new URL(referenceUrl).origin;

const productRoutes = [
	["home", "/"],
	["tasks", "/tasks"],
	["parent", "/parent"],
	["keepsakes", "/keepsakes"],
	["provider", "/provider"],
	["exchange", "/exchange"],
	["profile", "/profile"],
	["evidence", "/evidence"],
];

const routeScenarios = productRoutes.map(([label, route]) => ({
	label: `product-route-${label}`,
	url: new URL(route, testOrigin).toString(),
	referenceUrl: new URL(route, referenceOrigin).toString(),
	readySelector: "main.page-shell",
	readyTimeout: 15_000,
	delay: 800,
	onReadyScript: "playwright/onReady.cjs",
	selectors: ["viewport"],
	selectorExpansion: false,
	misMatchThreshold: 0.1,
	requireSameDimensions: true,
	engineOptions: {
		gotoParameters: { waitUntil: "domcontentloaded" },
	},
}));

module.exports = {
	id: "babysteps_performance_dashboard",
	viewports: [
		{ label: "mobile-375", width: 375, height: 900 },
		{ label: "mobile-390", width: 390, height: 900 },
		{ label: "mobile-430", width: 430, height: 932 },
		{ label: "desktop-1440", width: 1440, height: 1000 },
	],
	scenarios: [
		{
			label: "performance-dashboard-verified-history",
			url: testUrl,
			referenceUrl,
			readySelector: ".performance-cockpit",
			readyTimeout: 15_000,
			delay: 500,
			onReadyScript: "playwright/onReady.cjs",
			selectors: ["document"],
			selectorExpansion: false,
			misMatchThreshold: 0.1,
			requireSameDimensions: true,
			engineOptions: {
				gotoParameters: {
					waitUntil: "domcontentloaded",
				},
			},
		},
		...routeScenarios,
	],
	paths: {
		bitmaps_reference: "backstop_data/bitmaps_reference",
		bitmaps_test: "backstop_data/bitmaps_test",
		engine_scripts: "backstop_data/engine_scripts",
		html_report: "backstop_data/html_report",
		ci_report: "backstop_data/ci_report",
	},
	report: ["CI"],
	engine: "playwright",
	engineOptions: {
		browser: "chromium",
		args: ["--no-sandbox", "--lang=zh-CN"],
	},
	asyncCaptureLimit: 2,
	asyncCompareLimit: 4,
	debug: false,
	debugWindow: false,
};
