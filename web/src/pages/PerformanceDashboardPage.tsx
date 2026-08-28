import { useEffect, useRef, useState } from "react";

import { publicAppConfig } from "../contracts/web3Contracts";
import {
	fetchPerformanceStats,
	type PerformanceCoverageStatus,
	type PerformanceDashboardResponse,
	type PerformanceFilters,
	type PerformanceMetricSummary,
} from "../performance/api";
import {
	VERIFIED_PERFORMANCE_DASHBOARD,
	VERIFIED_PERFORMANCE_OBSERVATION,
} from "../performance/verifiedObservation";

type DashboardStatus =
	| "loading"
	| "live"
	| "api-snapshot"
	| "stale"
	| "pipeline-failure"
	| "bundled-history";
type DashboardMode = "live" | "history";
type SectionCoverage = PerformanceCoverageStatus | "partial";

const COVERAGE_LABEL: Record<PerformanceCoverageStatus, string> = {
	observed: "已观测",
	"instrumented-no-sample": "已埋点，当前快照无样本",
	unavailable: "不可用",
};

function filtersFromUrl(): PerformanceFilters {
	const query = new URLSearchParams(window.location.search);
	const windowValue = query.get("window");
	return {
		window: windowValue === "1h" || windowValue === "7d" ? windowValue : "24h",
		route: query.get("route") || undefined,
		environment: query.get("environment") || undefined,
		version: query.get("version") || undefined,
	};
}

function modeFromUrl(): DashboardMode {
	return new URLSearchParams(window.location.search).get("mode") === "history"
		? "history"
		: "live";
}

function writeFilters(filters: PerformanceFilters, mode: DashboardMode) {
	const query = new URLSearchParams();
	if (mode === "history") {
		query.set("mode", "history");
		window.history.pushState({}, "", `${window.location.pathname}?${query}`);
		return;
	}
	query.set("window", filters.window);
	for (const key of ["route", "environment", "version"] as const) {
		if (filters[key]) query.set(key, filters[key]);
	}
	query.set("mode", mode);
	window.history.pushState(
		{},
		"",
		`${window.location.pathname}?${query.toString()}`,
	);
}

function display(value: number | null, unit: "ms" | "score" | "count") {
	if (value === null) return "—";
	if (unit === "score") return value.toFixed(3);
	if (unit === "count") return `${Math.round(value)}`;
	return `${Math.round(value)} ms`;
}

function freshnessText(value: number | null, isBundled: boolean) {
	if (isBundled)
		return `仅日期：${VERIFIED_PERFORMANCE_OBSERVATION.observedAt}`;
	return value
		? new Date(value).toLocaleString("zh-CN", { hour12: false })
		: "未提供";
}

