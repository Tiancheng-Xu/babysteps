import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	connect: vi.fn(),
	disconnect: vi.fn(),
	switchChainAsync: vi.fn(),
	useAccount: vi.fn(),
	useConnect: vi.fn(),
	useDisconnect: vi.fn(),
	useSwitchChain: vi.fn(),
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

import { WalletPanel } from "./WalletPanel";

const address = "0x1111111111111111111111111111111111111111" as Address;

function installMetaMask() {
	Object.defineProperty(window, "ethereum", {
		configurable: true,
		value: { isMetaMask: true },
	});
}

describe("WalletPanel", () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		installMetaMask();
		mocks.useAccount.mockReturnValue({
			address,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useConnect.mockReturnValue({
			connect: mocks.connect,
			connectors: [{ id: "metaMask", name: "MetaMask" }],
			error: undefined,
			isPending: false,
		});
		mocks.useDisconnect.mockReturnValue({ disconnect: mocks.disconnect });
		mocks.useSwitchChain.mockReturnValue({
			switchChainAsync: mocks.switchChainAsync,
		});
	});

	it("guides a user to install MetaMask before any wallet actions", () => {
		Object.defineProperty(window, "ethereum", {
			configurable: true,
			value: undefined,
		});

		render(<WalletPanel />);

		expect(
			screen.getByRole("heading", { name: "步骤 1 · 连接测试钱包" }),
		).toBeTruthy();
		expect(screen.getByText(/尚未安装 MetaMask/)).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "安装 MetaMask" }).getAttribute("href"),
		).toBe("https://metamask.io/download/");
		expect(document.body.textContent).not.toMatch(/作业|课程|老师|验收/);
	});

	it("shows the disconnected state in plain language for non-technical users", () => {
		mocks.useAccount.mockReturnValue({
			address: undefined,
			chainId: undefined,
			isConnected: false,
		});

		render(<WalletPanel />);

		expect(screen.getByText("尚未连接测试钱包")).toBeTruthy();
		expect(screen.getByRole("button", { name: "连接 MetaMask" })).toBeTruthy();
		expect(document.body.textContent).not.toMatch(/作业|课程|老师|验收/);
	});

	it("keeps the connect action visibly pending without allowing a duplicate click", () => {
		mocks.useAccount.mockReturnValue({
			address: undefined,
			chainId: undefined,
			isConnected: false,
		});
		mocks.useConnect.mockReturnValue({
			connect: mocks.connect,
			connectors: [{ id: "metaMask", name: "MetaMask" }],
			error: undefined,
			isPending: true,
		});

		render(<WalletPanel />);

		expect(
			(
				screen.getByRole("button", {
					name: "正在连接测试钱包",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
	});

	it("shows the current and target networks before asking for a Sepolia switch", () => {
		mocks.useAccount.mockReturnValue({
			address,
			chainId: 1,
			isConnected: true,
		});

		render(<WalletPanel />);

		expect(screen.getByText("当前网络")).toBeTruthy();
		expect(screen.getByText("以太坊主网")).toBeTruthy();
		expect(screen.getByText("目标网络")).toBeTruthy();
		expect(screen.getByText("Sepolia 测试网")).toBeTruthy();
		expect(document.body.textContent).not.toMatch(/作业|课程|老师|验收/);

		fireEvent.click(screen.getByRole("button", { name: "切换到 Sepolia" }));
		expect(mocks.switchChainAsync).toHaveBeenCalledWith({ chainId: 11155111 });
	});

	it("shows the connected Sepolia wallet with a shortened address and disconnect action", () => {
		render(<WalletPanel />);

		expect(screen.getAllByText("0x1111…1111").length).toBeGreaterThan(0);
		expect(screen.getByText("Sepolia 已连接")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "断开连接" }));
		expect(mocks.disconnect).toHaveBeenCalledOnce();
	});
});
