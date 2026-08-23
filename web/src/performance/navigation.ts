import type { PerformanceEventInput } from "./types";

type NavigationEntry = Pick<
	PerformanceNavigationTiming,
	| "domainLookupStart"
	| "domainLookupEnd"
	| "connectStart"
	| "connectEnd"
	| "secureConnectionStart"
	| "requestStart"
	| "responseStart"
	| "responseEnd"
	| "domContentLoadedEventEnd"
	| "loadEventEnd"
>;

export function collectNavigationEvents(
	entry: NavigationEntry,
): PerformanceEventInput[] {
	const duration = (end: number, start: number) => Math.max(0, end - start);
	const timings: Array<[string, number, number]> = [
		["navigation.dns", entry.domainLookupEnd, entry.domainLookupStart],
		["navigation.tcp", entry.connectEnd, entry.connectStart],
		["navigation.tls", entry.connectEnd, entry.secureConnectionStart],
		["navigation.request_wait", entry.responseStart, entry.requestStart],
		["navigation.download", entry.responseEnd, entry.responseStart],
		["navigation.dom_ready", entry.domContentLoadedEventEnd, entry.responseEnd],
		["navigation.window_load", entry.loadEventEnd, entry.responseEnd],
	];
	return timings.map(([name, end, start]) => ({
		type: "custom" as const,
		name,
		value: duration(Number(end), Number(start)),
		unit: "ms" as const,
	}));
}
