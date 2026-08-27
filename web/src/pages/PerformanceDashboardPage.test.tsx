import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PerformanceOverview } from "../performance/api";
import { PerformanceDashboardPage } from "./PerformanceDashboardPage";

const liveOverview = {
	schemaVersion: "performance-overview/v2",
	window: {
		preset: "24h",
		from: "2026-08-26T00:00:00.000Z",
		to: "2026-08-27T00:00:00.000Z",
	},
	filters: { environment: "production" },
	summary: {
		totalEvents: 128,
		errorCount: 3,
		errorRate: 0.0234,
		metricCount: 3,
		routeCount: 2,
		latestEventAt: Date.parse("2026-08-26T23:59:30.000Z"),
	},
	metrics: [
		{
			metric: "LCP",
			category: "web-vital",
			unit: "ms",
			sampleCount: 42,
			p50: 120,
			p75: 180,
			p95: 410,
			errorCount: 0,
			errorRate: 0,
			routes: [
				{ route: "/", sampleCount: 24, p50: 110, p75: 150, p95: 320 },
				{ route: "/tasks/:id", sampleCount: 18, p50: 140, p75: 220, p95: 410 },
			],
			trend: [
				{
					bucketStart: 1_786_600_000_000,
					sampleCount: 20,
					p50: 115,
					p75: 160,
					p95: 360,
				},
				{
					bucketStart: 1_786_603_600_000,
					sampleCount: 22,
					p50: 120,
					p75: 180,
					p95: 410,
				},
			],
		},
		{
			metric: "api.duration",
			category: "resource",
			unit: "ms",
			sampleCount: 68,
			p50: 80,
			p75: 130,
			p95: 300,
			errorCount: 0,
			errorRate: 0,
			routes: [],
			trend: [],
		},
		{
			metric: "javascript.error",
			category: "error",
			unit: "count",
			sampleCount: 3,
			p50: 1,
			p75: 1,
			p95: 1,
			errorCount: 3,
			errorRate: 1,
			routes: [],
			trend: [],
		},
	],
} satisfies PerformanceOverview;

describe("PerformanceDashboardPage", () => {
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("renders real multi-metric KPIs and four chart views", async () => {
		const fetchOverview = vi.fn(async () => liveOverview);
		render(<PerformanceDashboardPage fetchOverview={fetchOverview} />);

		expect(await screen.findByText("128")).toBeTruthy();
		expect(screen.getByText("3 项")).toBeTruthy();
		expect(screen.getByText("2.3%")).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "多指标 p75 对比" }),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "p50 / p75 / p95 趋势" }),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "页面路径分位对比" }),
		).toBeTruthy();
		expect(screen.getByRole("heading", { name: "错误事件分布" })).toBeTruthy();
		expect(screen.getAllByText("LCP").length).toBeGreaterThan(0);
		expect(screen.getAllByText("javascript.error").length).toBeGreaterThan(0);
		expect(screen.getByText(/真实 AWS 清洗结果/)).toBeTruthy();
	});

	it("sends time, route, environment and version filters without mixing metric units", async () => {
		const fetchOverview = vi.fn(async () => liveOverview);
		render(<PerformanceDashboardPage fetchOverview={fetchOverview} />);
		await screen.findByText("128");

		fireEvent.change(screen.getByLabelText("时间范围"), {
			target: { value: "7d" },
		});
		fireEvent.change(screen.getByLabelText("页面路径"), {
			target: { value: "/tasks/:id" },
		});
		fireEvent.change(screen.getByLabelText("运行环境"), {
			target: { value: "production" },
		});
		fireEvent.change(screen.getByLabelText("发布版本"), {
			target: { value: "v2" },
		});
		fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

		expect(fetchOverview).toHaveBeenLastCalledWith(
			{
				window: "7d",
				route: "/tasks/:id",
				environment: "production",
				version: "v2",
			},
			undefined,
		);
	});

	it("switches the selected metric locally for linked charts", async () => {
		const fetchOverview = vi.fn(async () => liveOverview);
		render(<PerformanceDashboardPage fetchOverview={fetchOverview} />);
		await screen.findByText("128");
		fireEvent.change(screen.getByLabelText("分析指标"), {
			target: { value: "api.duration" },
		});
		expect(screen.getByText("p75 · 130 ms")).toBeTruthy();
		expect(fetchOverview).toHaveBeenCalledTimes(1);
	});

	it("shows an honest unavailable state instead of fixture data", async () => {
		const fetchOverview = vi.fn().mockRejectedValue(new Error("offline"));
		render(<PerformanceDashboardPage fetchOverview={fetchOverview} />);
		expect(await screen.findByText("性能数据暂不可用")).toBeTruthy();
		expect(screen.queryByText("128")).toBeNull();
	});

	it("refreshes while visible and keeps the last real overview on a transient failure", async () => {
		vi.useFakeTimers();
		const fetchOverview = vi
			.fn()
			.mockResolvedValueOnce(liveOverview)
			.mockRejectedValueOnce(new Error("temporary outage"));
		render(<PerformanceDashboardPage fetchOverview={fetchOverview} />);
		await act(async () => Promise.resolve());
		expect(screen.getByText("128")).toBeTruthy();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});

		expect(fetchOverview).toHaveBeenCalledTimes(2);
		expect(screen.getByText("128")).toBeTruthy();
		expect(screen.getByText("正在显示上一次真实结果")).toBeTruthy();
	});
});
