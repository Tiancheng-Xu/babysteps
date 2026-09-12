import { act, renderHook, waitFor } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	markBusinessOperation: vi.fn(),
	markOperation: vi.fn(),
	readContract: vi.fn(),
	simulateContract: vi.fn(),
	waitForTransactionReceipt: vi.fn(),
	switchChainAsync: vi.fn(),
	writeContractAsync: vi.fn(),
}));

vi.mock("@wagmi/core", () => ({
	readContract: mocks.readContract,
	simulateContract: mocks.simulateContract,
	waitForTransactionReceipt: mocks.waitForTransactionReceipt,
}));

vi.mock("wagmi", async (importOriginal) => {
	const actual = await importOriginal<typeof import("wagmi")>();
	return {
		...actual,
		useAccount: () => ({
			address: "0x1111111111111111111111111111111111111111" as Address,
			chainId: 11155111,
			isConnected: true,
		}),
		useSwitchChain: () => ({ switchChainAsync: mocks.switchChainAsync }),
		useWriteContract: () => ({
			writeContractAsync: mocks.writeContractAsync,
		}),
	};
});

vi.mock("../../contracts/web3Contracts", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../../contracts/web3Contracts")>();
	return {
		...actual,
		babyCoinAddress: "0x0000000000000000000000000000000000000042" as Address,
	};
});

import { setPerformanceClient } from "../../performance/runtime";
import { useUniswapSwap } from "./useUniswapSwap";

