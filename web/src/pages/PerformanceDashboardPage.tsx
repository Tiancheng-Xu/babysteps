import { useEffect, useState } from "react";

import { publicAppConfig } from "../contracts/web3Contracts";
import {
	fetchPerformanceStats,
	type PerformanceFilters,
	type PerformanceStats,
} from "../performance/api";

const LOCAL_EVIDENCE_STATS: PerformanceStats = {
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
};
const EVIDENCE_FIXTURE_ENABLED =
	import.meta.env.DEV &&
	import.meta.env.VITE_PERFORMANCE_EVIDENCE_FIXTURE === "true";

const INITIAL_FILTERS: PerformanceFilters = { window: "24h", metric: "LCP" };

function displayValue(value: number, unit: PerformanceStats["unit"]) {
	if (unit === "ms") return `${Math.round(value)} ms`;
	if (unit === "score") return value.toFixed(3);
	return `${Math.round(value)}`;
}

export function PerformanceDashboardPage({
	fetchStats = EVIDENCE_FIXTURE_ENABLED
		? async () => LOCAL_EVIDENCE_STATS
		: fetchPerformanceStats,
}: {
	fetchStats?: (
		filters: PerformanceFilters,
		apiUrl?: string,
	) => Promise<PerformanceStats>;
}) {
	const [draft, setDraft] = useState<PerformanceFilters>(INITIAL_FILTERS);
	const [filters, setFilters] = useState<PerformanceFilters>(INITIAL_FILTERS);
	const [stats, setStats] = useState<PerformanceStats | null>(null);
	const [status, setStatus] = useState<"loading" | "ready" | "stale" | "error">(
		"loading",
	);

	useEffect(() => {
		let active = true;
		setStatus("loading");
		const load = () =>
			fetchStats(filters, publicAppConfig.apiUrl)
				.then((next) => {
					if (!active) return;
					setStats(next);
					setStatus("ready");
				})
				.catch(() => {
					if (!active) return;
					setStats((current) => {
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
	}, [fetchStats, filters]);

	const update = (key: keyof PerformanceFilters, value: string) => {
		setDraft((current) => ({ ...current, [key]: value || undefined }));
	};

	return (
		<section
			className="product-page performance-page"
			aria-labelledby="performance-heading"
		>
			<header className="product-page__hero performance-hero">
				<div>
					<p className="eyebrow">真实数据 · AWS 清洗链路</p>
					<h1 id="performance-heading">BabySteps 性能观测站</h1>
					<p>从浏览器采集到清洗、聚合和回读，每个数字都能追溯到真实样本。</p>
				</div>
				<span className="evidence-status">无演示数据兜底</span>
			</header>
			{EVIDENCE_FIXTURE_ENABLED ? (
				<p className="performance-state performance-state--warning">
					本地受控 UI fixture · 仅验证排版，不是 AWS 运行证据
				</p>
			) : null}

			<form
				className="performance-filters"
				onSubmit={(event) => {
					event.preventDefault();
					setFilters({ ...draft });
				}}
			>
				<label>
					时间范围
					<select
						aria-label="时间范围"
						value={draft.window}
						onChange={(e) => update("window", e.target.value)}
					>
						<option value="1h">最近 1 小时</option>
						<option value="24h">最近 24 小时</option>
						<option value="7d">最近 7 天</option>
					</select>
				</label>
				<label>
					页面路径
					<input
						aria-label="页面路径"
						value={draft.route ?? ""}
						onChange={(e) => update("route", e.target.value)}
						placeholder="全部页面"
					/>
				</label>
				<label>
					性能指标
					<select
						aria-label="性能指标"
						value={draft.metric ?? ""}
						onChange={(e) => update("metric", e.target.value)}
					>
						<option value="LCP">LCP</option>
						<option value="CLS">CLS</option>
						<option value="INP">INP</option>
						<option value="FCP">FCP</option>
						<option value="TTFB">TTFB</option>
						<option value="resource.duration">资源请求</option>
						<option value="javascript.error">JS 错误</option>
						<option value="promise.rejection">Promise 错误</option>
					</select>
				</label>
				<label>
					运行环境
					<input
						aria-label="运行环境"
						value={draft.environment ?? ""}
						onChange={(e) => update("environment", e.target.value)}
						placeholder="全部环境"
					/>
				</label>
				<label>
					发布版本
					<input
						aria-label="发布版本"
						value={draft.version ?? ""}
						onChange={(e) => update("version", e.target.value)}
						placeholder="全部版本"
					/>
				</label>
				<button type="submit">应用筛选</button>
			</form>

			{status === "loading" ? (
				<p className="performance-state">正在读取已清洗样本…</p>
			) : null}
			{status === "error" ? (
				<div className="performance-state performance-state--error">
					<strong>性能数据暂不可用</strong>
					<span>页面不会用模拟数据掩盖链路故障，请稍后重试。</span>
				</div>
			) : null}
			{status === "stale" ? (
				<p className="performance-state performance-state--warning">
					正在显示上一次真实结果
				</p>
			) : null}
			{(status === "ready" || status === "stale") && stats ? (
				<>
					<p className="performance-provenance">
						真实 AWS 清洗结果 · 窗口 {stats.window} · 样本数不会被推算或补齐
					</p>
					<div className="performance-kpis">
						<article>
							<span>有效样本</span>
							<strong>{stats.sampleCount}</strong>
							<small>本次筛选窗口</small>
						</article>
						<article>
							<span>真实百分位</span>
							<strong>p75 · {displayValue(stats.p75, stats.unit)}</strong>
							<small>p50 · {displayValue(stats.p50, stats.unit)}</small>
							<small>p95 · {displayValue(stats.p95, stats.unit)}</small>
						</article>
						<article>
							<span>错误率</span>
							<strong>{(stats.errorRate * 100).toFixed(1)}%</strong>
							<small>错误样本 ÷ 全部样本</small>
						</article>
					</div>
					<section
						className="performance-trend"
						aria-labelledby="performance-trend-heading"
					>
						<div>
							<p className="eyebrow">Time series</p>
							<h2 id="performance-trend-heading">真实 p75 趋势</h2>
						</div>
						{stats.trend.length > 0 ? (
							<ol>
								{stats.trend.map((point) => (
									<li key={point.bucketStart}>
										<time dateTime={new Date(point.bucketStart).toISOString()}>
											{new Date(point.bucketStart).toLocaleTimeString("zh-CN", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</time>
										<strong>{displayValue(point.p75, stats.unit)}</strong>
										<small>{point.sampleCount} 个样本</small>
									</li>
								))}
							</ol>
						) : (
							<p className="performance-trend__empty">
								当前筛选窗口没有可绘制的趋势点。
							</p>
						)}
					</section>
					<section
						className="performance-routes"
						aria-labelledby="route-comparison-heading"
					>
						<div>
							<p className="eyebrow">Route comparison</p>
							<h2 id="route-comparison-heading">页面路径对比</h2>
						</div>
						<table className="performance-table">
							<caption className="visually-hidden">页面性能对比</caption>
							<thead>
								<tr>
									<th scope="col">页面</th>
									<th scope="col">样本</th>
									<th scope="col">p75</th>
								</tr>
							</thead>
							<tbody>
								{stats.routes.map((route) => (
									<tr key={route.route}>
										<th scope="row">
											<code>{route.route}</code>
										</th>
										<td>{route.sampleCount}</td>
										<td>
											<strong>{displayValue(route.p75, stats.unit)}</strong>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				</>
			) : null}
		</section>
	);
}
