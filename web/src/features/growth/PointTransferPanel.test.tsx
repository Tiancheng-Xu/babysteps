import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Hash } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	retryRead: vi.fn(),
	setAmount: vi.fn(),
	setRecipient: vi.fn(),
	switchToSepolia: vi.fn(),
	transfer: vi.fn(),
	usePointTransfer: vi.fn(),
}));

vi.mock("./usePointTransfer", () => ({
	usePointTransfer: mocks.usePointTransfer,
}));

import { PointTransferPanel } from "./PointTransferPanel";

const transactionHash = `0x${"e".repeat(64)}` as Hash;
let transferState: Record<string, unknown>;

describe("PointTransferPanel", () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		transferState = {
			walletState: "ready",
			balance: 7n,
			recipient: "",
			setRecipient: mocks.setRecipient,
			amount: "",
			setAmount: mocks.setAmount,
			validationMessage: undefined,
			canTransfer: false,
			phase: "idle",
			message: undefined,
			transactionHash: undefined,
			transfer: mocks.transfer,
			retryRead: mocks.retryRead,
			switchToSepolia: mocks.switchToSepolia,
			isPending: false,
		};
		mocks.usePointTransfer.mockImplementation(() => transferState);
	});

	it("shows the onchain balance and irreversible public-data warning", () => {
		render(<PointTransferPanel />);

		expect(screen.getByText("可赠送成长星")).toBeTruthy();
		expect(screen.getByText("7")).toBeTruthy();
		expect(
			screen.getByText(
				"接收地址、数量和交易会长期公开；测试链转账无法撤回，请逐字核对地址。",
			),
		).toBeTruthy();
		expect(screen.getByText(/收到的成长星不会增加星宝阶段/)).toBeTruthy();
	});

	it("keeps address and integer amount as controlled public inputs", () => {
		render(<PointTransferPanel />);

		fireEvent.change(screen.getByLabelText("Sepolia 收款钱包地址"), {
			target: { value: "0x2222" },
		});
		fireEvent.change(screen.getByLabelText("赠送数量"), {
			target: { value: "2" },
		});

		expect(mocks.setRecipient).toHaveBeenCalledWith("0x2222");
		expect(mocks.setAmount).toHaveBeenCalledWith("2");
		expect(screen.queryByLabelText(/儿童/)).toBeNull();
	});

	it("submits once only when the validated form is available", () => {
		transferState.canTransfer = true;
		transferState.recipient = "0x2222222222222222222222222222222222222222";
		transferState.amount = "2";
		render(<PointTransferPanel />);

		fireEvent.click(screen.getByRole("button", { name: "确认赠送成长星" }));
		expect(mocks.transfer).toHaveBeenCalledOnce();
	});

	it("shows validation and blocks a pending transaction", () => {
		transferState.validationMessage = "可赠送成长星不足。";
		transferState.amount = "8";
		transferState.isPending = true;
		transferState.phase = "awaiting-signature";
		transferState.message = "请在 MetaMask 中核对地址和数量后确认赠送。";
		render(<PointTransferPanel />);

		expect(screen.getByRole("alert").textContent).toContain(
			"可赠送成长星不足。",
		);
		expect(
			(
				screen.getByRole("button", {
					name: "确认赠送成长星",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
		expect(
			screen.getByText("请在 MetaMask 中核对地址和数量后确认赠送。"),
		).toBeTruthy();
	});

	it("links a confirmed transfer to Sepolia Etherscan", () => {
		transferState.phase = "success";
		transferState.message = "赠送成功。";
		transferState.transactionHash = transactionHash;
		render(<PointTransferPanel />);

		expect(
			screen.getByRole("link", { name: "查看赠送交易" }).getAttribute("href"),
		).toBe(`https://sepolia.etherscan.io/tx/${transactionHash}`);
	});

	it("offers a visible Sepolia switch action", () => {
		transferState.walletState = "wrong-network";
		transferState.message = "请切换到 Sepolia 网络。";
		render(<PointTransferPanel />);

		fireEvent.click(screen.getByRole("button", { name: "切换到 Sepolia" }));
		expect(mocks.switchToSepolia).toHaveBeenCalledOnce();
	});
});
