import { act, renderHook, waitFor } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketplaceTask } from "./marketplaceModel";

const mocks = vi.hoisted(() => ({
	approveReceipt: {
		error: null as unknown,
		isError: false,
		isSuccess: false,
	},
	balanceRefetch: vi.fn(),
	allowanceRefetch: vi.fn(),
	purchasedRefetch: vi.fn(),
	simulateContract: vi.fn(),
	switchChainAsync: vi.fn(),
	useAccount: vi.fn(),
	useReadContract: vi.fn(),
	useSwitchChain: vi.fn(),
	useWaitForTransactionReceipt: vi.fn(),
	useWriteContract: vi.fn(),
	writeContractAsync: vi.fn(),
	purchaseReceipt: {
		error: null as unknown,
		isError: false,
		isSuccess: false,
	},
}));

vi.mock("@wagmi/core", () => ({
	simulateContract: mocks.simulateContract,
}));

vi.mock("wagmi", async (importOriginal) => {
	const actual = await importOriginal<typeof import("wagmi")>();
	return {
		...actual,
		useAccount: mocks.useAccount,
		useReadContract: mocks.useReadContract,
		useSwitchChain: mocks.useSwitchChain,
		useWaitForTransactionReceipt: mocks.useWaitForTransactionReceipt,
		useWriteContract: mocks.useWriteContract,
	};
});

import { wagmiConfig } from "../../config/wagmi";
import { useTaskPurchase } from "./useTaskPurchase";

const account = "0x1111111111111111111111111111111111111111" as Address;
const provider = "0x2222222222222222222222222222222222222222" as Address;
const babyCoin = "0x3333333333333333333333333333333333333333" as Address;
const marketplace = "0x4444444444444444444444444444444444444444" as Address;
const approvalHash = `0x${"a".repeat(64)}` as Hash;
const purchaseHash = `0x${"b".repeat(64)}` as Hash;
const price = 3n * 10n ** 18n;

const task: MarketplaceTask = {
	id: 7n,
	provider,
	payee: provider,
	activity: "read",
	activityLabel: "亲子共读",
	metadataUri: "ipfs://task-7",
	requestId: 9n,
	price,
	priceLabel: "3 BABY",
	opensAt: 1_000n,
	closesAt: 10_000n,
	state: "active",
};

let allowance = 0n;
let purchased = false;

function installMetaMask() {
	Object.defineProperty(window, "ethereum", {
		configurable: true,
		value: { isMetaMask: true },
	});
}

describe("useTaskPurchase", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		installMetaMask();
		allowance = 0n;
		purchased = false;
		mocks.approveReceipt.error = null;
		mocks.approveReceipt.isError = false;
		mocks.approveReceipt.isSuccess = false;
		mocks.purchaseReceipt.error = null;
		mocks.purchaseReceipt.isError = false;
		mocks.purchaseReceipt.isSuccess = false;
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useSwitchChain.mockReturnValue({
			switchChainAsync: mocks.switchChainAsync,
		});
		mocks.useWriteContract.mockReturnValue({
			writeContractAsync: mocks.writeContractAsync,
		});
		mocks.useReadContract.mockImplementation(({ functionName }) => {
			if (functionName === "balanceOf") {
				return {
					data: 8n * 10n ** 18n,
					isError: false,
					isPending: false,
					refetch: mocks.balanceRefetch,
				};
			}
			if (functionName === "allowance") {
				return {
					data: allowance,
					isError: false,
					isPending: false,
					refetch: mocks.allowanceRefetch,
				};
			}
			return {
				data: purchased,
				isError: false,
				isPending: false,
				refetch: mocks.purchasedRefetch,
			};
		});
		mocks.useWaitForTransactionReceipt.mockImplementation(({ hash }) =>
			hash === approvalHash ? mocks.approveReceipt : mocks.purchaseReceipt,
		);
		mocks.simulateContract.mockImplementation(async (_config, request) => ({
			request,
		}));
		mocks.balanceRefetch.mockResolvedValue(undefined);
		mocks.allowanceRefetch.mockResolvedValue(undefined);
		mocks.purchasedRefetch.mockResolvedValue(undefined);
	});

	it("requires an exact approval before buying", async () => {
		mocks.writeContractAsync.mockResolvedValue(approvalHash);
		const { result } = renderHook(() =>
			useTaskPurchase(task, babyCoin, marketplace),
		);

		expect(result.current.phase).toBe("ready-to-approve");
		expect(result.current.canApprove).toBe(true);
		expect(result.current.canBuy).toBe(false);

		await act(async () => result.current.approve());

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				address: babyCoin,
				functionName: "approve",
				args: [marketplace, price],
				account,
				chainId: 11155111,
			}),
		);
		expect(result.current.phase).toBe("confirming-approval");
		expect(result.current.approvalHash).toBe(approvalHash);
	});

	it("buys only when allowance covers the locked task price", async () => {
		allowance = price;
		mocks.writeContractAsync.mockResolvedValue(purchaseHash);
		const { result } = renderHook(() =>
			useTaskPurchase(task, babyCoin, marketplace),
		);

		expect(result.current.phase).toBe("ready-to-buy");
		expect(result.current.canBuy).toBe(true);
		await act(async () => result.current.buy());

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				address: marketplace,
				functionName: "buy",
				args: [7n],
				account,
				chainId: 11155111,
			}),
		);
		expect(result.current.phase).toBe("confirming-purchase");
		expect(result.current.purchaseHash).toBe(purchaseHash);
	});

	it("reports purchase success only after the receipt and refresh complete", async () => {
		allowance = price;
		mocks.writeContractAsync.mockResolvedValue(purchaseHash);
		const { result, rerender } = renderHook(() =>
			useTaskPurchase(task, babyCoin, marketplace),
		);
		await act(async () => result.current.buy());

		mocks.purchaseReceipt.isSuccess = true;
		rerender();

		await waitFor(() => expect(result.current.phase).toBe("success"));
		expect(result.current.message).toBe("购买已确认，等待完成记录与成长证书。");
		expect(mocks.balanceRefetch).toHaveBeenCalledOnce();
		expect(mocks.allowanceRefetch).toHaveBeenCalledOnce();
		expect(mocks.purchasedRefetch).toHaveBeenCalledOnce();
	});

	it("blocks writes on the wrong network and exposes the switch action", async () => {
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 1,
			isConnected: true,
		});
		const { result } = renderHook(() =>
			useTaskPurchase(task, babyCoin, marketplace),
		);

		expect(result.current.walletState).toBe("wrong-network");
		expect(result.current.canApprove).toBe(false);
		await act(async () => result.current.switchToSepolia());
		expect(mocks.switchChainAsync).toHaveBeenCalledWith({ chainId: 11155111 });
		expect(mocks.simulateContract).not.toHaveBeenCalled();
	});
});
