import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	clear: vi.fn(),
	connect: vi.fn(),
	disconnect: vi.fn(),
	recordActivity: vi.fn(),
	retryTransferRead: vi.fn(),
	retryGrowthRead: vi.fn(),
	retryNotebookRead: vi.fn(),
	save: vi.fn(),
	setDraft: vi.fn(),
	setTransferAmount: vi.fn(),
	setTransferRecipient: vi.fn(),
	switchGrowthToSepolia: vi.fn(),
	switchNotebookToSepolia: vi.fn(),
	switchWalletToSepolia: vi.fn(),
	useAccount: vi.fn(),
	useConnect: vi.fn(),
	useDisconnect: vi.fn(),
	useGrowth: vi.fn(),
	useNotebook: vi.fn(),
	usePointTransfer: vi.fn(),
	useSwitchChain: vi.fn(),
	transfer: vi.fn(),
}));

vi.mock("./features/growth/useGrowth", () => ({
	useGrowth: mocks.useGrowth,
}));

vi.mock("./features/notebook/useNotebook", () => ({
	useNotebook: mocks.useNotebook,
}));

vi.mock("./features/growth/usePointTransfer", () => ({
	usePointTransfer: mocks.usePointTransfer,
}));

vi.mock("wagmi", async (importOriginal) => {
	const actual = await importOriginal<typeof import("wagmi")>();
	return {
		...actual,
		useAccount: mocks.useAccount,
		useConnect: mocks.useConnect,
		useDisconnect: mocks.useDisconnect,
		useSwitchChain: mocks.useSwitchChain,
	};
});

import App from "./App";

const account = "0x1111111111111111111111111111111111111111" as Address;
const transactionHash = `0x${"c".repeat(64)}` as Hash;

let growthState: Record<string, unknown>;
let notebookState: Record<string, unknown>;
let transferState: Record<string, unknown>;

