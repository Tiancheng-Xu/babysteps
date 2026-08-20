import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock("./useOwnerCompletionConfirmation", () => ({
	useOwnerCompletionConfirmation: () => ({
		hasCompletionRole: true,
		canConfirm: true,
		confirm: mocks.confirm,
		transactionHash: undefined,
		phase: "ready",
		message: undefined,
		isPending: false,
	}),
}));

import { OwnerCompletionReviewPanel } from "./OwnerCompletionReviewPanel";

describe("OwnerCompletionReviewPanel", () => {
	it("loads D1 submissions and sends the selected hash to the wallet action", async () => {
		const api = {
			getContent: vi.fn(),
			submit: vi.fn(),
			list: vi.fn().mockResolvedValue({
				completions: [
					{
						id: "c1",
						taskKey: "11155111:0x1234567890abcdef1234567890abcdef12345678:42",
						purchaseId: "9",
						buyerWallet: "0x1111111111111111111111111111111111111111",
						evidence: "已完成亲子共读。",
						evidenceHash: `0x${"a".repeat(64)}`,
						certificateUri: "ipfs://certificate-1",
					},
				],
			}),
		};
		render(<OwnerCompletionReviewPanel api={api} />);
		fireEvent.click(screen.getByRole("button", { name: "加载任务完成申请" }));
		expect(await screen.findByText("已完成亲子共读。")).toBeTruthy();
		fireEvent.click(
			screen.getByRole("button", { name: "确认任务完成并铸造 SBT" }),
		);
		expect(mocks.confirm).toHaveBeenCalledOnce();
	});
});
