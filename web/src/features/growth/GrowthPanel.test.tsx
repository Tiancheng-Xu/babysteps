import { cleanup, render, screen } from "@testing-library/react";
import type { Hash } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	recordActivity: vi.fn(),
	retryRead: vi.fn(),
	switchToSepolia: vi.fn(),
	useGrowth: vi.fn(),
}));

vi.mock("./useGrowth", () => ({
	useGrowth: mocks.useGrowth,
}));

import { GrowthPanel } from "./GrowthPanel";

const transactionHash = `0x${"d".repeat(64)}` as Hash;
let growthState: Record<string, unknown>;

describe("GrowthPanel", () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		growthState = {
			walletState: "ready",
			points: 8n,
			stage: "explorer",
			todayByActivity: { meal: false, walk: false, read: false },
			phase: "idle",
			message: undefined,
			transactionHash: undefined,
			recordActivity: mocks.recordActivity,
			retryRead: mocks.retryRead,
			switchToSepolia: mocks.switchToSepolia,
			isPending: false,
		};
		mocks.useGrowth.mockImplementation(() => growthState);
	});

	it("renders the PRD stage labels, capped progress, and random-state disclaimer", () => {
		growthState.points = 18n;
		growthState.stage = "star";
		render(<GrowthPanel />);

		expect(
			screen.getByRole("heading", { name: "步骤 2 · 虚拟伙伴养成" }),
		).toBeTruthy();
		expect(screen.getByText("闪耀星宝 Star")).toBeTruthy();
		expect(screen.getByText("首轮养成已完成")).toBeTruthy();
		expect(
			screen.getByText(
				"这是随机游戏状态，不代表真实婴儿的饥饿、睡眠或活动需求。",
			),
		).toBeTruthy();
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
			"100",
		);
	});

	it("hides activity buttons while the chain state is still loading", () => {
		growthState.points = undefined;
		growthState.stage = undefined;
		growthState.phase = "reading";
		render(<GrowthPanel />);

		expect(screen.getAllByText("正在读取星宝状态")).toHaveLength(3);
		expect(screen.queryByRole("button", { name: "记录这次陪伴" })).toBeNull();
	});

	it("turns already-recorded activities into story-state messages without leaking a timer", () => {
		growthState.todayByActivity = { meal: true, walk: false, read: true };
		render(<GrowthPanel />);

		expect(screen.getByText("星宝现在还不饿")).toBeTruthy();
		expect(screen.getByText("星宝还在回味故事")).toBeTruthy();
		expect(screen.queryByText(/小时|分钟|倒计时|下次/)).toBeNull();
		expect(screen.getAllByRole("button", { name: "记录这次陪伴" })).toHaveLength(
			1,
		);
	});

	it("keeps pending and confirmed transaction feedback visible with a Sepolia receipt link", () => {
		growthState.phase = "confirming";
		growthState.isPending = true;
		growthState.message = "交易已提交，正在等待链上确认";
		growthState.transactionHash = transactionHash;
		render(<GrowthPanel />);

		expect(screen.getByText("交易已提交，正在等待链上确认")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "查看链上交易" }).getAttribute("href"),
		).toBe(`https://sepolia.etherscan.io/tx/${transactionHash}`);
	});

	it("offers a retry action after a growth read failure", () => {
		growthState.phase = "read-error";
		growthState.message = "读取成长状态失败，请重试。";
		render(<GrowthPanel />);

		expect(screen.getByRole("alert")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "重试读取成长状态" }),
		).toBeTruthy();
	});
});