describe("useUniswapSwap business operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(window, "ethereum", {
			configurable: true,
			value: { isMetaMask: true },
		});
		mocks.markBusinessOperation.mockImplementation(
			(_name: string, operation: () => Promise<unknown>) => operation(),
		);
		mocks.markOperation.mockImplementation(
			(_name: string, operation: () => Promise<unknown>) => operation(),
		);
		setPerformanceClient({
			markBusinessOperation: mocks.markBusinessOperation,
			markOperation: mocks.markOperation,
			record: vi.fn(),
		});
		mocks.simulateContract.mockResolvedValue({
			result: [100n],
			request: { chainId: 11155111 },
		});
		mocks.readContract.mockResolvedValue(10_000_000n);
		mocks.writeContractAsync.mockResolvedValue(`0x${"a".repeat(64)}` as Hash);
		mocks.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
	});

	it("measures a successful quote through the validated Quoter result", async () => {
		const { result } = renderHook(() => useUniswapSwap());

		await act(async () => result.current.quote());

		expect(mocks.markBusinessOperation).toHaveBeenCalledWith(
			"business.exchange.quote",
			expect.any(Function),
		);
		expect(result.current.phase).toBe("quoted");
		expect(result.current.quotedBaby).toBeDefined();
	});

	it("measures a swap through its confirmed transaction receipt", async () => {
		const { result } = renderHook(() => useUniswapSwap());
		await act(async () => result.current.quote());

		await act(async () => result.current.execute());

		expect(mocks.markBusinessOperation).toHaveBeenCalledWith(
			"business.exchange.swap",
			expect.any(Function),
		);
		expect(mocks.waitForTransactionReceipt).toHaveBeenCalled();
		expect(result.current.phase).toBe("success");
	});

	it("lets the user clear a remaining router allowance and verifies it is zero", async () => {
		mocks.readContract
			.mockResolvedValueOnce(10_000_000n)
			.mockResolvedValueOnce(7n)
			.mockResolvedValueOnce(0n);
		const { result } = renderHook(() => useUniswapSwap());
		await act(async () => result.current.quote());
		await act(async () => result.current.execute());

		expect(result.current.remainingAllowance).toBe(7n);
		expect(result.current.canRevokeAllowance).toBe(true);
		act(() => result.current.setAsset("ETH"));
		expect(result.current.asset).toBe("USDC");

		await act(async () => result.current.revokeAllowance());

		expect(mocks.writeContractAsync).toHaveBeenLastCalledWith(
			expect.objectContaining({
				functionName: "approve",
				args: [expect.any(String), 0n],
			}),
		);
		expect(result.current.remainingAllowance).toBe(0n);
		expect(result.current.canRevokeAllowance).toBe(false);
		expect(result.current.message).toBe("剩余授权已清除，并已从链上确认归零。");
	});

	it("keeps the revoke action locked while the wallet request is pending", async () => {
		mocks.readContract
			.mockResolvedValueOnce(10_000_000n)
			.mockResolvedValueOnce(7n)
			.mockResolvedValueOnce(0n);
		const { result } = renderHook(() => useUniswapSwap());
		await act(async () => result.current.quote());
		await act(async () => result.current.execute());

		let resolveApproval: ((hash: Hash) => void) | undefined;
		mocks.writeContractAsync.mockImplementationOnce(
			() =>
				new Promise<Hash>((resolve) => {
					resolveApproval = resolve;
				}),
		);
		let firstRevoke: Promise<void> | undefined;
		act(() => {
			firstRevoke = result.current.revokeAllowance();
			void result.current.revokeAllowance();
		});

		expect(result.current.phase).toBe("revoking");
		expect(result.current.canRevokeAllowance).toBe(false);
		expect(mocks.writeContractAsync).toHaveBeenCalledTimes(2);

		resolveApproval?.(`0x${"b".repeat(64)}` as Hash);
		await act(async () => firstRevoke);
		expect(result.current.remainingAllowance).toBe(0n);
	});

	it("locks quote inputs while a swap is waiting for confirmation", async () => {
		let resolveReceipt: (() => void) | undefined;
		mocks.waitForTransactionReceipt.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveReceipt = () => resolve({ status: "success" });
				}),
		);
		const { result } = renderHook(() => useUniswapSwap());
		await act(async () => result.current.quote());
		let swap: Promise<void> | undefined;
		act(() => {
			swap = result.current.execute();
		});
		await waitFor(() => expect(result.current.phase).toBe("swapping"));

		expect(result.current.isPending).toBe(true);
		expect(result.current.canQuote).toBe(false);
		act(() => result.current.setAmount("2"));
		expect(result.current.amount).toBe("1");

		resolveReceipt?.();
		await act(async () => swap);
	});

	it("shows the fail-closed cleanup gate but locks it until allowance readback resolves", async () => {
		let resolveAllowance: ((value: bigint) => void) | undefined;
		mocks.readContract
			.mockResolvedValueOnce(10_000_000n)
			.mockImplementationOnce(
				() =>
					new Promise<bigint>((resolve) => {
						resolveAllowance = resolve;
					}),
			);
		const { result } = renderHook(() => useUniswapSwap());
		await act(async () => result.current.quote());
		let swap: Promise<void> | undefined;
		act(() => {
			swap = result.current.execute();
		});
		await waitFor(() => expect(result.current.transactionHash).toBeDefined());

		expect(result.current.needsAllowanceCleanup).toBe(true);
		expect(result.current.canRevokeAllowance).toBe(false);

		resolveAllowance?.(7n);
		await act(async () => swap);
		expect(result.current.needsAllowanceCleanup).toBe(true);
		expect(result.current.canRevokeAllowance).toBe(true);
	});

	it("fails closed when the swap is confirmed but allowance readback fails", async () => {
		mocks.readContract
			.mockResolvedValueOnce(10_000_000n)
			.mockRejectedValueOnce(new Error("rpc unavailable"));
		const { result } = renderHook(() => useUniswapSwap());
		await act(async () => result.current.quote());

		await act(async () => result.current.execute());

		expect(result.current.transactionHash).toBeDefined();
		expect(result.current.remainingAllowance).toBeUndefined();
		expect(result.current.needsAllowanceCleanup).toBe(true);
		expect(result.current.canRevokeAllowance).toBe(true);
		expect(result.current.message).toBe(
			"兑换已确认，但授权读回失败；请继续清除剩余授权。",
		);
	});
});
