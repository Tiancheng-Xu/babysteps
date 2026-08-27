import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
	PerformanceDashboardResponse,
	PerformanceMetricSummary,
} from "../performance/api";
import { PerformanceDashboardPage } from "./PerformanceDashboardPage";

const metric = (
	name: string,
	unit: PerformanceMetricSummary["unit"] = "ms",
): PerformanceMetricSummary => ({
	name,
	unit,
	sampleCount: name === "LCP" ? 42 : 0,
	p50: name === "LCP" ? 120 : null,
	p75: name === "LCP" ? 180 : null,
	p95: name === "LCP" ? 410 : null,
	coverage: name === "LCP" ? "observed" : "instrumented-no-sample",
});

const vitalNames = ["LCP", "CLS", "INP", "FCP", "TTFB"];
const navigationNames = [
	"navigation.dns",
	"navigation.tcp",
	"navigation.tls",
	"navigation.request_wait",
	"navigation.download",
	"navigation.dom_ready",
	"navigation.window_load",
];
const resourceNames = [
	"resource.duration",
	"resource.fetch.duration",
	"resource.xhr.duration",
	"resource.script.duration",
	"resource.stylesheet.duration",
	"resource.image.duration",
	"resource.font.duration",
];
const errorNames = [
	"javascript.error",
	"promise.rejection",
	"error.javascript.type_error",
	"error.javascript.network",
	"error.javascript.timeout",
	"error.javascript.unknown",
	"error.promise.type_error",
	"error.promise.network",
	"error.promise.timeout",
	"error.promise.unknown",
];
const web3Names = [
	"contract.read",
	"contract.write",
	"web3.uniswap.quote",
	"web3.uniswap.swap",
	"web3.privy.login",
	"wallet.connect",
	"auth.challenge",
	"auth.sign",
	"auth.verify",
	"rpc.read",
	"web3.rpc.read",
	"approve.submit",
	"approve.receipt",
	"transaction.submit",
	"transaction.receipt",
];
const coverageNames = [
	...vitalNames,
	...navigationNames,
	...resourceNames,
	"longtask.duration",
	"longtask.count",
	"longtask.total",
	"longtask.max",
	"spa.route.duration",
	"ssr.shell.duration",
	"hydration.duration",
	"csr.fallback",
	"hydration.recoverable_error",
	...errorNames,
	...web3Names,
];

const liveStats = {
	window: "24h",
	freshness: {
		observedAt: 1_786_600_001_000,
		latestSampleAt: 1_786_600_000_000,
		mode: "live",
		source: "live-api",
		runId: "run-42",
		commit: "abcdef123456",
	},
	vitals: vitalNames.map((name) =>
		metric(name, name === "CLS" ? "score" : "ms"),
	),
	navigation: navigationNames.map((name) => metric(name)),
	resources: resourceNames.map((name) => metric(name)),
	longTasks: {
		count: 0,
		totalDurationMs: 0,
		maxDurationMs: null,
		duration: metric("longtask.duration"),
		coverage: "instrumented-no-sample" as const,
	},
	errors: errorNames.map((name) => ({
		name,
		sampleCount: 0,
		rate: null,
		coverage: "instrumented-no-sample" as const,
	})),
	web3: web3Names.map((name) => ({
		name,
		unit: "ms" as const,
		sampleCount: 0,
		successCount: 0,
		failureCount: 0,
		successRate: null,
		p50: null,
		p75: null,
		p95: null,
		coverage: "instrumented-no-sample" as const,
	})),
	routes: [{ route: "/", sampleCount: 42, p75: 180, p95: 410 }],
	trend: [
		{ bucketStart: 1_786_600_000_000, name: "LCP", sampleCount: 42, p75: 180 },
	],
	versions: [{ version: "v2", sampleCount: 42, p75: 180, p95: 410 }],
	coverage: coverageNames.map((name) => ({
		name,
		status:
			name === "LCP"
				? ("observed" as const)
				: ("instrumented-no-sample" as const),
	})),
	pipeline: {
		status: "unavailable" as const,
		source: "database-only" as const,
	},
} satisfies PerformanceDashboardResponse;

