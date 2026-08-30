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
	| "serverTiming"
>;

export function collectNavigationEvents(
	entry: NavigationEntry,
): PerformanceEventInput[] {
	const duration = (end: number, start: number) => Math.max(0, end - start);
	const timings: Array<[string, number, number]> = [
		["navigation.dns", entry.domainLookupEnd, entry.domainLookupStart],
		["navigation.tcp", entry.connectEnd, entry.connectStart],
		["navigation.request_wait", entry.responseStart, entry.requestStart],
		["navigation.download", entry.responseEnd, entry.responseStart],
		["navigation.dom_ready", entry.domContentLoadedEventEnd, entry.responseEnd],
		[
			"navigation.window_load",
			entry.loadEventEnd,
			entry.domContentLoadedEventEnd,
		],
	];
	const events = timings.map(([name, end, start]) => {
		const value = duration(Number(end), Number(start));
		const connectionPhase =
			name === "navigation.dns" || name === "navigation.tcp";
		return {
			type: "custom" as const,
			name,
			value,
			unit: "ms" as const,
			...(connectionPhase && value === 0
				? { outcome: "unavailable" as const }
				: {}),
		};
	});
	events.splice(2, 0, {
		type: "custom",
		name: "navigation.tls",
		value:
			entry.secureConnectionStart > 0
				? duration(entry.connectEnd, entry.secureConnectionStart)
				: 0,
		unit: "ms",
		...(entry.secureConnectionStart > 0
			? {}
			: { outcome: "unavailable" as const }),
	});
	const ssr = Array.from(entry.serverTiming ?? []).find(
		(timing) => timing.name === "babysteps_ssr",
	);
	if (ssr && Number.isFinite(ssr.duration) && ssr.duration >= 0) {
		events.push({
			type: "custom",
			name: "ssr.shell.duration",
			value: ssr.duration,
			unit: "ms",
		});
	}
	return events;
}
