import { act, renderHook } from "@testing-library/react";
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
});
