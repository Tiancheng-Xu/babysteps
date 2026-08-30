import { createLongTaskObserver } from "./longTasks";
import { collectNavigationEvents } from "./navigation";
import { classifyResource } from "./resources";
import {
	classifyErrorCategory,
	normalizeRoute,
	safeMetricName,
} from "./sanitize";
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
	reportAllWebVitalChanges?: boolean;
	batchSize?: number;
	flushIntervalMs?: number;
	route?: () => string;
	beacon?: (url: string, data: BodyInit) => boolean;
	fetcher?: typeof fetch;
	random?: () => number;
	loadWebVitals?: () => Promise<typeof import("web-vitals")>;
};

type QueuedEvent = PerformanceEvent & { retries: number };
type PendingRetry = { events: QueuedEvent[]; readyAt: number };
type FlushDisposition = "empty" | "sent" | "drop" | "retry";

const webVitalNames = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);
const workerMinuteQuota = 120;
export const webVitalsReadyMark = "babysteps.web-vitals.ready";
const coverageCriticalNames = new Set([
	...webVitalNames,
	"navigation.dns",
	"navigation.tcp",
	"navigation.tls",
	"navigation.request_wait",
	"navigation.download",
	"navigation.dom_ready",
	"navigation.window_load",
	"resource.duration",
	"resource.fetch.duration",
	"resource.xhr.duration",
	"resource.stylesheet.duration",
	"resource.image.duration",
	"resource.font.duration",
	"spa.route.duration",
	"ssr.shell.duration",
	"hydration.duration",
	"longtask.duration",
	"web3.uniswap.quote",
]);
const lowPriorityNameLimits = new Map<string, number>([
	["resource.duration", 2],
	["resource.fetch.duration", 2],
	["resource.xhr.duration", 2],
	["resource.script.duration", 1],
	["resource.stylesheet.duration", 2],
	["resource.image.duration", 2],
	["resource.font.duration", 2],
]);
const highPriorityNameLimits = new Map<string, number>([
	["rpc.read", 2],
	["web3.rpc.read", 2],
	["navigation.dns", 1],
	["navigation.tcp", 1],
	["navigation.tls", 1],
	["navigation.request_wait", 1],
	["navigation.download", 1],
	["navigation.dom_ready", 1],
	["navigation.window_load", 1],
	["resource.duration", 2],
	["resource.fetch.duration", 2],
	["resource.xhr.duration", 2],
	["resource.stylesheet.duration", 2],
	["resource.image.duration", 2],
	["resource.font.duration", 2],
	["spa.route.duration", 1],
	["ssr.shell.duration", 1],
	["hydration.duration", 1],
	["longtask.duration", 2],
	["LCP", 2],
	["CLS", 2],
	["INP", 2],
	["FCP", 2],
	["TTFB", 2],
	["web3.uniswap.quote", 2],
]);

export function normalizeMaxEventsPerMinute(value: number): number {
	if (!Number.isSafeInteger(value)) return workerMinuteQuota;
	return Math.min(workerMinuteQuota, Math.max(1, value));
}

