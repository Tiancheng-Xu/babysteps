import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Hash } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	clear: vi.fn(),
	retryRead: vi.fn(),
	save: vi.fn(),
	setDraft: vi.fn(),
	switchToSepolia: vi.fn(),
	useNotebook: vi.fn(),
}));

vi.mock("./useNotebook", () => ({
	useNotebook: mocks.useNotebook,
}));

import { NotebookPanel } from "./NotebookPanel";

const transactionHash = `0x${"f".repeat(64)}` as Hash;
let notebookState: Record<string, unknown>;

describe("NotebookPanel", () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		notebookState = {
			walletState: "ready",
			chainNote: "公开测试内容",
			draft: "今天完成了一次 Sepolia 测试",
			setDraft: mocks.setDraft,
			save: mocks.save,
			clear: mocks.clear,
			retryRead: mocks.retryRead,
			switchToSepolia: mocks.switchToSepolia,
			transactionHash: undefined,
			phase: "idle",
			message: undefined,
			canSave: true,
			canClear: true,
		};
		mocks.useNotebook.mockImplementation(() => notebookState);
	});

	it("keeps the public notebook warning, byte counter, and current onchain note visible", () => {
		render(<NotebookPanel />);

		expect(
			screen.getByRole("heading", { name: "步骤 4 · 原始作业能力" }),
		).toBeTruthy();
		expect(screen.getByText("公开内容")).toBeTruthy();
		expect(screen.getByText(/链上内容公开/)).toBeTruthy();
		expect(screen.getByText("当前链上便签")).toBeTruthy();
		expect(screen.getByText("今天完成了一次 Sepolia 测试")).toBeTruthy();
		expect(screen.getByText("36 / 280 字节")).toBeTruthy();
	});

	it("requires an inline confirmation before clearing the current notebook view", () => {
		render(<NotebookPanel />);

		fireEvent.click(screen.getByRole("button", { name: "清空当前便签" }));
		expect(mocks.clear).not.toHaveBeenCalled();
		expect(
			screen.getByText("历史交易仍公开，确认只清空当前显示？"),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "确认清空当前便签" }));
		expect(mocks.clear).toHaveBeenCalledOnce();
	});

	it("disables duplicate note writes during confirmation and keeps the receipt link visible", () => {
		notebookState.phase = "confirming";
		notebookState.message = "交易已广播，正在等待链上确认。";
		notebookState.transactionHash = transactionHash;
		render(<NotebookPanel />);

		expect(
			(
				screen.getByRole("button", {
					name: "保存当前便签",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
		expect(
			screen.getByRole("link", { name: "查看便签交易" }).getAttribute("href"),
		).toBe(`https://sepolia.etherscan.io/tx/${transactionHash}`);
	});
});
