import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	draw: vi.fn(),
	fuse: vi.fn(),
	recover: vi.fn(),
	switchToSepolia: vi.fn(),
	useKeepsakes: vi.fn(),
}));

vi.mock("./useKeepsakes", () => ({ useKeepsakes: mocks.useKeepsakes }));

import { KeepsakeGalleryPage } from "./KeepsakeGalleryPage";

let keepsakeState: Record<string, unknown>;

describe("KeepsakeGalleryPage", () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		keepsakeState = {
			isConfigured: true,
			walletState: "ready",
			balance: 24n,
			cards: [
				{ tokenId: 1n, series: 0, rarity: 0, locked: false },
				{ tokenId: 2n, series: 0, rarity: 0, locked: false },
				{ tokenId: 3n, series: 0, rarity: 0, locked: false },
			],
			request: undefined,
			phase: "ready",
			message: undefined,
			transactionHash: undefined,
			isPending: false,
			canRecover: false,
			draw: mocks.draw,
			fuse: mocks.fuse,
			recover: mocks.recover,
			switchToSepolia: mocks.switchToSepolia,
		};
		mocks.useKeepsakes.mockImplementation(() => keepsakeState);
	});

	it("draws for exactly 12 transferable stars and explains every probability", () => {
		render(<KeepsakeGalleryPage />);

		expect(screen.getByRole("heading", { name: "星宝纪念馆" })).toBeTruthy();
		expect(
			screen.getByText("可使用成长星").nextElementSibling?.textContent,
		).toBe("24");
		fireEvent.click(screen.getByRole("button", { name: "抽取纪念卡 · 12 星" }));
		expect(mocks.draw).toHaveBeenCalledOnce();
		for (const chance of [
			"抽取 70%",
			"抽取 22%",
			"抽取 7%",
			"抽取 1%",
			"融合 100%",
			"融合 40%",
		]) {
			expect(screen.getAllByText(chance).length).toBeGreaterThan(0);
		}
	});

	it("selects three eligible cards and submits their exact token IDs", () => {
		render(<KeepsakeGalleryPage />);

		for (const tokenId of [1, 2, 3]) {
			fireEvent.click(
				screen.getByRole("button", { name: `选择纪念卡 #${tokenId}` }),
			);
		}
		fireEvent.click(screen.getByRole("button", { name: "融合升级（3/3）" }));
		expect(mocks.fuse).toHaveBeenCalledWith([1n, 2n, 3n]);
	});

	it("truthfully blocks transactions before the contracts are deployed", () => {
		keepsakeState.isConfigured = false;
		keepsakeState.cards = [];
		render(<KeepsakeGalleryPage />);

		expect(screen.getByRole("status").textContent).toContain(
			"Sepolia 合约尚未配置",
		);
		expect(
			screen
				.getByRole("button", { name: "等待 Sepolia 部署" })
				.hasAttribute("disabled"),
		).toBe(true);
	});

	it("renders the approved dynamic fusion success feedback", () => {
		keepsakeState.phase = "success";
		keepsakeState.request = {
			requestId: 88n,
			kind: 2,
			status: 2,
			requestedAt: 1_786_000_000n,
			tokenIds: [1n, 2n, 3n],
			resultTokenId: 4n,
			burnedTokenId: 0n,
		};
		keepsakeState.cards = [
			{ tokenId: 4n, series: 0, rarity: 1, locked: false },
		];
		render(<KeepsakeGalleryPage />);

		const feedback = screen.getByRole("status", { name: "融合成功反馈" });
		expect(feedback.getAttribute("data-full-motion-ms")).toBe("2100");
		expect(feedback.getAttribute("data-reduced-motion-ms")).toBe("150");
		expect(screen.getByText("融合成功！")).toBeTruthy();
		expect(screen.getAllByText("稀有 · 蛋蛋星宝").length).toBeGreaterThan(0);
	});
});
