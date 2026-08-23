import { afterEach, describe, expect, it, vi } from "vitest";
import { createPerformanceClient } from "./client";

describe("performance client", () => {
	afterEach(() => vi.useRealTimers());

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
		await client.flush();

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(bodies.join("\n")).toContain("LCP");
	});

	it("samples, rate-limits, batches and flushes on a timer", async () => {
		vi.useFakeTimers();
		const sent: string[] = [];
		const client = createPerformanceClient({
			environment: "test",
			version: "v1",
			sampleRate: 1,
			maxEventsPerMinute: 2,
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
			now: (() => {
				let current = 100;
				return () => (current += 25);
			})(),
		});

		await expect(
			client.markOperation("contract.write", async () => "private-result"),
		).resolves.toBe("private-result");
		await client.flush();

		const body = bodies.join("");
		expect(body).toContain("contract.write");
		expect(body).not.toContain("private-result");
	});
});
