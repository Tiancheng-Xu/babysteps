import { act, renderHook, waitFor } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	refetch: vi.fn(),
	simulateContract: vi.fn(),
	switchChainAsync: vi.fn(),
	useAccount: vi.fn(),
	useReadContract: vi.fn(),
	useSwitchChain: vi.fn(),
	useWaitForTransactionReceipt: vi.fn(),
	useWriteContract: vi.fn(),
	writeContractAsync: vi.fn(),
}));

vi.mock("@wagmi/core", () => ({ simulateContract: mocks.simulateContract }));
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
import { useBabyCoinGrowth } from "./useBabyCoinGrowth";

const account = "0x1111111111111111111111111111111111111111" as Address;
const babyCoin = "0x2222222222222222222222222222222222222222" as Address;
const activities = "0x3333333333333333333333333333333333333333" as Address;
const hash = `0x${"a".repeat(64)}` as Hash;

function installMetaMask() {
	Object.defineProperty(window, "ethereum", {
		configurable: true,
		value: { isMetaMask: true },
	});
}

describe("useBabyCoinGrowth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		installMetaMask();
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useWriteContract.mockReturnValue({
			writeContractAsync: mocks.writeContractAsync,
		});
		mocks.useSwitchChain.mockReturnValue({
			switchChainAsync: mocks.switchChainAsync,
		});
		mocks.useWaitForTransactionReceipt.mockReturnValue({
			isError: false,
			isSuccess: false,
		});
		mocks.useReadContract.mockImplementation(
			({ functionName, args }: { functionName: string; args?: unknown[] }) => {
				let data: unknown;
				if (functionName === "balanceOf") data = 9n * 10n ** 18n;
				else if (functionName === "lifetimeEarned") data = 15n * 10n ** 18n;
				else if (functionName === "growthStageOf") data = 3;
				else data = Number(args?.[1]) === 2 ? [false, true] : [true, false];
				return {
					data,
					isError: false,
					isPending: false,
					isSuccess: true,
					refetch: mocks.refetch,
				};
			},
		);
		mocks.refetch.mockResolvedValue(undefined);
		mocks.simulateContract.mockResolvedValue({ request: { data: "0x1234" } });
	});

	it("reads spendable balance, lifetime earnings, stage and activity limits separately", () => {
		const { result } = renderHook(() =>
			useBabyCoinGrowth(babyCoin, activities),
		);

		expect(result.current.balance).toBe(9n * 10n ** 18n);
		expect(result.current.lifetimeEarned).toBe(15n * 10n ** 18n);
		expect(result.current.stage).toBe("star");
		expect(result.current.availabilityByActivity?.read).toEqual({
			available: false,
			dailyLimitReached: true,
		});
	});

	it("does not invent zero balances when a required read fails", () => {
		mocks.useReadContract.mockImplementation(
			({ functionName }: { functionName: string }) => ({
				data: functionName === "balanceOf" ? undefined : 0n,
				isError: functionName === "balanceOf",
				isPending: false,
				isSuccess: functionName !== "balanceOf",
				refetch: mocks.refetch,
			}),
		);
		const { result } = renderHook(() =>
			useBabyCoinGrowth(babyCoin, activities),
		);

		expect(result.current.phase).toBe("read-error");
		expect(result.current.balance).toBeUndefined();
		expect(result.current.lifetimeEarned).toBeUndefined();
	});

	it("simulates recordActivity before sending the selected activity", async () => {
		mocks.writeContractAsync.mockResolvedValue(hash);
		const { result } = renderHook(() =>
			useBabyCoinGrowth(babyCoin, activities),
		);

		await act(async () => result.current.recordActivity("walk"));

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				address: activities,
				functionName: "recordActivity",
				args: [1],
				account,
				chainId: 11155111,
			}),
		);
		expect(result.current.transactionHash).toBe(hash);
		expect(result.current.phase).toBe("confirming");
	});

	it("refreshes all six reads only after receipt confirmation", async () => {
		mocks.writeContractAsync.mockResolvedValue(hash);
		const receipt = { isError: false, isSuccess: false };
		mocks.useWaitForTransactionReceipt.mockImplementation(() => receipt);
		const { result, rerender } = renderHook(() =>
			useBabyCoinGrowth(babyCoin, activities),
		);
		await act(async () => result.current.recordActivity("meal"));
		receipt.isSuccess = true;
		rerender();

		await waitFor(() => expect(result.current.phase).toBe("success"));
		expect(mocks.refetch).toHaveBeenCalledTimes(6);
	});
});