function MetricTable({
	items,
	caption,
}: {
	items: PerformanceMetricSummary[];
	caption: string;
}) {
	return (
		<div className="performance-table-frame">
			<table className="performance-table">
				<caption>{caption}</caption>
				<thead>
					<tr>
						<th scope="col">指标</th>
						<th scope="col">样本</th>
						<th scope="col">p50</th>
						<th scope="col">p75</th>
						<th scope="col">p95</th>
						<th scope="col">覆盖</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.name}>
							<th scope="row">
								<code>{item.name}</code>
							</th>
							<td>{item.sampleCount}</td>
							<td>{display(item.p50, item.unit)}</td>
							<td>{display(item.p75, item.unit)}</td>
							<td>{display(item.p95, item.unit)}</td>
							<td>
								<Coverage status={item.coverage} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function Coverage({ status }: { status: PerformanceCoverageStatus }) {
	return (
		<span className={`performance-coverage performance-coverage--${status}`}>
			{COVERAGE_LABEL[status]}
		</span>
	);
}

function Meta({
	source,
	samples,
	freshness,
	coverage,
}: {
	source: string;
	samples: number;
	freshness: string;
	coverage: SectionCoverage;
}) {
	return (
		<p className="performance-meta">
			<span>来源：{source}</span>
			<span>样本：{samples}</span>
			<span>新鲜度：{freshness}</span>
			{coverage === "partial" ? (
				<span className="performance-coverage">部分覆盖</span>
			) : (
				<Coverage status={coverage} />
			)}
		</p>
	);
}

function sectionCoverage(
	items: Array<{ coverage: PerformanceCoverageStatus }>,
): SectionCoverage {
	if (new Set(items.map((item) => item.coverage)).size > 1) return "partial";
	return items[0]?.coverage ?? "unavailable";
}

function totalSamples(items: Array<{ sampleCount: number }>) {
	return items.reduce((total, item) => total + item.sampleCount, 0);
}

export function PerformanceDashboardPage({
	fetchStats = fetchPerformanceStats,
}: {
	fetchStats?: (
		filters: PerformanceFilters,
		apiUrl?: string,
	) => Promise<PerformanceDashboardResponse>;
}) {
	const [filters, setFilters] = useState<PerformanceFilters>(filtersFromUrl);
	const [draft, setDraft] = useState<PerformanceFilters>(filtersFromUrl);
	const [dashboard, setDashboard] =
		useState<PerformanceDashboardResponse | null>(null);
	const [status, setStatus] = useState<DashboardStatus>("loading");
	const [mode, setMode] = useState<DashboardMode>(modeFromUrl);
	const historyMode = mode === "history" || modeFromUrl() === "history";
	const priorLive = useRef<{
		key: string;
		data: PerformanceDashboardResponse;
	} | null>(null);
	const [reload, setReload] = useState(0);

	useEffect(() => {
		const restore = () => {
			const next =
				modeFromUrl() === "history"
					? { window: VERIFIED_PERFORMANCE_DASHBOARD.window }
					: filtersFromUrl();
			setFilters(next);
			setDraft(next);
			setMode(modeFromUrl());
		};
		window.addEventListener("popstate", restore);
		return () => window.removeEventListener("popstate", restore);
	}, []);

	useEffect(() => {
		void reload;
		let active = true;
		if (historyMode) {
			window.history.replaceState(
				{},
				"",
				`${window.location.pathname}?mode=history`,
			);
			setFilters((current) =>
				current.window === VERIFIED_PERFORMANCE_DASHBOARD.window &&
				!current.route &&
				!current.environment &&
				!current.version
					? current
					: { window: VERIFIED_PERFORMANCE_DASHBOARD.window },
			);
			setDraft((current) =>
				current.window === VERIFIED_PERFORMANCE_DASHBOARD.window &&
				!current.route &&
				!current.environment &&
				!current.version
					? current
					: { window: VERIFIED_PERFORMANCE_DASHBOARD.window },
			);
			setDashboard(VERIFIED_PERFORMANCE_DASHBOARD);
			setStatus("bundled-history");
			return () => {
				active = false;
			};
		}
		setDashboard(null);
		setStatus("loading");
		const load = async () => {
			try {
				const next = await fetchStats(filters, publicAppConfig.apiUrl);
				if (!active) return;
				setDashboard(next);
				if (next.freshness.mode === "live")
					priorLive.current = { key: JSON.stringify(filters), data: next };
				setStatus(next.freshness.mode === "live" ? "live" : "api-snapshot");
			} catch {
				if (!active) return;
				if (priorLive.current?.key === JSON.stringify(filters)) {
					setDashboard(priorLive.current.data);
					setStatus("stale");
				} else {
					setDashboard(VERIFIED_PERFORMANCE_DASHBOARD);
					setStatus("pipeline-failure");
				}
			}
		};
		void load();
		return () => {
			active = false;
		};
	}, [fetchStats, filters, historyMode, reload]);

	const data = dashboard;
	const isBundled =
		status === "bundled-history" || status === "pipeline-failure";
	const source = isBundled
		? "已验证历史快照"
		: data?.freshness.source === "live-api"
			? "实时 API"
			: "已验证历史快照";
	const freshness = freshnessText(
		data?.freshness.latestSampleAt ?? null,
		isBundled,
	);

	return (
		<section
			className="product-page performance-page"
			aria-labelledby="performance-heading"
		>
			<header className="product-page__hero performance-hero">
				<div>
					<p className="eyebrow">真实样本 · 可追溯口径</p>
					<h1 id="performance-heading">BabySteps 性能观测站</h1>
					<p>
						受控运行使用 Live
						API；服务关闭或响应无效时，回退到最近已验证历史快照。
					</p>
				</div>
				<span className="evidence-status">无演示数据兜底</span>
			</header>
			<form
				className="performance-filters"
				onSubmit={(event) => {
					event.preventDefault();
					writeFilters(draft, mode);
					setFilters(draft);
				}}
			>
				<fieldset disabled={historyMode}>
					<label>
						时间范围
						<select
							aria-label="时间范围"
							disabled={historyMode}
							value={draft.window}
							onChange={(event) =>
								setDraft({
									...draft,
									window: event.target.value as PerformanceFilters["window"],
								})
							}
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
							disabled={historyMode}
							value={draft.route ?? ""}
							onChange={(event) =>
								setDraft({ ...draft, route: event.target.value || undefined })
							}
							placeholder="全部页面"
						/>
					</label>
					<label>
						运行环境
						<input
							aria-label="运行环境"
							disabled={historyMode}
							value={draft.environment ?? ""}
							onChange={(event) =>
								setDraft({
									...draft,
									environment: event.target.value || undefined,
								})
							}
							placeholder="全部环境"
						/>
					</label>
					<label>
						发布版本
						<input
							aria-label="发布版本"
							disabled={historyMode}
							value={draft.version ?? ""}
							onChange={(event) =>
								setDraft({ ...draft, version: event.target.value || undefined })
							}
							placeholder="全部版本"
						/>
					</label>
					<button type="submit" disabled={historyMode}>
						应用筛选
					</button>
				</fieldset>
			</form>
			<fieldset className="performance-mode-controls" aria-label="数据模式">
				<button
					type="button"
					aria-pressed={mode === "live"}
					onClick={() => {
						writeFilters(filters, "live");
						setMode("live");
						setReload((value) => value + 1);
					}}
				>
					Live 数据
				</button>
				<button
					type="button"
					aria-pressed={historyMode}
					onClick={() => {
						const fixed = {
							window: VERIFIED_PERFORMANCE_DASHBOARD.window,
						} as PerformanceFilters;
						writeFilters(fixed, "history");
						setFilters(fixed);
						setDraft(fixed);
						setMode("history");
					}}
				>
					历史快照
				</button>
			</fieldset>
			<p
				className="performance-state performance-state--compact"
				role="status"
				aria-live="polite"
			>
				{status === "loading"
					? "正在读取性能观测…"
					: status === "live"
						? "Live · 实时数据"
						: status === "api-snapshot"
							? "历史 API 快照 · 非实时"
							: status === "stale"
								? "stale · 正在显示上一次真实结果"
								: status === "bundled-history"
									? "历史快照 · 非实时"
									: "管线失败 · 历史快照 · 非实时"}
			</p>
			{isBundled ? (
				<section
					className="performance-verified-snapshot"
					aria-labelledby="performance-snapshot-heading"
				>
					<header>
						<div>
							<p className="eyebrow">Verified cloud observation</p>
							<h2 id="performance-snapshot-heading">最近一次真实闭环</h2>
						</div>
						<span className="evidence-status">历史快照 · 非实时</span>
					</header>
					<p className="performance-provenance">
						{VERIFIED_PERFORMANCE_OBSERVATION.observedAt} · AWS{" "}
						{VERIFIED_PERFORMANCE_OBSERVATION.region} · commit{" "}
						{VERIFIED_PERFORMANCE_OBSERVATION.commit}
					</p>
					<p>
						本轮采集 {VERIFIED_PERFORMANCE_OBSERVATION.browserEventCount}{" "}
						个浏览器事件， Cleaner 完成{" "}
						{VERIFIED_PERFORMANCE_OBSERVATION.cleanerInsertedCount} 条写入；
						清理前仍有{" "}
						{VERIFIED_PERFORMANCE_OBSERVATION.queueVisibleBeforeCleanup}
						条待清理，因此不宣称全量排空。临时项目资源已清理；未保存分布的指标保持不可用。
					</p>
					<a
						className="performance-link"
						href={VERIFIED_PERFORMANCE_OBSERVATION.runUrl}
						target="_blank"
						rel="noreferrer"
					>
						查看 Run {VERIFIED_PERFORMANCE_OBSERVATION.runId}
					</a>
				</section>
			) : null}
			{data ? (
				<div className="performance-cockpit">
					<section className="performance-panel">
						<h2>运行状态与总览</h2>
						<Meta
							source={source}
							samples={totalSamples(data.vitals)}
							freshness={freshness}
							coverage={sectionCoverage(data.vitals)}
						/>
						<div className="performance-kpis">
							<article>
								<span>模式</span>
								<strong>
									{data.freshness.mode === "live" && !isBundled
										? "Live"
										: "历史"}
								</strong>
								<small>Run {data.freshness.runId ?? "已清理后不可用"}</small>
							</article>
							<article>
								<span>Web Vitals 样本</span>
								<strong>{totalSamples(data.vitals)}</strong>
								<small>窗口 {data.window}</small>
							</article>
							<article>
								<span>管道</span>
								<strong>
									{data.pipeline.status === "unavailable"
										? "不可用"
										: data.pipeline.status}
								</strong>
								<small>{data.pipeline.source}</small>
							</article>
							<article>
								<span>版本 / 最慢页面</span>
								<strong>{data.versions[0]?.version ?? "—"}</strong>
								<small>
									{data.routes.slice().sort((a, b) => b.p75 - a.p75)[0]
										?.route ?? "无 route 样本"}
								</small>
							</article>
							<article>
								<span>错误样本</span>
								<strong>{totalSamples(data.errors)}</strong>
								<small>
									{totalSamples(data.errors) === 0
										? "无错误分类"
										: data.errors
												.slice()
												.sort((a, b) => b.sampleCount - a.sampleCount)[0]?.name}
								</small>
							</article>
							<article>
								<span>响应 commit</span>
								<strong>{data.freshness.commit ?? "—"}</strong>
								<small>Run {data.freshness.runId ?? "—"}</small>
							</article>
						</div>
					</section>
					<section className="performance-panel">
						<h2>Core Web Vitals</h2>
						<Meta
							source={source}
							samples={totalSamples(data.vitals)}
							freshness={freshness}
							coverage={sectionCoverage(data.vitals)}
						/>
						<MetricTable
							items={data.vitals}
							caption="Core Web Vitals 百分位与覆盖状态"
						/>
					</section>
					<section className="performance-panel">
						<h2>导航阶段</h2>
						<Meta
							source={source}
							samples={totalSamples(data.navigation)}
							freshness={freshness}
							coverage={sectionCoverage(data.navigation)}
						/>
						<MetricTable
							items={data.navigation}
							caption="导航阶段百分位与覆盖状态"
						/>
					</section>
					<section className="performance-panel">
						<h2>趋势与版本</h2>
						<Meta
							source={source}
							samples={data.trend.reduce(
								(total, item) => total + item.sampleCount,
								0,
							)}
							freshness={freshness}
							coverage={
								data.trend.length ? "observed" : "instrumented-no-sample"
							}
						/>
						<div className="performance-table-frame">
							<table className="performance-table">
								<caption>版本与趋势</caption>
								<thead>
									<tr>
										<th scope="col">版本</th>
										<th scope="col">样本</th>
										<th scope="col">p75</th>
										<th scope="col">p95</th>
									</tr>
								</thead>
								<tbody>
									{data.versions.length ? (
										data.versions.map((item) => (
											<tr key={item.version}>
												<th scope="row">{item.version}</th>
												<td>{item.sampleCount}</td>
												<td>{item.p75} ms</td>
												<td>{item.p95} ms</td>
											</tr>
										))
									) : (
										<tr>
											<td colSpan={4}>已埋点，当前快照无样本</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
						<div className="performance-table-frame">
							<table className="performance-table">
								<caption>真实趋势</caption>
								<thead>
									<tr>
										<th scope="col">时间桶</th>
										<th scope="col">指标</th>
										<th scope="col">样本</th>
										<th scope="col">p75</th>
									</tr>
								</thead>
								<tbody>
									{data.trend.length ? (
										data.trend.map((item) => (
											<tr key={`${item.bucketStart}-${item.name}`}>
												<th scope="row">
													{new Date(item.bucketStart).toLocaleString("zh-CN", {
														hour12: false,
													})}
												</th>
												<td>{item.name}</td>
												<td>{item.sampleCount}</td>
												<td>{item.p75} ms</td>
											</tr>
										))
									) : (
										<tr>
											<td colSpan={4}>无趋势样本</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</section>
					<section className="performance-panel">
						<h2>页面路径</h2>
						<Meta
							source={source}
							samples={data.routes.reduce(
								(total, item) => total + item.sampleCount,
								0,
							)}
							freshness={freshness}
							coverage={
								data.routes.length ? "observed" : "instrumented-no-sample"
							}
						/>
						<div className="performance-table-frame">
							<table className="performance-table">
								<caption>页面路径性能对比</caption>
								<thead>
									<tr>
										<th scope="col">页面</th>
										<th scope="col">样本</th>
										<th scope="col">p75</th>
										<th scope="col">p95</th>
									</tr>
								</thead>
								<tbody>
									{data.routes.length ? (
										data.routes.map((item) => (
											<tr key={item.route}>
												<th scope="row">
													<code>{item.route}</code>
												</th>
												<td>{item.sampleCount}</td>
												<td>{item.p75} ms</td>
												<td>{item.p95} ms</td>
											</tr>
										))
									) : (
										<tr>
											<td colSpan={4}>已埋点，当前快照无样本</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</section>
					<section className="performance-panel">
						<h2>资源与主线程</h2>
						<Meta
							source={source}
							samples={
								totalSamples(data.resources) +
								data.longTasks.duration.sampleCount
							}
							freshness={freshness}
							coverage={sectionCoverage([
								...data.resources,
								data.longTasks.duration,
							])}
						/>
						<MetricTable items={data.resources} caption="资源性能与覆盖状态" />
						<p className="performance-note">
							Long Task：
							{data.longTasks.coverage === "unavailable"
								? "次数 — · 总计 — · 最长 —"
								: `${data.longTasks.count} 次 · 总计 ${data.longTasks.totalDurationMs} ms · 最长 ${data.longTasks.maxDurationMs ?? "—"} ms`}{" "}
							· <Coverage status={data.longTasks.coverage} />
						</p>
					</section>
					<section className="performance-panel">
						<h2>稳定性错误</h2>
						<Meta
							source={source}
							samples={totalSamples(data.errors)}
							freshness={freshness}
							coverage={sectionCoverage(data.errors)}
						/>
						<div className="performance-list">
							{data.errors.map((item) => (
								<p key={item.name}>
									<code>{item.name}</code>
									<span>样本 {item.sampleCount}</span>
									<span>
										错误率{" "}
										{item.rate === null
											? "—"
											: `${(item.rate * 100).toFixed(1)}%`}
									</span>
									<Coverage status={item.coverage} />
								</p>
							))}
						</div>
					</section>
					<section className="performance-panel">
						<h2>Web3 操作</h2>
						<Meta
							source={source}
							samples={totalSamples(data.web3)}
							freshness={freshness}
							coverage={sectionCoverage(data.web3)}
						/>
						<div className="performance-list">
							{data.web3.map((item) => (
								<p key={item.name}>
									<code>{item.name}</code>
									<span>样本 {item.sampleCount}</span>
									<span>p75 {display(item.p75, item.unit)}</span>
									<span>
										成功 {item.successCount} / 失败 {item.failureCount} / 成功率{" "}
										{item.successRate === null
											? "—"
											: `${(item.successRate * 100).toFixed(1)}%`}
									</span>
									<Coverage status={item.coverage} />
								</p>
							))}
						</div>
					</section>
					<section className="performance-panel">
						<h2>AWS 管道健康</h2>
						<Meta
							source={data.pipeline.source}
							samples={0}
							freshness={freshness}
							coverage="unavailable"
						/>
						<p className="performance-note">
							Cloudflare → API → SQS/DLQ → ECS → PostgreSQL → Query
						</p>
						<p className="performance-note">
							当前为 {data.pipeline.status}；Dashboard 不从数据库推测 AWS
							控制面状态。
						</p>
					</section>
					<section className="performance-panel">
						<h2>Evidence 与口径</h2>
						<Meta
							source={isBundled ? "已验证工作流制品" : source}
							samples={totalSamples(data.vitals)}
							freshness={freshness}
							coverage={sectionCoverage(data.vitals)}
						/>
						<p className="performance-note">
							只展示真实浏览器样本或经验证快照；小于 5
							个样本不做变化百分比。DNS/TCP/TLS 在本地 HTTP
							或连接复用时显示不可用，绝不显示伪造的 0 ms。
						</p>
						<p className="performance-note">
							不采集 Cookie、Token、签名、钱包完整地址、请求正文或用户输入。
						</p>
					</section>
				</div>
			) : null}
		</section>
	);
}
