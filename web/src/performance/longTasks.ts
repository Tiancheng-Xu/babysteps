import type { PerformanceEventInput } from "./types";

export function createLongTaskObserver(
	record: (event: PerformanceEventInput) => void,
	Observer:
		| typeof PerformanceObserver
		| undefined = globalThis.PerformanceObserver,
): PerformanceObserver | undefined {
	if (!Observer) return undefined;
	let count = 0;
	let total = 0;
	let max = 0;
	try {
		const observer = new Observer((list) => {
			for (const entry of list.getEntries()) {
				if (!Number.isFinite(entry.duration)) continue;
				count += 1;
				total += entry.duration;
				max = Math.max(max, entry.duration);
				record({
					type: "custom",
					name: "longtask.duration",
					value: entry.duration,
					unit: "ms",
				});
				record({
					type: "custom",
					name: "longtask.count",
					value: count,
					unit: "count",
				});
				record({
					type: "custom",
					name: "longtask.total",
					value: total,
					unit: "ms",
				});
				record({
					type: "custom",
					name: "longtask.max",
					value: max,
					unit: "ms",
				});
			}
		});
		observer.observe({ type: "longtask", buffered: true });
		return observer;
	} catch {
		return undefined;
	}
}
