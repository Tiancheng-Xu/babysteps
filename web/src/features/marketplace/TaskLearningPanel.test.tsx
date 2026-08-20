import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskLearningPanel } from "./TaskLearningPanel";

const taskKey =
	"11155111:0x1234567890abcdef1234567890abcdef12345678:42" as const;

describe("TaskLearningPanel", () => {
	it("unlocks purchased content and submits privacy-safe completion evidence", async () => {
		const api = {
			getContent: vi.fn().mockResolvedValue({
				taskKey,
				purchaseId: "9",
				videoUrl: "https://cdn.example/video.mp4",
				completionInstructions: "完成任务后提交说明。",
			}),
			submit: vi.fn().mockResolvedValue({
				id: "c1",
				evidenceHash: `0x${"a".repeat(64)}`,
			}),
			list: vi.fn(),
		};
		render(<TaskLearningPanel api={api} taskKey={taskKey} />);

		fireEvent.click(screen.getByRole("button", { name: "解锁学习内容" }));
		expect(await screen.findByText("完成任务后提交说明。")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "打开任务视频" }).getAttribute("href"),
		).toBe("https://cdn.example/video.mp4");

		fireEvent.change(screen.getByLabelText("完成说明"), {
			target: { value: "已完成亲子共读。" },
		});
		fireEvent.click(screen.getByRole("button", { name: "提交任务完成审核" }));
		await waitFor(() => expect(api.submit).toHaveBeenCalledOnce());
		expect(screen.getByText(/证据哈希已生成/)).toBeTruthy();
	});
});
