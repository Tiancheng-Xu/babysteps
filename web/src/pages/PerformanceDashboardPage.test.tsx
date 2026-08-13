import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PerformanceStats } from "../performance/api";
import { PerformanceDashboardPage } from "./PerformanceDashboardPage";

const liveStats = {
	window: "24h",
	metric: "LCP",
	unit: "ms",
	sampleCount: 42,
	p50: 120,
	p75: 180,
	p95: 410,
	errorRate: 0.024,
	routes: [
		{ route: "/", sampleCount: 24, p75: 150 },
		{ route: "/tasks/:id", sampleCount: 18, p75: 220 },
	],
	trend: [
		{ bucketStart: 1_786_600_000_000, sampleCount: 20, p75: 160 },
		{ bucketStart: 1_786_603_600_000, sampleCount: 22, p75: 180 },
	],
} satisfies PerformanceStats;

describe("PerformanceDashboardPage", () => {
	afterEach(cleanup);

	it("shows provenance, sample count and real percentiles", async () => {
		const fetchStats = vi.fn(async () => liveStats);
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);

		expect(await screen.findByText("42")).toBeTruthy();
		expect(screen.getByText("p50 · 120 ms")).toBeTruthy();
		expect(screen.getByText("p75 · 180 ms")).toBeTruthy();
		expect(screen.getByText("p95 · 410 ms")).toBeTruthy();
		expect(screen.getByText("2.4%")).toBeTruthy();
		expect(screen.getByText(/真实 AWS 清洗结果/)).toBeTruthy();
		expect(screen.getByText("真实 p75 趋势")).toBeTruthy();
	});

	it("sends time, route, metric, environment and version filters", async () => {
		const fetchStats = vi.fn(async () => liveStats);
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);
		await screen.findByText("42");

		fireEvent.change(screen.getByLabelText("时间范围"), {
			target: { value: "7d" },
		});
		fireEvent.change(screen.getByLabelText("页面路径"), {
			target: { value: "/tasks/:id" },
		});
		fireEvent.change(screen.getByLabelText("性能指标"), {
			target: { value: "LCP" },
		});
		fireEvent.change(screen.getByLabelText("运行环境"), {
			target: { value: "production" },
		});
		fireEvent.change(screen.getByLabelText("发布版本"), {
			target: { value: "v2" },
		});
		fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

		expect(fetchStats).toHaveBeenLastCalledWith(
			{
				window: "7d",
				route: "/tasks/:id",
				metric: "LCP",
				environment: "production",
				version: "v2",
			},
			undefined,
		);
	});

	it("shows an honest unavailable state instead of fixture data", async () => {
		const fetchStats = vi.fn().mockRejectedValue(new Error("offline"));
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);
		expect(await screen.findByText("性能数据暂不可用")).toBeTruthy();
		expect(screen.queryByText("42")).toBeNull();
	});

	it("refreshes while visible and keeps the last real result on a transient failure", async () => {
		vi.useFakeTimers();
		const fetchStats = vi
			.fn()
			.mockResolvedValueOnce(liveStats)
			.mockRejectedValueOnce(new Error("temporary outage"));
		render(<PerformanceDashboardPage fetchStats={fetchStats} />);
		await act(async () => Promise.resolve());
		expect(screen.getByText("42")).toBeTruthy();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});

		expect(fetchStats).toHaveBeenCalledTimes(2);
		expect(screen.getByText("42")).toBeTruthy();
		expect(screen.getByText("正在显示上一次真实结果")).toBeTruthy();
		vi.useRealTimers();
	});
});