describe("PerformanceDashboardPage", () => {
	afterEach(() => {
		cleanup();
		window.history.replaceState({}, "", "/performance");
	});

	it("renders the ten data-driven cockpit sections with coverage and provenance", async () => {
		render(<PerformanceDashboardPage fetchStats={async () => liveStats} />);
		await screen.findAllByText("42");
		for (const heading of [
			"运行状态与总览",
			"Core Web Vitals",
			"导航阶段",
			"趋势与版本",
			"页面路径",
			"资源与主线程",
			"稳定性错误",
			"Web3 操作",
			"AWS 管道健康",
			"Evidence 与口径",
		]) {
			expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
		}
		expect(
			screen.getAllByText("已埋点，当前快照无样本").length,
		).toBeGreaterThan(0);
		expect(screen.getAllByText(/来源：实时 API/).length).toBeGreaterThan(0);
	});

	it("shares the four filters in the URL and restores history navigation", async () => {
		window.history.replaceState(
			{},
			"",
			"/performance?window=7d&route=%2Ftasks&environment=production&version=v2",
		);
		render(<PerformanceDashboardPage fetchStats={async () => liveStats} />);
		await screen.findAllByText("42");
		expect((screen.getByLabelText("时间范围") as HTMLSelectElement).value).toBe(
			"7d",
		);
		expect((screen.getByLabelText("页面路径") as HTMLInputElement).value).toBe(
			"/tasks",
		);
		expect((screen.getByLabelText("运行环境") as HTMLInputElement).value).toBe(
			"production",
		);
		expect((screen.getByLabelText("发布版本") as HTMLInputElement).value).toBe(
			"v2",
		);
		fireEvent.change(screen.getByLabelText("页面路径"), {
			target: { value: "/profile" },
		});
		fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));
		expect(window.location.search).toContain("route=%2Fprofile");
		await act(async () => {
			window.history.replaceState(
				{},
				"",
				"/performance?window=7d&route=%2Ftasks&environment=production&version=v2",
			);
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		expect((screen.getByLabelText("页面路径") as HTMLInputElement).value).toBe(
			"/tasks",
		);
		await act(async () => {
			window.history.replaceState(
				{},
				"",
				"/performance?window=7d&route=%2Fprofile&environment=production&version=v2",
			);
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		expect((screen.getByLabelText("页面路径") as HTMLInputElement).value).toBe(
			"/profile",
		);
	});

	it("falls back to the verified historical snapshot when the API is invalid or unavailable", async () => {
		render(
			<PerformanceDashboardPage
				fetchStats={async () => {
					throw new Error("invalid performance response");
				}}
			/>,
		);
		expect(await screen.findByText("历史快照 · 非实时")).toBeTruthy();
		expect(screen.getByText("最近一次真实闭环")).toBeTruthy();
		expect(screen.getByRole("status").textContent).toContain("管线失败");
	});

	it("renders a valid API snapshot without attaching the bundled evidence banner", async () => {
		render(
			<PerformanceDashboardPage
				fetchStats={async () => ({
					...liveStats,
					freshness: {
						...liveStats.freshness,
						mode: "snapshot",
						source: "verified-snapshot",
						runId: "api-run",
						commit: "api-commit",
					},
				})}
			/>,
		);
		expect(await screen.findByText("历史 API 快照 · 非实时")).toBeTruthy();
		expect(screen.queryByText("最近一次真实闭环")).toBeNull();
		expect(screen.getByText("api-run", { exact: false })).toBeTruthy();
	});

	it("uses the bundled snapshot only in history mode and shares mode in the URL", async () => {
		const fetchStats = async () => liveStats;
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);
		await screen.findAllByText("42");
		fireEvent.click(screen.getByRole("button", { name: "历史快照" }));
		expect(window.location.search).toContain("mode=history");
		expect(await screen.findByText("最近一次真实闭环")).toBeTruthy();
	});

	it("ignores a late response from an earlier filter request", async () => {
		let resolveFirst:
			| ((value: PerformanceDashboardResponse) => void)
			| undefined;
		let resolveSecond:
			| ((value: PerformanceDashboardResponse) => void)
			| undefined;
		const fetchStats = (filters: PerformanceFilters) =>
			new Promise<PerformanceDashboardResponse>((resolve) => {
				if (filters.route === "/new") resolveSecond = resolve;
				else resolveFirst = resolve;
			});
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);
		fireEvent.change(screen.getByLabelText("页面路径"), {
			target: { value: "/new" },
		});
		fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));
		await act(async () => {
			resolveSecond?.({
				...liveStats,
				routes: [{ route: "/new", sampleCount: 42, p75: 180, p95: 410 }],
			});
		});
		await act(async () => {
			resolveFirst?.({
				...liveStats,
				routes: [{ route: "/old", sampleCount: 42, p75: 180, p95: 410 }],
			});
		});
		expect(screen.getAllByText("/new").length).toBeGreaterThan(0);
		expect(screen.queryByText("/old")).toBeNull();
	});

	it("keeps a prior live response visibly stale after a refresh failure", async () => {
		let calls = 0;
		render(
			<PerformanceDashboardPage
				fetchStats={async () => {
					calls += 1;
					if (calls === 1) return liveStats;
					throw new Error("offline");
				}}
			/>,
		);
		await screen.findAllByText("42");
		fireEvent.click(screen.getByRole("button", { name: "Live 数据" }));
		expect(await screen.findByText(/stale/)).toBeTruthy();
	});
});