describe("BabySteps App", () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useConnect.mockReturnValue({
			connect: mocks.connect,
			connectors: [{ id: "metaMask", name: "MetaMask" }],
			isPending: false,
		});
		mocks.useDisconnect.mockReturnValue({ disconnect: mocks.disconnect });
		mocks.useSwitchChain.mockReturnValue({
			switchChainAsync: mocks.switchWalletToSepolia,
		});

		growthState = {
			walletState: "ready",
			points: 0n,
			stage: "egg",
			todayByActivity: { meal: false, walk: false, read: false },
			phase: "idle",
			message: undefined,
			transactionHash: undefined,
			recordActivity: mocks.recordActivity,
			retryRead: mocks.retryGrowthRead,
			switchToSepolia: mocks.switchGrowthToSepolia,
			isPending: false,
		};
		notebookState = {
			walletState: "ready",
			chainNote: "公开测试内容",
			draft: "公开测试内容",
			setDraft: mocks.setDraft,
			save: mocks.save,
			clear: mocks.clear,
			retryRead: mocks.retryNotebookRead,
			switchToSepolia: mocks.switchNotebookToSepolia,
			transactionHash: undefined,
			phase: "idle",
			message: undefined,
			canSave: true,
			canClear: true,
		};
		transferState = {
			walletState: "ready",
			balance: 7n,
			recipient: "",
			setRecipient: mocks.setTransferRecipient,
			amount: "",
			setAmount: mocks.setTransferAmount,
			validationMessage: undefined,
			canTransfer: false,
			phase: "idle",
			message: undefined,
			transactionHash: undefined,
			transfer: mocks.transfer,
			retryRead: mocks.retryTransferRead,
			switchToSepolia: mocks.switchGrowthToSepolia,
			isPending: false,
		};
		mocks.useGrowth.mockImplementation(() => growthState);
		mocks.useNotebook.mockImplementation(() => notebookState);
		mocks.usePointTransfer.mockImplementation(() => transferState);
	});

	it("shows safety boundaries and caps a completed first journey", () => {
		growthState.points = 18n;
		growthState.stage = "star";
		render(<App />);

		expect(screen.getByText("课程概念验证 · Sepolia 测试网")).toBeTruthy();
		expect(
			screen.getByText(
				"成长星无价格，只用于 Sepolia 课程演示；可在测试钱包间赠送，不可兑换。",
			),
		).toBeTruthy();
		expect(screen.getByText(/请只使用专用测试钱包/)).toBeTruthy();
		expect(screen.getByText(/成年照护者自报/)).toBeTruthy();
		expect(screen.getByText(/请勿填写或上传儿童姓名/)).toBeTruthy();
		expect(screen.getByText("累计养成值：18")).toBeTruthy();
		expect(screen.getByText("可赠送成长星：7")).toBeTruthy();
		expect(screen.getByText(/收到的成长星不会增加星宝阶段/)).toBeTruthy();
		expect(screen.getByText("首轮养成已完成")).toBeTruthy();
		expect(screen.queryByText("18 / 15")).toBeNull();
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
			"100",
		);
	});

	it("records only an available activity and labels today's completed card", () => {
		growthState.todayByActivity = { meal: true, walk: false, read: false };
		render(<App />);

		const mealButton = screen.getByRole("button", {
			name: "一起用餐今天已记录",
		}) as HTMLButtonElement;
		expect(mealButton.disabled).toBe(true);

		fireEvent.click(
			screen.getByRole("button", {
				name: "记录户外陪伴，获得 5 枚成长星",
			}),
		);
		expect(mocks.recordActivity).toHaveBeenCalledWith("walk");
	});

	it("keeps signature and confirmation visible and blocks every activity", () => {
		growthState.phase = "awaiting-signature";
		growthState.isPending = true;
		growthState.message = "请在 MetaMask 中确认这次陪伴记录。";
		const { rerender } = render(<App />);

		expect(screen.getByText("请在 MetaMask 中确认这次陪伴记录。")).toBeTruthy();
		for (const button of screen.getAllByRole("button", { name: /^记录/ })) {
			expect((button as HTMLButtonElement).disabled).toBe(true);
		}

		growthState.phase = "confirming";
		growthState.message = "交易已广播，正在等待测试链确认。";
		rerender(<App />);
		expect(screen.getByText("交易已广播，正在等待测试链确认。")).toBeTruthy();
	});

	it("links a confirmed growth transaction to Sepolia Etherscan", () => {
		growthState.phase = "success";
		growthState.transactionHash = transactionHash;
		growthState.message = "记录成功，获得 +7 枚成长星。";
		render(<App />);

		expect(
			screen.getByRole("link", { name: "查看链上交易" }).getAttribute("href"),
		).toBe(`https://sepolia.etherscan.io/tx/${transactionHash}`);
	});

	it("enforces the public notebook UTF-8 byte boundary", () => {
		notebookState.draft = "😀".repeat(71);
		notebookState.canSave = true;
		const { rerender } = render(<App />);

		expect(screen.getByText("284 / 280 字节")).toBeTruthy();
		expect(
			(
				screen.getByRole("button", {
					name: "保存当前便签",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);

		notebookState.draft = "😀".repeat(70);
		rerender(<App />);
		expect(screen.getByText("280 / 280 字节")).toBeTruthy();
		expect(
			(
				screen.getByRole("button", {
					name: "保存当前便签",
				}) as HTMLButtonElement
			).disabled,
		).toBe(false);
	});

	it("requires an explicit confirmation before clearing current note state", () => {
		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "清空当前便签" }));
		expect(mocks.clear).not.toHaveBeenCalled();
		expect(
			screen.getByText("历史交易仍公开，确认只清空当前显示？"),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "确认清空当前便签" }));
		expect(mocks.clear).toHaveBeenCalledOnce();
	});

	it("keeps the notebook visibly separate and warns against child data", () => {
		render(<App />);

		expect(
			screen.getByRole("heading", { name: "公开链上便签（课程实验）" }),
		).toBeTruthy();
		expect(screen.getByText(/历史交易仍然公开/)).toBeTruthy();
		expect(
			screen.getByPlaceholderText("今天完成了一次 Sepolia 测试"),
		).toBeTruthy();
	});
});
