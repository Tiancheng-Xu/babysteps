import { act, renderHook, waitFor } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	invalidateQueries: vi.fn(),
	readRefetch: vi.fn(),
	simulateContract: vi.fn(),
	switchChainAsync: vi.fn(),
	useAccount: vi.fn(),
	useReadContract: vi.fn(),
	useSwitchChain: vi.fn(),
	useWaitForTransactionReceipt: vi.fn(),
	useWriteContract: vi.fn(),
	writeContractAsync: vi.fn(),
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

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();
	return {
		...actual,
		useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
	};
});

import { wagmiConfig } from "../../config/wagmi";
import { usePointTransfer } from "./usePointTransfer";

const account = "0x1111111111111111111111111111111111111111" as Address;
const recipient = "0x2222222222222222222222222222222222222222" as Address;
const transactionHash = `0x${"d".repeat(64)}` as Hash;
const transferRequest = {
	functionName: "transferGrowthPoints",
	args: [recipient, 2n],
};

type ReceiptState = {
	error: unknown;
	isError: boolean;
	isPending: boolean;
	isSuccess: boolean;
};

let receiptState: ReceiptState;
let balance = 7n;

function installMetaMask() {
	Object.defineProperty(window, "ethereum", {
		configurable: true,
		value: { isMetaMask: true },
	});
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve;
	});
	return { promise, resolve };
}

function fillValidTransfer(result: {
	current: ReturnType<typeof usePointTransfer>;
}) {
	act(() => {
		result.current.setRecipient(recipient);
		result.current.setAmount("2");
	});
}

describe("usePointTransfer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		installMetaMask();
		balance = 7n;
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useReadContract.mockImplementation(() => ({
			data: balance,
			error: null,
			isError: false,
			isPending: false,
			isSuccess: true,
			refetch: mocks.readRefetch,
		}));
		mocks.useWriteContract.mockReturnValue({
			writeContractAsync: mocks.writeContractAsync,
		});
		mocks.useSwitchChain.mockReturnValue({
			switchChainAsync: mocks.switchChainAsync,
		});
		receiptState = {
			error: null,
			isError: false,
			isPending: false,
			isSuccess: false,
		};
		mocks.useWaitForTransactionReceipt.mockImplementation(() => receiptState);
		mocks.simulateContract.mockResolvedValue({ request: transferRequest });
		mocks.invalidateQueries.mockResolvedValue(undefined);
		mocks.readRefetch.mockResolvedValue(undefined);
	});

	it("disables the balance read while disconnected", () => {
		mocks.useAccount.mockReturnValue({
			address: undefined,
			chainId: undefined,
			isConnected: false,
		});

		const { result } = renderHook(() => usePointTransfer());

		expect(result.current.walletState).toBe("disconnected");
		expect(result.current.balance).toBeUndefined();
		expect(mocks.useReadContract).toHaveBeenCalledWith(
			expect.objectContaining({ query: { enabled: false } }),
		);
	});

	it("exposes the chain balance and validates the controlled form", () => {
		const { result } = renderHook(() => usePointTransfer());
		fillValidTransfer(result);

		expect(result.current.balance).toBe(7n);
		expect(result.current.canTransfer).toBe(true);
		expect(result.current.validationMessage).toBeUndefined();
	});

	it("does not replace a failed balance read with zero", async () => {
		mocks.useReadContract.mockReturnValue({
			data: undefined,
			error: new Error("private RPC details"),
			isError: true,
			isPending: false,
			isSuccess: false,
			refetch: mocks.readRefetch,
		});
		const { result } = renderHook(() => usePointTransfer());

		expect(result.current.phase).toBe("read-error");
		expect(result.current.balance).toBeUndefined();
		await act(async () => result.current.retryRead());
		expect(mocks.readRefetch).toHaveBeenCalledOnce();
	});

	it("simulates the normalized transfer before wallet write", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const { result } = renderHook(() => usePointTransfer());
		fillValidTransfer(result);

		await act(async () => result.current.transfer());

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				functionName: "transferGrowthPoints",
				args: [recipient, 2n],
				account,
				chainId: 11155111,
			}),
		);
		expect(mocks.writeContractAsync).toHaveBeenCalledWith(transferRequest);
		expect(result.current.phase).toBe("confirming");
		expect(result.current.balance).toBe(7n);
	});

	it("separates signature from confirmation and blocks a duplicate", async () => {
		const signature = deferred<Hash>();
		mocks.writeContractAsync.mockReturnValue(signature.promise);
		const { result } = renderHook(() => usePointTransfer());
		fillValidTransfer(result);

		let firstTransfer!: Promise<void>;
		let secondTransfer!: Promise<void>;
		act(() => {
			firstTransfer = result.current.transfer();
			secondTransfer = result.current.transfer();
		});
		await secondTransfer;
		expect(result.current.phase).toBe("awaiting-signature");
		expect(mocks.simulateContract).toHaveBeenCalledOnce();

		await act(async () => {
			signature.resolve(transactionHash);
			await firstTransfer;
		});
		expect(result.current.phase).toBe("confirming");
	});

	it("refreshes both wallet balances before reporting receipt success", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const invalidation = deferred<void>();
		mocks.invalidateQueries.mockReturnValue(invalidation.promise);
		const { result, rerender } = renderHook(() => usePointTransfer());
		fillValidTransfer(result);
		await act(async () => result.current.transfer());

		receiptState = {
			error: null,
			isError: false,
			isPending: false,
			isSuccess: true,
		};
		rerender();
		await waitFor(() =>
			expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2),
		);
		expect(result.current.phase).toBe("confirming");
		expect(result.current.amount).toBe("2");

		await act(async () => {
			invalidation.resolve();
			await invalidation.promise;
		});
		await waitFor(() => expect(result.current.phase).toBe("success"));
		expect(result.current.message).toBe("已向 0x2222…2222 赠送 2 枚成长星。");
		expect(result.current.amount).toBe("");
	});

	it("maps wallet cancellation without changing the displayed balance", async () => {
		mocks.writeContractAsync.mockRejectedValue({ code: 4001 });
		const { result } = renderHook(() => usePointTransfer());
		fillValidTransfer(result);

		await act(async () => result.current.transfer());

		expect(result.current.phase).toBe("write-error");
		expect(result.current.message).toBe("已取消，本次没有转移成长星。");
		expect(result.current.balance).toBe(7n);
	});

	it("keeps the chain balance when the submitted transaction reverts", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const { result, rerender } = renderHook(() => usePointTransfer());
		fillValidTransfer(result);
		await act(async () => result.current.transfer());

		receiptState = {
			error: new Error("private receipt details"),
			isError: true,
			isPending: false,
			isSuccess: false,
		};
		rerender();

		await waitFor(() => expect(result.current.phase).toBe("write-error"));
		expect(result.current.balance).toBe(7n);
	});
});
