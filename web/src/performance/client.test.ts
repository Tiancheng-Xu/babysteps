import { afterEach, describe, expect, it, vi } from "vitest";
import { createPerformanceClient, normalizeMaxEventsPerMinute } from "./client";

describe("performance client", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("bounds a configured per-page event budget to the Worker quota", () => {
		expect(normalizeMaxEventsPerMinute(20)).toBe(20);
		expect(normalizeMaxEventsPerMinute(999)).toBe(120);
		expect(normalizeMaxEventsPerMinute(Number.NaN)).toBe(120);
		expect(normalizeMaxEventsPerMinute(0)).toBe(1);
	});

	it("observes fast real interactions instead of dropping good INP samples", async () => {
		const onINP = vi.fn();
		const mark = vi.spyOn(performance, "mark");
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			reportAllWebVitalChanges: true,
			loadWebVitals: async () =>
				({
					onCLS: vi.fn(),
					onFCP: vi.fn(),
					onINP,
					onLCP: vi.fn(),
					onTTFB: vi.fn(),
				}) as unknown as typeof import("web-vitals"),
		});

		client.start();
		await vi.waitFor(() => expect(onINP).toHaveBeenCalledOnce());

		expect(onINP.mock.calls[0]?.[1]).toEqual({
			durationThreshold: 0,
			reportAllChanges: true,
		});
		expect(mark).toHaveBeenCalledWith("babysteps.web-vitals.ready");
		client.stop();
	});

	it("does not synthesize CLS when the browser never reports it", async () => {
		const bodies: string[] = [];
		const onCLS = vi.fn();
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			beacon: (_url, body) => {
				bodies.push(String(body));
				return true;
			},
			random: () => 0,
			loadWebVitals: async () =>
				({
					onCLS,
					onFCP: vi.fn(),
					onINP: vi.fn(),
					onLCP: vi.fn(),
					onTTFB: vi.fn(),
				}) as unknown as typeof import("web-vitals"),
		});

		client.start();
		await vi.waitFor(() => expect(onCLS).toHaveBeenCalledOnce());
		expect(onCLS.mock.calls[0]?.[1]).toBeUndefined();
		vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
		document.dispatchEvent(new Event("visibilitychange"));
		await client.flush();

		const cls = bodies
			.flatMap((body) => JSON.parse(body).events)
			.filter((event) => event.name === "CLS");
		expect(cls).toEqual([]);
		client.stop();
	});

	it("does not duplicate CLS when web-vitals already reported a shift", async () => {
		const bodies: string[] = [];
		let reportCLS: ((metric: { value: number }) => void) | undefined;
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			beacon: (_url, body) => {
				bodies.push(String(body));
				return true;
			},
			random: () => 0,
			loadWebVitals: async () =>
				({
					onCLS: (callback: (metric: { value: number }) => void) => {
						reportCLS = callback;
					},
					onFCP: vi.fn(),
					onINP: vi.fn(),
					onLCP: vi.fn(),
					onTTFB: vi.fn(),
				}) as unknown as typeof import("web-vitals"),
		});

		client.start();
		await vi.waitFor(() => expect(reportCLS).toBeTypeOf("function"));
		reportCLS?.({ value: 0.04 });
		vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
		document.dispatchEvent(new Event("visibilitychange"));
		await client.flush();

		const cls = bodies
			.flatMap((body) => JSON.parse(body).events)
			.filter((event) => event.name === "CLS");
		expect(cls).toEqual([expect.objectContaining({ value: 0.04 })]);
		client.stop();
	});

	it("batches sanitized events and prefers sendBeacon", async () => {
		const beacon = vi.fn((_url: string, _data: BodyInit) => true);
		const fetcher = vi.fn();
		const client = createPerformanceClient({
			environment: "preview",
			version: "abc123",
			route: () => "/tasks/123?token=secret#detail",
			beacon,
			fetcher,
			random: () => 0,
		});

		client.record({ type: "metric", name: "LCP", value: 123.4, unit: "ms" });
		await client.flush();

		expect(beacon).toHaveBeenCalledOnce();
		const payload = JSON.parse(String(beacon.mock.calls[0]?.[1]));
		expect(payload.events[0]).toMatchObject({
			type: "metric",
			name: "LCP",
			route: "/tasks/:id",
			environment: "preview",
			version: "abc123",
		});
		expect(payload.schemaVersion).toBe(2);
		expect(JSON.stringify(payload)).not.toContain("secret");
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("falls back to keepalive fetch and never rejects into the host app", async () => {
		const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
		const client = createPerformanceClient({
			environment: "production",
			version: "v1",
			beacon: () => false,
			fetcher,
			random: () => 0,
			loadWebVitals: () => new Promise(() => {}),
		});

		client.record({
			type: "error",
			name: "TypeError",
			value: 1,
			unit: "count",
		});
		await expect(client.flush()).resolves.toBeUndefined();
		expect(fetcher).toHaveBeenCalledWith(
			"/api/performance/events",
			expect.objectContaining({ method: "POST", keepalive: true }),
		);
	});

	it("requeues a batch when the upstream returns a non-success response", async () => {
		vi.useFakeTimers();
		const bodies: string[] = [];
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockImplementationOnce(async (_url, init) => {
				bodies.push(String(init?.body));
				return new Response(null, { status: 202 });
			});
		const client = createPerformanceClient({
			environment: "production",
			version: "v1",
			endpoint: "https://babysteps-api.example/api/performance/events",
			beacon: () => false,
			fetcher,
			random: () => 0,
		});
		client.record({ type: "metric", name: "LCP", value: 123, unit: "ms" });

		await client.flush();
		await vi.advanceTimersByTimeAsync(100);

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(bodies.join("\n")).toContain("LCP");
	});

	it("drops a client-error batch instead of retaining it", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 400 }));
		const client = createPerformanceClient({
			environment: "production",
			version: "v1",
			beacon: () => false,
			fetcher,
			random: () => 0,
		});
		client.record({ type: "metric", name: "LCP", value: 123, unit: "ms" });

		await client.flush();
		await client.flush();

		expect(fetcher).toHaveBeenCalledOnce();
	});

	it("retries throttled or server-error batches no more than three times", async () => {
		vi.useFakeTimers();
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 503 }));
		const client = createPerformanceClient({
			environment: "production",
			version: "v1",
			beacon: () => false,
			fetcher,
			random: () => 0,
		});
		client.record({ type: "metric", name: "LCP", value: 123, unit: "ms" });

		await client.flush();
		await vi.advanceTimersByTimeAsync(100);
		await vi.advanceTimersByTimeAsync(200);
		await vi.advanceTimersByTimeAsync(400);

		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it("sends high-priority vital events before resource backlog", async () => {
		const sent: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			batchSize: 20,
			beacon: (_url, body) => {
				sent.push(String(body));
				return true;
			},
			random: () => 0,
		});
		client.record({
			type: "resource",
			name: "resource.image.duration",
			value: 10,
			unit: "ms",
			category: "image",
		});
		client.record({ type: "metric", name: "LCP", value: 20, unit: "ms" });

		await client.flush();

		expect(JSON.parse(sent[0] ?? "").events[0]).toMatchObject({
			name: "LCP",
		});
	});

	it("does not let repeated script timings starve distinct resource coverage", async () => {
		const sent: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			maxEventsPerMinute: 30,
			batchSize: 50,
			beacon: (_url, body) => {
				sent.push(String(body));
				return true;
			},
			random: () => 0,
		});
		for (let index = 0; index < 100; index += 1) {
			client.record({
				type: "resource",
				name: "resource.script.duration",
				value: index,
				unit: "ms",
				category: "script",
			});
		}
		for (const category of ["fetch", "xhr", "stylesheet", "image"] as const) {
			client.record({
				type: "resource",
				name: `resource.${category}.duration`,
				value: 1,
				unit: "ms",
				category,
			});
		}

		await client.flush();
		await client.flush();

		const names = sent.flatMap((body) =>
			JSON.parse(body).events.map((event: { name: string }) => event.name),
		);
		expect(names).toEqual(
			expect.arrayContaining([
				"resource.fetch.duration",
				"resource.xhr.duration",
				"resource.stylesheet.duration",
				"resource.image.duration",
			]),
		);
		expect(
			names.filter((name: string) => name === "resource.script.duration"),
		).toHaveLength(1);
	});

	it("does not let modulepreload stylesheet timings starve rendering and later resource categories", async () => {
		const sent: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			maxEventsPerMinute: 30,
			batchSize: 50,
			beacon: (_url, body) => {
				sent.push(String(body));
				return true;
			},
			random: () => 0,
		});
		for (let index = 0; index < 100; index += 1) {
			client.record({
				type: "resource",
				name: "resource.stylesheet.duration",
				value: index,
				unit: "ms",
				category: "stylesheet",
			});
		}
		client.record({
			type: "custom",
			name: "hydration.duration",
			value: 12,
			unit: "ms",
		});
		client.record({
			type: "resource",
			name: "resource.font.duration",
			value: 8,
			unit: "ms",
			category: "font",
		});
		client.record({
			type: "resource",
			name: "resource.duration",
			value: 4,
			unit: "ms",
		});

		await client.flush();

		const names = JSON.parse(sent[0] ?? "").events.map(
			(event: { name: string }) => event.name,
		);
		expect(names).toEqual(
			expect.arrayContaining([
				"hydration.duration",
				"resource.font.duration",
				"resource.duration",
			]),
		);
		expect(
			names.filter((name: string) => name === "resource.stylesheet.duration"),
		).toHaveLength(2);
	});

	it("preserves repeated non-script diagnostics inside the low-priority budget", async () => {
		const sent: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			maxEventsPerMinute: 30,
			batchSize: 20,
			beacon: (_url, body) => {
				sent.push(String(body));
				return true;
			},
			random: () => 0,
		});
		client.record({
			type: "custom",
			name: "longtask.duration",
			value: 51,
			unit: "ms",
		});
		client.record({
			type: "custom",
			name: "longtask.duration",
			value: 72,
			unit: "ms",
		});

		await client.flush();

		expect(
			JSON.parse(sent[0] ?? "").events.filter(
				(event: { name: string }) => event.name === "longtask.duration",
			),
		).toHaveLength(2);
	});

	it("reserves one third of the minute budget for vitals, errors, and Web3", async () => {
		const sent: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			maxEventsPerMinute: 7,
			batchSize: 20,
			beacon: (_url, body) => {
				sent.push(String(body));
				return true;
			},
			random: () => 0,
		});
		for (let index = 0; index < 7; index += 1) {
			client.record({
				type: "resource",
				name: "resource.image.duration",
				value: index,
				unit: "ms",
				category: "image",
			});
		}
		client.record({ type: "metric", name: "LCP", value: 1, unit: "ms" });
		client.record({
			type: "error",
			name: "error.javascript.unknown",
			value: 1,
			unit: "count",
			category: "unknown",
		});
		await client.markOperation("contract.read", async () => undefined);
		await client.flush();
		await client.flush();

		expect(sent.join("\n")).toContain('"name":"LCP"');
		expect(sent.join("\n")).toContain('"name":"error.javascript.unknown"');
		expect(sent.join("\n")).toContain('"name":"contract.read"');
	});

	it("does not let repeated RPC diagnostics starve a later SPA interaction", async () => {
		const sent: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			maxEventsPerMinute: 30,
			batchSize: 50,
			beacon: (_url, body) => {
				sent.push(String(body));
				return true;
			},
			random: () => 0,
		});
		for (let index = 0; index < 100; index += 1) {
			client.record({
				type: "web3",
				name: index % 2 === 0 ? "rpc.read" : "web3.rpc.read",
				value: index,
				unit: "ms",
			});
		}
		client.record({
			type: "custom",
			name: "spa.route.duration",
			value: 20,
			unit: "ms",
		});

		await client.flush();
		await client.flush();

		const names = sent.flatMap((body) =>
			JSON.parse(body).events.map((event: { name: string }) => event.name),
		);
		expect(names).toContain("spa.route.duration");
		expect(names.filter((name: string) => name === "rpc.read")).toHaveLength(2);
		expect(
			names.filter((name: string) => name === "web3.rpc.read"),
		).toHaveLength(2);
	});

	it("reserves coverage-critical browser metrics after unrelated diagnostics fill the low-priority lane", async () => {
		const sent: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			maxEventsPerMinute: 30,
			batchSize: 50,
			beacon: (_url, body) => {
				sent.push(String(body));
				return true;
			},
			random: () => 0,
		});
		for (let index = 0; index < 20; index += 1) {
			client.record({
				type: "custom",
				name: `diagnostic.${index}`,
				value: index,
				unit: "ms",
			});
		}
		for (const name of [
			"navigation.dns",
			"navigation.tcp",
			"navigation.tls",
			"resource.xhr.duration",
			"resource.image.duration",
			"resource.font.duration",
			"spa.route.duration",
		]) {
			client.record({
				type: name.startsWith("resource.") ? "resource" : "custom",
				name,
				value: name.startsWith("navigation.") ? 0 : 8,
				unit: "ms",
				...(name.startsWith("navigation.")
					? { outcome: "unavailable" as const }
					: {}),
			});
		}

		await client.flush();
		await client.flush();

		const names = sent.flatMap((body) =>
			JSON.parse(body).events.map((event: { name: string }) => event.name),
		);
		expect(names).toEqual(
			expect.arrayContaining([
				"navigation.dns",
				"navigation.tcp",
				"navigation.tls",
				"resource.xhr.duration",
				"resource.image.duration",
				"resource.font.duration",
				"spa.route.duration",
			]),
		);
	});

	it("backs off network failures and pagehide does not immediately retry them", async () => {
		vi.useFakeTimers();
		const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			beacon: () => false,
			fetcher,
			random: () => 0,
			loadWebVitals: () => new Promise(() => {}),
		});
		client.start();
		client.record({ type: "metric", name: "LCP", value: 1, unit: "ms" });
		globalThis.dispatchEvent(new Event("pagehide"));
		await Promise.resolve();
		await Promise.resolve();

		expect(fetcher).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(99);
		expect(fetcher).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		expect(fetcher).toHaveBeenCalledTimes(2);
		client.stop();
	});

	it("drains ready pagehide batches while retrying their failed batch first at its deadline", async () => {
		vi.useFakeTimers();
		const names: string[] = [];
		const fetcher = vi.fn(async (_url, init) => {
			const name = JSON.parse(String(init?.body)).events[0].name as string;
			names.push(name);
			return new Response(null, {
				status: name === "resource.image.duration" ? 503 : 202,
			});
		});
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			batchSize: 20,
			flushIntervalMs: 10_000,
			beacon: () => false,
			fetcher,
			random: () => 0,
			loadWebVitals: () => new Promise(() => {}),
		});
		client.start();
		client.record({
			type: "resource",
			name: "resource.image.duration",
			value: 1,
			unit: "ms",
			category: "image",
		});
		await client.flush();
		client.record({ type: "metric", name: "FCP", value: 2, unit: "ms" });
		globalThis.dispatchEvent(new Event("pagehide"));
		await vi.advanceTimersByTimeAsync(0);
		client.record({ type: "metric", name: "LCP", value: 3, unit: "ms" });

		expect(names).toEqual(["resource.image.duration", "FCP"]);
		await vi.advanceTimersByTimeAsync(100);
		expect(names).toEqual([
			"resource.image.duration",
			"FCP",
			"resource.image.duration",
		]);
		await vi.advanceTimersByTimeAsync(200);
		expect(names).toEqual([
			"resource.image.duration",
			"FCP",
			"resource.image.duration",
			"resource.image.duration",
		]);
		client.stop();
	});

	it("samples, rate-limits, batches and flushes on a timer", async () => {
		vi.useFakeTimers();
		const sent: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			sampleRate: 1,
			maxEventsPerMinute: 3,
			batchSize: 2,
			flushIntervalMs: 5_000,
			beacon: (_url, body) => {
				sent.push(String(body));
				return true;
			},
			fetcher: vi.fn(),
			random: () => 0,
		});

		client.start();
		client.record({ type: "custom", name: "first", value: 1, unit: "ms" });
		client.record({ type: "custom", name: "second", value: 2, unit: "ms" });
		client.record({ type: "custom", name: "third", value: 3, unit: "ms" });
		await vi.runOnlyPendingTimersAsync();
		client.stop();

		expect(sent).toHaveLength(1);
		expect(JSON.parse(sent[0] ?? "").events).toHaveLength(2);
	});

	it("measures a successful Web3 operation without recording its result", async () => {
		const bodies: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			beacon: (_url, body) => {
				bodies.push(String(body));
				return true;
			},
			fetcher: vi.fn(),
			random: () => 0,
		});

		await expect(
			client.markOperation("contract.write", async () => "private-result"),
		).resolves.toBe("private-result");
		await client.flush();

		const body = bodies.join("");
		expect(body).toContain("contract.write");
		expect(body).not.toContain("private-result");
	});

	it("measures bounded business success and failure without recording private results", async () => {
		const bodies: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			beacon: (_url, body) => {
				bodies.push(String(body));
				return true;
			},
			fetcher: vi.fn(),
			random: () => 0,
		});

		await expect(
			client.markBusinessOperation(
				"business.growth.activity",
				async () => "private-result",
			),
		).resolves.toBe("private-result");
		await expect(
			client.markBusinessOperation("business.marketplace.buy", async () => {
				throw new Error("private-failure");
			}),
		).rejects.toThrow("private-failure");
		await client.flush();

		const events = bodies.flatMap(
			(body) => JSON.parse(body).events as Array<Record<string, unknown>>,
		);
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "business",
					name: "business.growth.activity",
					outcome: "success",
				}),
				expect.objectContaining({
					type: "business",
					name: "business.marketplace.buy.error",
					outcome: "failure",
				}),
			]),
		);
		expect(JSON.stringify(events)).not.toContain("private-result");
		expect(JSON.stringify(events)).not.toContain("private-failure");
	});
});
