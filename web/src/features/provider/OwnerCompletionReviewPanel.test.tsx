import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompletionApi } from "../marketplace/completionApi";

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

afterEach(cleanup);

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				gcTime: Number.POSITIVE_INFINITY,
				retry: false,
			},
		},
	});
}

function queryWrapper(client = createTestQueryClient()) {
	return function QueryWrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		);
	};
}

function reviewRecord(id: string, evidence: string) {
	return {
		id,
		taskKey: "11155111:0x1234567890abcdef1234567890abcdef12345678:42",
		purchaseId: "9",
		buyerWallet: "0x1111111111111111111111111111111111111111",
		evidence,
		evidenceHash: `0x${"a".repeat(64)}`,
		certificateUri: "ipfs://certificate-1",
	};
}

function createListMock() {
	return vi.fn<CompletionApi["list"]>();
}

function completionApi(list: CompletionApi["list"]): CompletionApi {
	return {
		getContent: vi.fn<CompletionApi["getContent"]>(),
		submit: vi.fn<CompletionApi["submit"]>(),
		list,
	};
}

describe("OwnerCompletionReviewPanel", () => {
	it("loads D1 submissions and sends the selected hash to the wallet action", async () => {
		const api = completionApi(
			createListMock().mockResolvedValue({
				completions: [reviewRecord("c1", "已完成亲子共读。")],
			}),
		);
		render(<OwnerCompletionReviewPanel api={api} />, {
			wrapper: queryWrapper(),
		});
		fireEvent.click(screen.getByRole("button", { name: "加载任务完成申请" }));
		expect(await screen.findByText("已完成亲子共读。")).toBeTruthy();
		fireEvent.click(
			screen.getByRole("button", { name: "确认任务完成并铸造 SBT" }),
		);
		expect(mocks.confirm).toHaveBeenCalledOnce();
	});

	it("keeps D1 idle until requested and disables duplicate loads while pending", async () => {
		let resolveList!: (value: {
			completions: ReturnType<typeof reviewRecord>[];
		}) => void;
		const pendingList = new Promise<{
			completions: ReturnType<typeof reviewRecord>[];
		}>((resolve) => {
			resolveList = resolve;
		});
		const list = createListMock().mockReturnValue(pendingList);
		const api = completionApi(list);

		render(<OwnerCompletionReviewPanel api={api} />, {
			wrapper: queryWrapper(),
		});
		expect(list).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "加载任务完成申请" }));
		const loadingButton = await screen.findByRole("button", {
			name: "正在加载",
		});
		expect((loadingButton as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(loadingButton);
		expect(list).toHaveBeenCalledOnce();

		resolveList({ completions: [] });
		expect(
			await screen.findByText("当前没有待审核的任务完成申请。"),
		).toBeTruthy();
	});

	it("shows a D1 error and retries only after another explicit request", async () => {
		const list = createListMock()
			.mockRejectedValueOnce(new Error("D1 暂时不可用"))
			.mockResolvedValueOnce({
				completions: [reviewRecord("c2", "重试后读取成功。")],
			});
		const api = completionApi(list);

		render(<OwnerCompletionReviewPanel api={api} />, {
			wrapper: queryWrapper(),
		});
		fireEvent.click(screen.getByRole("button", { name: "加载任务完成申请" }));
		expect(await screen.findByText("D1 暂时不可用")).toBeTruthy();
		expect(list).toHaveBeenCalledOnce();

		fireEvent.click(screen.getByRole("button", { name: "加载任务完成申请" }));
		expect(await screen.findByText("重试后读取成功。")).toBeTruthy();
		expect(list).toHaveBeenCalledTimes(2);
	});

	it("does not expose the previous authenticated session after remount", async () => {
		const firstSessionList = createListMock().mockResolvedValue({
			completions: [reviewRecord("c3", "上一会话的审核申请。")],
		});
		const nextSessionList = createListMock().mockResolvedValue({
			completions: [reviewRecord("c4", "当前会话的审核申请。")],
		});
		const client = createTestQueryClient();
		const wrapper = queryWrapper(client);

		const firstRender = render(
			<OwnerCompletionReviewPanel api={completionApi(firstSessionList)} />,
			{ wrapper },
		);
		fireEvent.click(screen.getByRole("button", { name: "加载任务完成申请" }));
		expect(await screen.findByText("上一会话的审核申请。")).toBeTruthy();
		firstRender.unmount();

		render(
			<OwnerCompletionReviewPanel api={completionApi(nextSessionList)} />,
			{
				wrapper,
			},
		);
		expect(screen.queryByText("上一会话的审核申请。")).toBeNull();
		expect(nextSessionList).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "加载任务完成申请" }));
		expect(await screen.findByText("当前会话的审核申请。")).toBeTruthy();
		expect(nextSessionList).toHaveBeenCalledOnce();
	});

	it("hides stale review records and confirmation actions after refresh fails", async () => {
		const list = createListMock()
			.mockResolvedValueOnce({
				completions: [reviewRecord("c5", "刷新前的审核申请。")],
			})
			.mockRejectedValueOnce(new Error("刷新失败，请重新加载"));

		render(<OwnerCompletionReviewPanel api={completionApi(list)} />, {
			wrapper: queryWrapper(),
		});
		fireEvent.click(screen.getByRole("button", { name: "加载任务完成申请" }));
		expect(await screen.findByText("刷新前的审核申请。")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "确认任务完成并铸造 SBT" }),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "加载任务完成申请" }));
		expect(await screen.findByText("刷新失败，请重新加载")).toBeTruthy();
		expect(screen.queryByText("刷新前的审核申请。")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "确认任务完成并铸造 SBT" }),
		).toBeNull();
	});
});
