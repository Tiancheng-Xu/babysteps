import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	isPerformanceDashboardResponse,
	type PerformanceDashboardResponse,
	type PerformanceFilters,
	type PerformanceMetricSummary,
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
		{ bucketStart: 1_786_597_200_000, name: "LCP", sampleCount: 42, p75: 180 },
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
		expect(isPerformanceDashboardResponse(liveStats)).toBe(true);
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
		expect(isPerformanceDashboardResponse(liveStats)).toBe(true);
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
		const response = {
			...liveStats,
			freshness: {
				...liveStats.freshness,
				mode: "snapshot" as const,
				source: "verified-snapshot" as const,
				runId: "api-run",
				commit: "api-commit",
			},
		};
		expect(isPerformanceDashboardResponse(response)).toBe(true);
		render(<PerformanceDashboardPage fetchStats={async () => response} />);
		expect(await screen.findByText("历史 API 快照 · 非实时")).toBeTruthy();
		expect(screen.queryByText("最近一次真实闭环")).toBeNull();
		expect(screen.queryByRole("link", { name: /查看 Run/ })).toBeNull();
		expect(screen.getAllByText("Run api-run")).toHaveLength(2);
		expect(screen.getByText("api-commit")).toBeTruthy();
	});

	it("uses the bundled snapshot only in history mode and shares mode in the URL", async () => {
		expect(isPerformanceDashboardResponse(liveStats)).toBe(true);
		const fetchStats = async () => liveStats;
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);
		await screen.findAllByText("42");
		fireEvent.click(screen.getByRole("button", { name: "历史快照" }));
		expect(window.location.search).toContain("mode=history");
		expect(await screen.findByText("最近一次真实闭环")).toBeTruthy();
	});

	it("ignores a late response from an earlier filter request", async () => {
		const newResponse = {
			...liveStats,
			routes: [{ route: "/new", sampleCount: 42, p75: 180, p95: 410 }],
		};
		const oldResponse = {
			...liveStats,
			routes: [{ route: "/old", sampleCount: 42, p75: 180, p95: 410 }],
		};
		expect(isPerformanceDashboardResponse(newResponse)).toBe(true);
		expect(isPerformanceDashboardResponse(oldResponse)).toBe(true);
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
			resolveSecond?.(newResponse);
		});
		await act(async () => {
			resolveFirst?.(oldResponse);
		});
		expect(screen.getAllByText("/new").length).toBeGreaterThan(0);
		expect(screen.queryByText("/old")).toBeNull();
	});

	it("keeps a prior live response visibly stale after a refresh failure", async () => {
		expect(isPerformanceDashboardResponse(liveStats)).toBe(true);
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

	it("falls back to bundled history instead of reusing live data from different filters", async () => {
		const response = {
			...liveStats,
			routes: [
				{
					route: "/filters-a-only",
					sampleCount: 42,
					p75: 180,
					p95: 410,
				},
			],
		};
		expect(isPerformanceDashboardResponse(response)).toBe(true);
		let calls = 0;
		render(
			<PerformanceDashboardPage
				fetchStats={async () => {
					calls += 1;
					if (calls === 1) return response;
					throw new Error("filters B unavailable");
				}}
			/>,
		);
		expect(await screen.findAllByText("/filters-a-only")).not.toHaveLength(0);
		fireEvent.change(screen.getByLabelText("页面路径"), {
			target: { value: "/filters-b" },
		});
		fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

		expect(
			await screen.findByText("管线失败 · 历史快照 · 非实时"),
		).toBeTruthy();
		expect(screen.getByText("最近一次真实闭环")).toBeTruthy();
		expect(screen.queryByText("/filters-a-only")).toBeNull();
	});

	it("passes all four applied filter values to fetchStats", async () => {
		expect(isPerformanceDashboardResponse(liveStats)).toBe(true);
		const fetchStats = vi.fn(async (_filters: PerformanceFilters) => liveStats);
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);
		await screen.findAllByText("42");

		fireEvent.change(screen.getByLabelText("时间范围"), {
			target: { value: "7d" },
		});
		fireEvent.change(screen.getByLabelText("页面路径"), {
			target: { value: "/tasks/verified" },
		});
		fireEvent.change(screen.getByLabelText("运行环境"), {
			target: { value: "production" },
		});
		fireEvent.change(screen.getByLabelText("发布版本"), {
			target: { value: "release-2026-08-26" },
		});
		fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

		await waitFor(() => expect(fetchStats).toHaveBeenCalledTimes(2));
		expect(fetchStats.mock.calls[1]?.[0]).toEqual({
			window: "7d",
			route: "/tasks/verified",
			environment: "production",
			version: "release-2026-08-26",
		});
	});

	it("renders positive Web3 counts and rate from the same sample denominator", async () => {
		const response = {
			...liveStats,
			web3: liveStats.web3.map((item, index) =>
				index === 0
					? {
							...liveStats.web3[0],
							sampleCount: 10,
							successCount: 7,
							failureCount: 3,
							successRate: 0.7,
							p50: 210,
							p75: 321,
							p95: 490,
							coverage: "observed" as const,
						}
					: item,
			),
		};
		expect(isPerformanceDashboardResponse(response)).toBe(true);
		render(<PerformanceDashboardPage fetchStats={async () => response} />);
		const section = (
			await screen.findByRole("heading", { name: "Web3 操作" })
		).closest("section");
		expect(section).not.toBeNull();
		expect(within(section as HTMLElement).getByText("样本 10")).toBeTruthy();
		expect(within(section as HTMLElement).getByText("p75 321 ms")).toBeTruthy();
		expect(
			within(section as HTMLElement).getByText(
				"成功 7 / 失败 3 / 成功率 70.0%",
			),
		).toBeTruthy();
	});

	it("renders the actual trend bucket, metric, sample count and p75", async () => {
		const bucketStart = 1_786_600_800_000;
		const response = {
			...liveStats,
			trend: [
				{
					bucketStart,
					name: "INP",
					sampleCount: 17,
					p75: 246,
				},
			],
		};
		expect(isPerformanceDashboardResponse(response)).toBe(true);
		render(<PerformanceDashboardPage fetchStats={async () => response} />);
		const trendTable = await screen.findByRole("table", { name: "真实趋势" });
		const row = within(trendTable).getByRole("row", { name: /INP 17 246 ms/ });
		expect(row.textContent).toContain(
			new Date(bucketStart).toLocaleString("zh-CN", { hour12: false }),
		);
		expect(within(row).getByText("INP")).toBeTruthy();
		expect(within(row).getByText("17")).toBeTruthy();
		expect(within(row).getByText("246 ms")).toBeTruthy();
	});

	it("canonicalizes a direct history URL to the immutable artifact filters", async () => {
		expect(isPerformanceDashboardResponse(liveStats)).toBe(true);
		window.history.replaceState(
			{},
			"",
			"/performance?mode=history&window=7d&route=%2Ftasks&environment=prod&version=v2",
		);
		const fetchStats = vi.fn(async () => liveStats);
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);
		expect(await screen.findByText("最近一次真实闭环")).toBeTruthy();
		expect(window.location.search).toBe("?mode=history");
		expect((screen.getByLabelText("时间范围") as HTMLSelectElement).value).toBe(
			"1h",
		);
		for (const label of ["页面路径", "运行环境", "发布版本"]) {
			expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
		}
		for (const label of ["时间范围", "页面路径", "运行环境", "发布版本"]) {
			expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(
				true,
			);
		}
		expect(screen.getByRole("button", { name: "应用筛选" })).toHaveProperty(
			"disabled",
			true,
		);
		expect(fetchStats).not.toHaveBeenCalled();
	});

	it("canonicalizes history popstate and clears and locks every filter", async () => {
		expect(isPerformanceDashboardResponse(liveStats)).toBe(true);
		const fetchStats = vi.fn(async () => liveStats);
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);
		await screen.findAllByText("42");
		fireEvent.change(screen.getByLabelText("时间范围"), {
			target: { value: "7d" },
		});
		fireEvent.change(screen.getByLabelText("页面路径"), {
			target: { value: "/live-route" },
		});
		fireEvent.change(screen.getByLabelText("运行环境"), {
			target: { value: "production" },
		});
		fireEvent.change(screen.getByLabelText("发布版本"), {
			target: { value: "live-version" },
		});
		fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));
		await waitFor(() => expect(fetchStats).toHaveBeenCalledTimes(2));
		expect((screen.getByLabelText("时间范围") as HTMLSelectElement).value).toBe(
			"7d",
		);
		expect((screen.getByLabelText("页面路径") as HTMLInputElement).value).toBe(
			"/live-route",
		);
		expect((screen.getByLabelText("运行环境") as HTMLInputElement).value).toBe(
			"production",
		);
		expect((screen.getByLabelText("发布版本") as HTMLInputElement).value).toBe(
			"live-version",
		);
		await act(async () => {
			window.history.replaceState(
				{},
				"",
				"/performance?mode=history&window=7d&route=%2Ftasks&environment=prod&version=v2",
			);
			window.dispatchEvent(new PopStateEvent("popstate"));
		});

		expect(await screen.findByText("最近一次真实闭环")).toBeTruthy();
		expect(window.location.search).toBe("?mode=history");
		expect((screen.getByLabelText("时间范围") as HTMLSelectElement).value).toBe(
			"1h",
		);
		for (const label of ["页面路径", "运行环境", "发布版本"]) {
			expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
		}
		for (const label of ["时间范围", "页面路径", "运行环境", "发布版本"]) {
			expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(
				true,
			);
		}
		expect(screen.getByRole("button", { name: "应用筛选" })).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("summarizes both mixed coverage combinations as partial", async () => {
		const combinations = [
			["instrumented-no-sample", "unavailable"],
			["observed", "unavailable"],
		] as const;
		for (const [first, second] of combinations) {
			const response = {
				...liveStats,
				navigation: liveStats.navigation.map((item, index) => {
					if (index === 0 && first === "observed") {
						return {
							...item,
							sampleCount: 1,
							p50: 10,
							p75: 20,
							p95: 30,
							coverage: first,
						};
					}
					if (index === 0) return { ...item, coverage: first };
					if (index === 1) return { ...item, coverage: second };
					return item;
				}),
			};
			expect(isPerformanceDashboardResponse(response)).toBe(true);
			const view = render(
				<PerformanceDashboardPage fetchStats={async () => response} />,
			);
			const section = (
				await screen.findByRole("heading", { name: "导航阶段" })
			).closest("section");
			expect(section).not.toBeNull();
			expect(within(section as HTMLElement).getByText("部分覆盖")).toBeTruthy();
			view.unmount();
		}
	});

	it("labels an all-zero error catalog as no error category", async () => {
		expect(isPerformanceDashboardResponse(liveStats)).toBe(true);
		render(<PerformanceDashboardPage fetchStats={async () => liveStats} />);
		expect(await screen.findByText("无错误分类")).toBeTruthy();
	});
});