export function createPerformanceClient(
	options: ClientOptions,
): PerformanceClient {
	const endpoint = options.endpoint ?? "/api/performance/events";
	const sampleRate = Math.min(1, Math.max(0, options.sampleRate ?? 1));
	const maxEventsPerMinute = normalizeMaxEventsPerMinute(
		options.maxEventsPerMinute ?? workerMinuteQuota,
	);
	const batchSize = options.batchSize ?? 20;
	const flushIntervalMs = options.flushIntervalMs ?? 5_000;
	const random = options.random ?? Math.random;
	const route = options.route ?? (() => globalThis.location?.href ?? "/");
	const beacon =
		options.beacon ??
		((url, data) => globalThis.navigator?.sendBeacon?.(url, data) ?? false);
	const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
	const loadWebVitals = options.loadWebVitals ?? (() => import("web-vitals"));
	const urgentPriority: QueuedEvent[] = [];
	const coveragePriority: QueuedEvent[] = [];
	const lowPriority: QueuedEvent[] = [];
	const pendingRetries: PendingRetry[] = [];
	let minuteStartedAt = Date.now();
	let minuteCount = 0;
	let coverageCriticalMinuteCount = 0;
	let lowPriorityMinuteCount = 0;
	const lowPriorityNameCounts = new Map<string, number>();
	const highPriorityNameCounts = new Map<string, number>();
	let timer: ReturnType<typeof setInterval> | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	let observers: Array<Pick<PerformanceObserver, "disconnect">> = [];
	let started = false;
	let finalVitalsListener: (() => void) | undefined;
	const isHighPriority = (event: PerformanceEventInput) =>
		event.type === "metric" ||
		event.type === "error" ||
		event.type === "web3" ||
		coverageCriticalNames.has(safeMetricName(event.name));
	const isCoverageCritical = (event: PerformanceEventInput) =>
		event.type === "error" ||
		coverageCriticalNames.has(safeMetricName(event.name));
	const isUrgent = (event: PerformanceEventInput) =>
		event.type === "metric" || event.type === "error" || event.type === "web3";
	const queueSize = () =>
		urgentPriority.length + coveragePriority.length + lowPriority.length;
	const enqueue = (event: QueuedEvent) => {
		if (isUrgent(event)) urgentPriority.push(event);
		else if (coverageCriticalNames.has(safeMetricName(event.name))) {
			coveragePriority.push(event);
		} else lowPriority.push(event);
	};
	const dequeue = () => {
		const queue =
			urgentPriority.length > 0
				? urgentPriority
				: coveragePriority.length > 0
					? coveragePriority
					: lowPriority;
		return queue.splice(0, batchSize);
	};
	const onError = (event: ErrorEvent) => {
		const category = classifyErrorCategory(event.error ?? event.message);
		record({
			type: "error",
			name: `error.javascript.${category}`,
			value: 1,
			unit: "count",
			category,
		});
	};
	const onUnhandledRejection = (event: PromiseRejectionEvent) => {
		const category = classifyErrorCategory(event.reason);
		record({
			type: "error",
			name: `error.promise.${category}`,
			value: 1,
			unit: "count",
			category,
		});
	};
	const onPageHide = () => void flushAll();

	const record = (input: PerformanceEventInput) => {
		try {
			const current = Date.now();
			if (current - minuteStartedAt >= 60_000) {
				minuteStartedAt = current;
				minuteCount = 0;
				coverageCriticalMinuteCount = 0;
				lowPriorityMinuteCount = 0;
				lowPriorityNameCounts.clear();
				highPriorityNameCounts.clear();
			}
			const highPriority = isHighPriority(input);
			const coverageCritical = isCoverageCritical(input);
			const lowPriorityLimit = Math.floor((maxEventsPerMinute * 2) / 3);
			const coverageReserve =
				maxEventsPerMinute >= 10 ? Math.ceil(maxEventsPerMinute / 2) : 0;
			const nonCoverageCount = minuteCount - coverageCriticalMinuteCount;
			const safeName = safeMetricName(input.name);
			const nameLimit = highPriority
				? highPriorityNameLimits.get(safeName)
				: lowPriorityNameLimits.get(safeName);
			const nameCounts = highPriority
				? highPriorityNameCounts
				: lowPriorityNameCounts;
			if (
				random() >= sampleRate ||
				minuteCount >= maxEventsPerMinute ||
				(!coverageCritical &&
					nonCoverageCount >= maxEventsPerMinute - coverageReserve) ||
				(nameLimit !== undefined &&
					(nameCounts.get(safeName) ?? 0) >= nameLimit) ||
				(!highPriority && lowPriorityMinuteCount >= lowPriorityLimit)
			)
				return;
			if (!Number.isFinite(input.value)) return;
			minuteCount += 1;
			if (coverageCritical) coverageCriticalMinuteCount += 1;
			if (!highPriority) {
				lowPriorityMinuteCount += 1;
			}
			if (nameLimit !== undefined) {
				nameCounts.set(safeName, (nameCounts.get(safeName) ?? 0) + 1);
			}
			enqueue({
				...input,
				name: safeName,
				eventId: crypto.randomUUID(),
				timestamp: current,
				route: normalizeRoute(route()),
				environment: options.environment.slice(0, 32),
				version: options.version.slice(0, 64),
				retries: 0,
			});
			if (queueSize() >= batchSize) void flush();
		} catch {
			// Telemetry is best-effort and must never break the host application.
		}
	};

	const nextReadyRetry = () =>
		pendingRetries
			.filter(({ readyAt }) => readyAt <= Date.now())
			.sort((left, right) => left.readyAt - right.readyAt)[0];
	const takeReadyRetry = () => {
		const retry = nextReadyRetry();
		if (!retry) return undefined;
		pendingRetries.splice(pendingRetries.indexOf(retry), 1);
		return retry;
	};
	const takeRetry = (retry: PendingRetry) => {
		const index = pendingRetries.indexOf(retry);
		if (index < 0) return undefined;
		return pendingRetries.splice(index, 1)[0];
	};
	const armRetryTimer = () => {
		if (retryTimer) clearTimeout(retryTimer);
		const next = [...pendingRetries].sort(
			(left, right) => left.readyAt - right.readyAt,
		)[0];
		if (!next) {
			retryTimer = undefined;
			return;
		}
		retryTimer = setTimeout(
			() => {
				retryTimer = undefined;
				const retry = takeRetry(next);
				if (retry) void sendBatch(retry.events).finally(armRetryTimer);
				else armRetryTimer();
			},
			Math.max(0, next.readyAt - Date.now()),
		);
	};
	const scheduleRetry = (events: QueuedEvent[]) => {
		const retryable = events
			.map((event) => ({ ...event, retries: event.retries + 1 }))
			.filter((event) => event.retries < 3);
		if (retryable.length === 0) return "drop" as const;
		pendingRetries.push({
			events: retryable,
			readyAt: Date.now() + 2 ** (retryable[0].retries - 1) * 100,
		});
		armRetryTimer();
		return "retry" as const;
	};

	const sendBatch = async (
		queued: QueuedEvent[],
	): Promise<FlushDisposition> => {
		const events = queued.map(({ retries: _retries, ...event }) => event);
		const payload: PerformanceBatch = {
			schemaVersion: 2,
			sentAt: Date.now(),
			events,
		};
		const body = JSON.stringify(payload);
		try {
			if (beacon(endpoint, body)) return "sent";
			const response = await fetcher?.(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
				keepalive: true,
				credentials: "omit",
			});
			if (!response || response.ok) return "sent";
			if (
				response.status >= 400 &&
				response.status < 500 &&
				response.status !== 429
			)
				return "drop";
			if (response.status === 429 || response.status >= 500) {
				return scheduleRetry(queued);
			}
			return "drop";
		} catch {
			return scheduleRetry(queued);
			// Deliberately silent: performance reporting cannot fail the product flow.
		}
	};

	const flushOnce = async (): Promise<FlushDisposition> => {
		const retry = takeReadyRetry();
		if (retry) return sendBatch(retry.events);
		if (queueSize() === 0) return "empty";
		return sendBatch(dequeue());
	};

	const flush = async () => {
		await flushOnce();
	};

	const flushAll = async () => {
		while (queueSize() > 0 || nextReadyRetry()) {
			const disposition = await flushOnce();
			if (disposition === "empty") return;
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
				if (!started) return;
				const report =
					(name: string, unit: "ms" | "score") => (metric: { value: number }) =>
						record({ type: "metric", name, value: metric.value, unit });
				onLCP(report("LCP", "ms"));
				onCLS(report("CLS", "score"));
				onINP(report("INP", "ms"), {
					durationThreshold: 0,
					reportAllChanges: options.reportAllWebVitalChanges === true,
				});
				onFCP(report("FCP", "ms"));
				onTTFB(report("TTFB", "ms"));
				try {
					globalThis.performance?.mark(webVitalsReadyMark);
				} catch {
					// Telemetry readiness diagnostics must never affect the host app.
				}
				finalVitalsListener = () => {
					if (globalThis.document?.visibilityState !== "hidden") return;
					void flushAll();
				};
				globalThis.document?.addEventListener(
					"visibilitychange",
					finalVitalsListener,
				);
			})
			.catch(() => undefined);
		observe("navigation", (entry) => {
			for (const event of collectNavigationEvents(
				entry as PerformanceNavigationTiming,
			))
				record(event);
		});
		observe("resource", (entry) => {
			const origin = globalThis.location?.origin ?? "https://babysteps.invalid";
			if (entry.name === new URL(endpoint, origin).href) return;
			const event = classifyResource(
				entry as PerformanceResourceTiming,
				origin,
			);
			if (event) record(event);
		});
		const longTaskObserver = createLongTaskObserver(record);
		if (longTaskObserver) observers.push(longTaskObserver);
		globalThis.addEventListener?.("error", onError);
		globalThis.addEventListener?.("unhandledrejection", onUnhandledRejection);
		globalThis.addEventListener?.("pagehide", onPageHide);
		timer = setInterval(() => void flush(), flushIntervalMs);
	};

	const stop = () => {
		if (timer) clearInterval(timer);
		if (retryTimer) clearTimeout(retryTimer);
		retryTimer = undefined;
		for (const observer of observers) observer.disconnect();
		globalThis.removeEventListener?.("error", onError);
		globalThis.removeEventListener?.(
			"unhandledrejection",
			onUnhandledRejection,
		);
		globalThis.removeEventListener?.("pagehide", onPageHide);
		if (finalVitalsListener) {
			globalThis.document?.removeEventListener(
				"visibilitychange",
				finalVitalsListener,
			);
			finalVitalsListener = undefined;
		}
		observers = [];
		started = false;
	};

	const markOperation = async <T>(
		name: string,
		operation: () => Promise<T>,
	) => {
		const startedAt = performance.now();
		try {
			const result = await operation();
			record({
				type: "web3",
				name,
				value: performance.now() - startedAt,
				unit: "ms",
			});
			return result;
		} catch (error) {
			record({
				type: "web3",
				name: `${name}.error`,
				value: performance.now() - startedAt,
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
