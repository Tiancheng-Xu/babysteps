import { type CSSProperties, useEffect, useMemo, useState } from "react";

import { publicAppConfig } from "../contracts/web3Contracts";
import {
	fetchPerformanceOverview,
	type PerformanceFilters,
	type PerformanceMetricStats,
	type PerformanceOverview,
} from "../performance/api";

const LOCAL_EVIDENCE_OVERVIEW: PerformanceOverview = {
	schemaVersion: "performance-overview/v2",
	window: {
		preset: "24h",
		from: "2026-08-26T00:00:00.000Z",
		to: "2026-08-27T00:00:00.000Z",
	},
	filters: { environment: "local-evidence" },
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
				{
					route: "/tasks/:id",
					sampleCount: 18,
					p50: 140,
					p75: 220,
					p95: 410,
				},
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
};
const EVIDENCE_FIXTURE_ENABLED =
	import.meta.env.DEV &&
	import.meta.env.VITE_PERFORMANCE_EVIDENCE_FIXTURE === "true";

type ServerFilters = Omit<PerformanceFilters, "metric">;
const INITIAL_FILTERS: ServerFilters = { window: "24h" };
const UNIT_LABELS: Record<PerformanceMetricStats["unit"], string> = {
	ms: "毫秒",
	score: "分数",
	count: "次数",
};

function displayValue(value: number, unit: PerformanceMetricStats["unit"]) {
	if (unit === "ms") return `${Math.round(value)} ms`;
	if (unit === "score") return value.toFixed(3);
	return `${Math.round(value)}`;
}

function barStyle(value: number, max: number): CSSProperties {
	const size = max > 0 ? Math.max(3, Math.min(100, (value / max) * 100)) : 0;
	return { "--bar-size": `${size}%` } as CSSProperties;
}

