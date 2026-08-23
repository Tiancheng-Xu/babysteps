import { normalizeRoute, safeMetricName } from "./sanitize";
import type {
	PerformanceBatch,
	PerformanceClient,
	PerformanceEvent,
	PerformanceEventInput,
} from "./types";

type ClientOptions = {
	endpoint?: string;
	environment: string;
	version: string;
	sampleRate?: number;
	maxEventsPerMinute?: number;
	batchSize?: number;
	flushIntervalMs?: number;
	route?: () => string;
	beacon?: (url: string, data: BodyInit) => boolean;
	fetcher?: typeof fetch;
	random?: () => number;
	now?: () => number;
	loadWebVitals?: () => Promise<typeof import("web-vitals")>;
};

const webVitalNames = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);

export function createPerformanceClient(
	options: ClientOptions,
): PerformanceClient {
	const endpoint = options.endpoint ?? "/api/performance/events";
	const sampleRate = Math.min(1, Math.max(0, options.sampleRate ?? 1));
	const maxEventsPerMinute = options.maxEventsPerMinute ?? 120;
	const batchSize = options.batchSize ?? 20;
	const flushIntervalMs = options.flushIntervalMs ?? 5_000;
	const random = options.random ?? Math.random;
	const now = options.now ?? Date.now;
	const route = options.route ?? (() => globalThis.location?.href ?? "/");
	const beacon =
		options.beacon ??
		((url, data) => globalThis.navigator?.sendBeacon?.(url, data) ?? false);
	const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
	const loadWebVitals = options.loadWebVitals ?? (() => import("web-vitals"));
	const queue: PerformanceEvent[] = [];
	let minuteStartedAt = now();
	let minuteCount = 0;
	let timer: ReturnType<typeof setInterval> | undefined;
	let observers: PerformanceObserver[] = [];
	let started = false;
	const onError = () =>
		record({
			type: "error",
			name: "javascript.error",
			value: 1,
			unit: "count",
		});
	const onUnhandledRejection = () =>
		record({
			type: "error",
			name: "promise.rejection",
			value: 1,
			unit: "count",
		});
	const onPageHide = () => void flush();

	const record = (input: PerformanceEventInput) => {
		try {
			const current = now();
			if (current - minuteStartedAt >= 60_000) {
				minuteStartedAt = current;
				minuteCount = 0;
			}
			if (random() >= sampleRate || minuteCount >= maxEventsPerMinute) return;
			if (!Number.isFinite(input.value)) return;
			minuteCount += 1;
			queue.push({
				...input,
				name: safeMetricName(input.name),
				eventId: crypto.randomUUID(),
				timestamp: current,
				route: normalizeRoute(route()),
				environment: options.environment.slice(0, 32),
				version: options.version.slice(0, 64),
			});
			if (queue.length >= batchSize) void flush();
		} catch {
			// Telemetry is best-effort and must never break the host application.
		}
	};

	const flush = async () => {
		if (queue.length === 0) return;
		const events = queue.splice(0, batchSize);
		const payload: PerformanceBatch = {
			schemaVersion: 2,
			sentAt: now(),
			events,
		};
		const body = JSON.stringify(payload);
		try {
			if (beacon(endpoint, body)) return;
			const response = await fetcher?.(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
				keepalive: true,
				credentials: "omit",
			});
			if (response && !response.ok) queue.unshift(...events);
		} catch {
			queue.unshift(...events);
			// Deliberately silent: performance reporting cannot fail the product flow.
		}
	};

	const observe = (
		type: string,
		handler: (entry: PerformanceEntry) => void,
	) => {
		if (typeof PerformanceObserver === "undefined") return;
		try {
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) handler(entry);
			});
			observer.observe({ type, buffered: true });
			observers.push(observer);
		} catch {
			// Unsupported observer types are expected across browsers.
		}
	};

	const start = () => {
		if (started) return;
		started = true;
		void loadWebVitals()
			.then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
				const report =
					(name: string, unit: "ms" | "score") => (metric: { value: number }) =>
						record({ type: "metric", name, value: metric.value, unit });
				onLCP(report("LCP", "ms"));
				onCLS(report("CLS", "score"));
				onINP(report("INP", "ms"));
				onFCP(report("FCP", "ms"));
				onTTFB(report("TTFB", "ms"));
			})
			.catch(() => undefined);
		observe("resource", (entry) => {
			if (!entry.name.includes("/api/performance/"))
				record({
					type: "resource",
					name: "resource.duration",
					value: entry.duration,
					unit: "ms",
				});
		});
		globalThis.addEventListener?.("error", onError);
		globalThis.addEventListener?.("unhandledrejection", onUnhandledRejection);
		globalThis.addEventListener?.("pagehide", onPageHide);
		timer = setInterval(() => void flush(), flushIntervalMs);
	};

	const stop = () => {
		if (timer) clearInterval(timer);
		for (const observer of observers) observer.disconnect();
		globalThis.removeEventListener?.("error", onError);
		globalThis.removeEventListener?.(
			"unhandledrejection",
			onUnhandledRejection,
		);
		globalThis.removeEventListener?.("pagehide", onPageHide);
		observers = [];
		started = false;
	};

	const markOperation = async <T>(
		name: string,
		operation: () => Promise<T>,
	) => {
		const startedAt = now();
		try {
			const result = await operation();
			record({ type: "web3", name, value: now() - startedAt, unit: "ms" });
			return result;
		} catch (error) {
			record({
				type: "web3",
				name: `${name}.error`,
				value: now() - startedAt,
				unit: "ms",
			});
			throw error;
		}
	};

	return { start, stop, record, flush, markOperation };
}

export function isWebVital(name: string): boolean {
	return webVitalNames.has(name);
}
