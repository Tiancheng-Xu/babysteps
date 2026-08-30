import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	measureBusinessPerformance: vi.fn(),
}));

vi.mock("../../performance/runtime", () => ({
	measureBusinessPerformance: mocks.measureBusinessPerformance,
}));

import { createCompletionApi } from "./completionApi";

const taskKey =
	"11155111:0x1234567890abcdef1234567890abcdef12345678:42" as const;

describe("completionApi", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.measureBusinessPerformance.mockImplementation(
			(_name: string, operation: () => Promise<unknown>) => operation(),
		);
	});

	it("uses credentialed purchased-content and completion requests", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						taskKey,
						purchaseId: "9",
						videoUrl: "https://cdn.example/video.mp4",
						completionInstructions: "完成任务后提交说明。",
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ id: "c1", evidenceHash: `0x${"a".repeat(64)}` }),
					{ status: 201 },
				),
			);
		const api = createCompletionApi("https://api.example", fetcher);

		await api.getContent(taskKey);
		await api.submit(taskKey, {
			evidence: "已完成亲子共读。",
			certificateUri: "ipfs://certificate-1",
		});

		expect(fetcher).toHaveBeenNthCalledWith(
			1,
			`https://api.example/api/tasks/${encodeURIComponent(taskKey)}/content`,
			{ credentials: "include" },
		);
		expect(fetcher).toHaveBeenNthCalledWith(
			2,
			`https://api.example/api/tasks/${encodeURIComponent(taskKey)}/completions`,
			expect.objectContaining({ method: "POST", credentials: "include" }),
		);
		expect(mocks.measureBusinessPerformance).toHaveBeenNthCalledWith(
			1,
			"business.marketplace.content_unlock",
			expect.any(Function),
		);
		expect(mocks.measureBusinessPerformance).toHaveBeenNthCalledWith(
			2,
			"business.marketplace.completion_submit",
			expect.any(Function),
		);
	});

	it("surfaces the stable API error message", async () => {
		const api = createCompletionApi(
			"https://api.example",
			vi
				.fn()
				.mockResolvedValue(
					new Response(
						JSON.stringify({ error: { message: "需要先完成签名登录。" } }),
						{ status: 401 },
					),
				),
		);
		await expect(api.getContent(taskKey)).rejects.toThrow(
			"需要先完成签名登录。",
		);
	});
});