function linePoints(
	trend: PerformanceMetricStats["trend"],
	key: "p50" | "p75" | "p95",
	width = 640,
	height = 220,
) {
	const padding = 24;
	const max = Math.max(1, ...trend.map((point) => point.p95));
	return trend
		.map((point, index) => {
			const x =
				trend.length === 1
					? width / 2
					: padding + (index / (trend.length - 1)) * (width - padding * 2);
			const y = height - padding - (point[key] / max) * (height - padding * 2);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
}

function MultiMetricChart({
	metrics,
	selectedMetric,
	onSelect,
}: {
	metrics: PerformanceMetricStats[];
	selectedMetric: string;
	onSelect: (metric: string) => void;
}) {
	const groups = (["ms", "score", "count"] as const)
		.map((unit) => ({ unit, metrics: metrics.filter((metric) => metric.unit === unit) }))
		.filter((group) => group.metrics.length > 0);

	return (
		<section className="performance-panel" aria-labelledby="metric-comparison-heading">
			<div className="performance-panel__heading">
				<div>
					<p className="eyebrow">Metric overview</p>
					<h2 id="metric-comparison-heading">多指标 p75 对比</h2>
				</div>
				<label className="performance-metric-picker">
					分析指标
					<select
						aria-label="分析指标"
						value={selectedMetric}
						onChange={(event) => onSelect(event.target.value)}
					>
						{metrics.map((metric) => (
							<option key={metric.metric} value={metric.metric}>
								{metric.metric}
							</option>
						))}
					</select>
				</label>
			</div>
			<div className="performance-unit-groups">
				{groups.map((group) => {
					const max = Math.max(...group.metrics.map((metric) => metric.p75), 1);
					return (
						<article key={group.unit} className="performance-unit-group">
							<h3>{UNIT_LABELS[group.unit]}</h3>
							<ul className="performance-bars">
								{group.metrics.map((metric) => (
									<li key={metric.metric}>
										<button
											type="button"
											className={metric.metric === selectedMetric ? "is-selected" : undefined}
											onClick={() => onSelect(metric.metric)}
										>
											<span>{metric.metric}</span>
											<strong>{displayValue(metric.p75, metric.unit)}</strong>
											<small>{metric.sampleCount} 样本</small>
											<i aria-hidden="true" style={barStyle(metric.p75, max)} />
										</button>
									</li>
								))}
							</ul>
						</article>
					);
				})}
			</div>
		</section>
	);
}

function PercentileTrend({ metric }: { metric: PerformanceMetricStats }) {
	return (
		<section className="performance-panel" aria-labelledby="percentile-trend-heading">
			<div className="performance-panel__heading">
				<div>
					<p className="eyebrow">Percentile trend</p>
					<h2 id="percentile-trend-heading">p50 / p75 / p95 趋势</h2>
				</div>
				<div className="performance-selected-value">
					<strong>{metric.metric}</strong>
					<span>p75 · {displayValue(metric.p75, metric.unit)}</span>
				</div>
			</div>
			{metric.trend.length > 0 ? (
				<>
					<div className="performance-line-chart">
						<svg
							viewBox="0 0 640 220"
							role="img"
							aria-label={`${metric.metric} p50、p75、p95 真实趋势图`}
							preserveAspectRatio="none"
						>
							<title>{metric.metric} 分位趋势</title>
							<line x1="24" y1="196" x2="616" y2="196" className="chart-axis" />
							<polyline points={linePoints(metric.trend, "p95")} className="chart-line chart-line--p95" />
							<polyline points={linePoints(metric.trend, "p75")} className="chart-line chart-line--p75" />
							<polyline points={linePoints(metric.trend, "p50")} className="chart-line chart-line--p50" />
						</svg>
					</div>
					<div className="performance-chart-legend" aria-label="趋势图图例">
						<span><i className="legend-p50" />p50</span>
						<span><i className="legend-p75" />p75</span>
						<span><i className="legend-p95" />p95</span>
						<span>{metric.trend.reduce((sum, point) => sum + point.sampleCount, 0)} 个分桶样本</span>
					</div>
				</>
			) : (
				<p className="performance-chart-empty">当前指标在该窗口没有可绘制的趋势点。</p>
			)}
		</section>
	);
}

function RouteComparison({ metric }: { metric: PerformanceMetricStats }) {
	const max = Math.max(...metric.routes.map((route) => route.p95), 1);
	return (
		<section className="performance-panel performance-panel--dark" aria-labelledby="route-comparison-heading">
			<div className="performance-panel__heading">
				<div>
					<p className="eyebrow">Route comparison</p>
					<h2 id="route-comparison-heading">页面路径分位对比</h2>
				</div>
				<span>{metric.metric}</span>
			</div>
			{metric.routes.length > 0 ? (
				<div className="performance-route-chart">
					{metric.routes.map((route) => (
						<article key={route.route}>
							<div><code>{route.route}</code><small>{route.sampleCount} 样本</small></div>
							<div className="performance-route-bars">
								<span style={barStyle(route.p50, max)}><i />p50 {displayValue(route.p50, metric.unit)}</span>
								<span style={barStyle(route.p75, max)}><i />p75 {displayValue(route.p75, metric.unit)}</span>
								<span style={barStyle(route.p95, max)}><i />p95 {displayValue(route.p95, metric.unit)}</span>
							</div>
						</article>
					))}
				</div>
			) : (
				<p className="performance-chart-empty">当前指标没有可用的路由分位数据。</p>
			)}
		</section>
	);
}

function ErrorDistribution({ metrics }: { metrics: PerformanceMetricStats[] }) {
	const errors = metrics.filter((metric) => metric.category === "error" || metric.errorCount > 0);
	const max = Math.max(...errors.map((metric) => Math.max(metric.errorCount, metric.sampleCount)), 1);
	return (
		<section className="performance-panel performance-panel--alert" aria-labelledby="error-distribution-heading">
			<div className="performance-panel__heading">
				<div>
					<p className="eyebrow">Error distribution</p>
					<h2 id="error-distribution-heading">错误事件分布</h2>
				</div>
				<span>只展示真实错误样本</span>
			</div>
			{errors.length > 0 ? (
				<ul className="performance-error-bars">
					{errors.map((metric) => {
						const count = Math.max(metric.errorCount, metric.sampleCount);
						return (
							<li key={metric.metric}>
								<div><strong>{metric.metric}</strong><span>{count} 次</span></div>
								<i aria-hidden="true" style={barStyle(count, max)} />
							</li>
						);
					})}
				</ul>
			) : (
				<p className="performance-chart-empty">当前窗口没有采集到错误事件。</p>
			)}
		</section>
	);
}

export function PerformanceDashboardPage({
	fetchOverview = EVIDENCE_FIXTURE_ENABLED
		? async () => LOCAL_EVIDENCE_OVERVIEW
		: fetchPerformanceOverview,
}: {
	fetchOverview?: (filters: ServerFilters, apiUrl?: string) => Promise<PerformanceOverview>;
}) {
	const [draft, setDraft] = useState<ServerFilters>(INITIAL_FILTERS);
	const [filters, setFilters] = useState<ServerFilters>(INITIAL_FILTERS);
	const [overview, setOverview] = useState<PerformanceOverview | null>(null);
	const [selectedMetric, setSelectedMetric] = useState("");
	const [status, setStatus] = useState<"loading" | "ready" | "stale" | "error">("loading");

	useEffect(() => {
		let active = true;
		setStatus("loading");
		const load = () =>
			fetchOverview(filters, publicAppConfig.apiUrl)
				.then((next) => {
					if (!active) return;
					setOverview(next);
					setSelectedMetric((current) =>
						next.metrics.some((metric) => metric.metric === current)
							? current
							: (next.metrics[0]?.metric ?? ""),
					);
					setStatus("ready");
				})
				.catch(() => {
					if (!active) return;
					setOverview((current) => {
						setStatus(current ? "stale" : "error");
						return current;
					});
				});
		void load();
		const interval = setInterval(() => {
			if (document.visibilityState === "visible") void load();
		}, 10_000);
		return () => {
			active = false;
			clearInterval(interval);
		};
	}, [fetchOverview, filters]);

	const selected = useMemo(
		() =>
			overview?.metrics.find((metric) => metric.metric === selectedMetric) ??
			overview?.metrics[0] ??
			null,
		[overview, selectedMetric],
	);
	const update = (key: keyof ServerFilters, value: string) => {
		setDraft((current) => ({ ...current, [key]: value || undefined }));
	};
	const latency = overview?.summary.latestEventAt
		? Math.max(0, Date.parse(overview.window.to) - overview.summary.latestEventAt)
		: null;

	return (
		<section className="product-page performance-page" aria-labelledby="performance-heading">
			<header className="product-page__hero performance-hero">
				<div>
					<p className="eyebrow">真实数据 · AWS 清洗链路</p>
					<h1 id="performance-heading">BabySteps 性能观测站</h1>
					<p>浏览器指标、接口耗时、错误和业务操作统一进入真实采集、清洗、聚合与回读链路。</p>
				</div>
				<span className="evidence-status">无演示数据兜底</span>
			</header>
			{EVIDENCE_FIXTURE_ENABLED ? (
				<p className="performance-state performance-state--warning">本地受控 UI fixture · 仅验证排版，不是 AWS 运行证据</p>
			) : null}

			<form
				className="performance-filters"
				onSubmit={(event) => {
					event.preventDefault();
					setFilters({ ...draft });
				}}
			>
				<label>时间范围<select aria-label="时间范围" value={draft.window} onChange={(event) => update("window", event.target.value)}><option value="1h">最近 1 小时</option><option value="24h">最近 24 小时</option><option value="7d">最近 7 天</option></select></label>
				<label>页面路径<input aria-label="页面路径" value={draft.route ?? ""} onChange={(event) => update("route", event.target.value)} placeholder="全部页面" /></label>
				<label>运行环境<input aria-label="运行环境" value={draft.environment ?? ""} onChange={(event) => update("environment", event.target.value)} placeholder="全部环境" /></label>
				<label>发布版本<input aria-label="发布版本" value={draft.version ?? ""} onChange={(event) => update("version", event.target.value)} placeholder="全部版本" /></label>
				<button type="submit">应用筛选</button>
			</form>

			{status === "loading" ? <p className="performance-state">正在读取已清洗样本…</p> : null}
			{status === "error" ? <div className="performance-state performance-state--error"><strong>性能数据暂不可用</strong><span>页面不会用模拟数据掩盖链路故障，请稍后重试。</span></div> : null}
			{status === "stale" ? <p className="performance-state performance-state--warning">正在显示上一次真实结果</p> : null}
			{(status === "ready" || status === "stale") && overview ? (
				<>
					<p className="performance-provenance">真实 AWS 清洗结果 · 窗口 {overview.window.preset} · {overview.window.from} 至 {overview.window.to} · 样本不推算</p>
					<div className="performance-kpis performance-kpis--overview">
						<article><span>事件总量</span><strong>{overview.summary.totalEvents}</strong><small>当前筛选窗口</small></article>
						<article><span>监测指标</span><strong>{overview.summary.metricCount} 项</strong><small>按单位独立聚合</small></article>
						<article><span>错误率</span><strong>{(overview.summary.errorRate * 100).toFixed(1)}%</strong><small>{overview.summary.errorCount} 个错误事件</small></article>
						<article><span>覆盖路由</span><strong>{overview.summary.routeCount}</strong><small>归一化页面路径</small></article>
						<article><span>数据延迟</span><strong>{latency === null ? "无" : latency < 60_000 ? `${Math.round(latency / 1000)} 秒` : `${Math.round(latency / 60_000)} 分钟`}</strong><small>{overview.summary.latestEventAt ? new Date(overview.summary.latestEventAt).toLocaleString("zh-CN") : "暂无事件"}</small></article>
					</div>
					{overview.metrics.length > 0 && selected ? (
						<div className="performance-visual-grid">
							<MultiMetricChart metrics={overview.metrics} selectedMetric={selected.metric} onSelect={setSelectedMetric} />
							<PercentileTrend metric={selected} />
							<RouteComparison metric={selected} />
							<ErrorDistribution metrics={overview.metrics} />
						</div>
					) : (
						<div className="performance-state"><strong>当前筛选窗口无可信指标</strong><span>不会生成模拟曲线。</span></div>
					)}
				</>
			) : null}
		</section>
	);
}
