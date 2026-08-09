import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketplaceTask } from "./marketplaceModel";

const mocks = vi.hoisted(() => ({
	approve: vi.fn(),
	buy: vi.fn(),
	switchToSepolia: vi.fn(),
	useTaskPurchase: vi.fn(),
}));

vi.mock("./useTaskPurchase", () => ({
	useTaskPurchase: mocks.useTaskPurchase,
}));

import { MarketplaceTaskCard } from "./MarketplaceTaskCard";

const provider = "0x2222222222222222222222222222222222222222" as Address;
const task: MarketplaceTask = {
	id: 7n,
	provider,
	payee: provider,
	activity: "read",
	activityLabel: "亲子共读",
	metadataUri: "ipfs://task-7",
	requestId: 9n,
	price: 3n * 10n ** 18n,
	priceLabel: "3 BABY",
	opensAt: 1_000n,
	closesAt: 10_000n,
	state: "active",
};

describe("MarketplaceTaskCard", () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.useTaskPurchase.mockReturnValue({
			walletState: "ready",
			phase: "ready-to-approve",
			message: undefined,
			balance: 8n * 10n ** 18n,
			allowance: 0n,
			hasPurchased: false,
			canApprove: true,
			canBuy: false,
			isPending: false,
			approvalHash: undefined,
			purchaseHash: undefined,
			approve: mocks.approve,
			buy: mocks.buy,
			switchToSepolia: mocks.switchToSepolia,
		});
	});

	it("shows verified task data and starts with exact approval", () => {
		render(<MarketplaceTaskCard task={task} />);

		expect(screen.getByRole("heading", { name: "亲子共读" })).toBeTruthy();
		expect(screen.getByText("0x2222…2222")).toBeTruthy();
		expect(screen.getByText("余额 8 BABY")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "授权 3 BABY" }));
		expect(mocks.approve).toHaveBeenCalledOnce();
	});

	it("requires a separate purchase after allowance is sufficient", () => {
		mocks.useTaskPurchase.mockReturnValue({
			...mocks.useTaskPurchase(),
			phase: "ready-to-buy",
			canApprove: false,
			canBuy: true,
		});
		render(<MarketplaceTaskCard task={task} />);

		fireEvent.click(screen.getByRole("button", { name: "支付 3 BABY" }));
		expect(mocks.buy).toHaveBeenCalledOnce();
		expect(mocks.approve).not.toHaveBeenCalled();
	});

	it("offers a Sepolia switch without attempting a purchase", () => {
		mocks.useTaskPurchase.mockReturnValue({
			...mocks.useTaskPurchase(),
			walletState: "wrong-network",
			phase: "unavailable",
			canApprove: false,
		});
		render(<MarketplaceTaskCard task={task} />);

		fireEvent.click(screen.getByRole("button", { name: "切换到 Sepolia" }));
		expect(mocks.switchToSepolia).toHaveBeenCalledOnce();
		expect(mocks.approve).not.toHaveBeenCalled();
		expect(mocks.buy).not.toHaveBeenCalled();
	});

	it("shows the confirmed purchase hash as public evidence", () => {
		const purchaseHash = `0x${"b".repeat(64)}` as Hash;
		mocks.useTaskPurchase.mockReturnValue({
			...mocks.useTaskPurchase(),
			phase: "success",
			message: "购买已确认，等待完成记录与成长证书。",
			canApprove: false,
			purchaseHash,
		});
		render(<MarketplaceTaskCard task={task} />);

		expect(screen.getByRole("status").textContent).toContain("购买已确认");
		expect(
			screen.getByRole("link", { name: "查看购买交易" }).getAttribute("href"),
		).toBe(`https://sepolia.etherscan.io/tx/${purchaseHash}`);
	});
});
