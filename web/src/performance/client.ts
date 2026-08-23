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
	batchSize?: number;
	flushIntervalMs?: number;
	route?: () => string;
	beacon?: (url: string, data: BodyInit) => boolean;
	fetcher?: typeof fetch;
	random?: () => number;
	loadWebVitals?: () => Promise<typeof import("web-vitals")>;
};

type QueuedEvent = PerformanceEvent & { retries: number };
type FlushDisposition = "empty" | "sent" | "drop" | "retry";

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
	const route = options.route ?? (() => globalThis.location?.href ?? "/");
	const beacon =
		options.beacon ??
		((url, data) => globalThis.navigator?.sendBeacon?.(url, data) ?? false);
	const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
	const loadWebVitals = options.loadWebVitals ?? (() => import("web-vitals"));
	const highPriority: QueuedEvent[] = [];
	const lowPriority: QueuedEvent[] = [];
	let minuteStartedAt = Date.now();
	let minuteCount = 0;
	let lowPriorityMinuteCount = 0;
	let timer: ReturnType<typeof setInterval> | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	let observers: Array<Pick<PerformanceObserver, "disconnect">> = [];
	let started = false;
	const isHighPriority = (event: PerformanceEventInput) =>
		event.type === "metric" || event.type === "error" || event.type === "web3";
	const queueSize = () => highPriority.length + lowPriority.length;
	const enqueue = (event: QueuedEvent) =>
		(isHighPriority(event) ? highPriority : lowPriority).push(event);
	const dequeue = () => {
		const queue = highPriority.length > 0 ? highPriority : lowPriority;
		return queue.splice(0, batchSize);
	};
	const requeue = (events: QueuedEvent[]) => {
		for (const event of [...events].reverse()) {
			const queue = isHighPriority(event) ? highPriority : lowPriority;
			queue.unshift(event);
		}
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
				lowPriorityMinuteCount = 0;
			}
			const highPriority = isHighPriority(input);
			const lowPriorityLimit = Math.floor((maxEventsPerMinute * 2) / 3);
			if (
				random() >= sampleRate ||
				minuteCount >= maxEventsPerMinute ||
				(!highPriority && lowPriorityMinuteCount >= lowPriorityLimit)
			)
				return;
			if (!Number.isFinite(input.value)) return;
			minuteCount += 1;
			if (!highPriority) lowPriorityMinuteCount += 1;
			enqueue({
				...input,
				name: safeMetricName(input.name),
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

	const scheduleRetry = (events: QueuedEvent[]) => {
		const retryable = events
			.map((event) => ({ ...event, retries: event.retries + 1 }))
			.filter((event) => event.retries < 3);
		if (retryable.length === 0) return "drop" as const;
		requeue(retryable);
		if (!retryTimer) {
			retryTimer = setTimeout(
				() => {
					retryTimer = undefined;
					void flushOnce();
				},
				2 ** (retryable[0].retries - 1) * 100,
			);
		}
		return "retry" as const;
	};

	const flushOnce = async (): Promise<FlushDisposition> => {
		if (retryTimer) return "retry";
		if (queueSize() === 0) return "empty";
		const queued = dequeue();
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

	const flush = async () => {
		await flushOnce();
	};

	const flushAll = async () => {
		while (queueSize() > 0) {
			const disposition = await flushOnce();
			if (disposition === "retry") return;
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
