import { describe, expect, it } from "vitest";
import { createLongTaskObserver } from "./longTasks";
import { collectNavigationEvents } from "./navigation";
import { classifyResource } from "./resources";

describe("performance observers", () => {
	it("derives the supported navigation timings in milliseconds", () => {
		const events = collectNavigationEvents({
			domainLookupStart: 1,
			domainLookupEnd: 4,
			connectStart: 4,
			connectEnd: 9,
			secureConnectionStart: 6,
			requestStart: 10,
			responseStart: 22,
			responseEnd: 30,
			domContentLoadedEventEnd: 42,
			loadEventEnd: 55,
		} as PerformanceNavigationTiming);

		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "navigation.request_wait",
					value: 12,
					unit: "ms",
				}),
			]),
		);
	});

	it("classifies same-origin image resources without retaining their URL", () => {
		expect(
			classifyResource(
				{
					initiatorType: "img",
					duration: 24,
					name: "https://app.example/a.png",
				} as PerformanceResourceTiming,
				"https://app.example",
			),
		).toMatchObject({
			name: "resource.image.duration",
			category: "image",
			value: 24,
		});
	});

	it("emits long-task count, total, max, and duration", () => {
		const records: unknown[] = [];
		const Observer = class {
			constructor(private readonly callback: PerformanceObserverCallback) {}
			observe() {
				this.callback(
					{
						getEntries: () => [{ duration: 75 }],
					} as PerformanceObserverEntryList,
					this as unknown as PerformanceObserver,
				);
			}
			disconnect() {}
		};
		const observer = createLongTaskObserver(
			(event) => records.push(event),
			Observer as unknown as typeof PerformanceObserver,
		);

		expect(observer).toBeDefined();
		expect(records).toContainEqual(
			expect.objectContaining({
				name: "longtask.count",
				value: 1,
				unit: "count",
			}),
		);
		expect(records).toContainEqual(
			expect.objectContaining({
				name: "longtask.total",
				value: 75,
				unit: "ms",
			}),
		);
		expect(records).toContainEqual(
			expect.objectContaining({ name: "longtask.max", value: 75, unit: "ms" }),
		);
		expect(records).toContainEqual(
			expect.objectContaining({
				name: "longtask.duration",
				value: 75,
				unit: "ms",
			}),
		);
	});
});
