import { act, renderHook, waitFor } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	invalidateQueries: vi.fn(),
	readRefetch: vi.fn(),
	switchChainAsync: vi.fn(),
	useAccount: vi.fn(),
	useReadContract: vi.fn(),
	useSimulateContract: vi.fn(),
	useSwitchChain: vi.fn(),
	useWaitForTransactionReceipt: vi.fn(),
	useWriteContract: vi.fn(),
	writeContractAsync: vi.fn(),
}));

vi.mock("wagmi", () => ({
	useAccount: mocks.useAccount,
	useReadContract: mocks.useReadContract,
	useSimulateContract: mocks.useSimulateContract,
	useSwitchChain: mocks.useSwitchChain,
	useWaitForTransactionReceipt: mocks.useWaitForTransactionReceipt,
	useWriteContract: mocks.useWriteContract,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();
	return {
		...actual,
		useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
	};
});

import { useNotebook } from "./useNotebook";

const account = "0x1111111111111111111111111111111111111111" as Address;
const transactionHash = `0x${"a".repeat(64)}` as Hash;
const saveRequest = { functionName: "setNote" };
const clearRequest = { functionName: "clearNote" };

type ReceiptState = {
	error: unknown;
	isError: boolean;
	isPending: boolean;
	isSuccess: boolean;
};

let receiptState: ReceiptState;

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});
	return { promise, reject, resolve };
}

function installMetaMask() {
	Object.defineProperty(window, "ethereum", {
		configurable: true,
		value: { isMetaMask: true },
	});
}

describe("useNotebook", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readRefetch.mockResolvedValue(undefined);
		installMetaMask();
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useReadContract.mockReturnValue({
			data: "链上内容",
			error: null,
			isError: false,
			isPending: false,
			isSuccess: true,
			refetch: mocks.readRefetch,
		});
		mocks.useSimulateContract.mockImplementation(
			({ functionName }: { functionName: string }) => ({
				data: {
					request: functionName === "setNote" ? saveRequest : clearRequest,
				},
			}),
		);
		mocks.useWriteContract.mockReturnValue({
			writeContractAsync: mocks.writeContractAsync,
		});
		receiptState = {
			error: null,
			isError: false,
			isPending: false,
			isSuccess: false,
		};
		mocks.useWaitForTransactionReceipt.mockImplementation(() => receiptState);
		mocks.useSwitchChain.mockReturnValue({
			switchChainAsync: mocks.switchChainAsync,
		});
		mocks.invalidateQueries.mockResolvedValue(undefined);
	});

	it("reports a missing wallet when the MetaMask provider is unavailable", () => {
		Object.defineProperty(window, "ethereum", {
			configurable: true,
			value: undefined,
		});
		mocks.useAccount.mockReturnValue({
			address: undefined,
			chainId: undefined,
			isConnected: false,
		});

		const { result } = renderHook(() => useNotebook());

		expect(result.current.walletState).toBe("missing");
	});

	it("does not enable getNote while disconnected", () => {
		mocks.useAccount.mockReturnValue({
			address: undefined,
			chainId: undefined,
			isConnected: false,
		});

		renderHook(() => useNotebook());

		expect(mocks.useReadContract).toHaveBeenCalledWith(
			expect.objectContaining({
				functionName: "getNote",
				query: { enabled: false },
			}),
		);
	});

	it("blocks writes on the wrong network and offers an explicit Sepolia switch", async () => {
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 1,
			isConnected: true,
		});
		const { result } = renderHook(() => useNotebook());

		expect(result.current.walletState).toBe("wrong-network");
		expect(result.current.canSave).toBe(false);
		expect(result.current.canClear).toBe(false);
		await act(async () => {
			await result.current.save();
			await result.current.clear();
			await result.current.switchToSepolia();
		});

		expect(mocks.writeContractAsync).not.toHaveBeenCalled();
		expect(mocks.switchChainAsync).toHaveBeenCalledWith({ chainId: 11155111 });
	});

	it("keeps a read failure distinct from an empty note and allows retry", async () => {
		mocks.useReadContract.mockReturnValue({
			data: undefined,
			error: new Error("private RPC details"),
			isError: true,
			isPending: false,
			isSuccess: false,
			refetch: mocks.readRefetch,
		});
		const { result } = renderHook(() => useNotebook());

		expect(result.current.phase).toBe("read-error");
		expect(result.current.chainNote).toBeUndefined();
		await act(async () => {
			await result.current.retryRead();
		});
		expect(mocks.readRefetch).toHaveBeenCalledOnce();
	});

	it("separates wallet signature from receipt confirmation", async () => {
		const signature = deferred<Hash>();
		mocks.writeContractAsync.mockReturnValue(signature.promise);
		const { result } = renderHook(() => useNotebook());

		let savePromise!: Promise<void>;
		act(() => {
			savePromise = result.current.save();
		});
		expect(result.current.phase).toBe("awaiting-signature");

		await act(async () => {
			signature.resolve(transactionHash);
			await savePromise;
		});
		expect(result.current.transactionHash).toBe(transactionHash);
		expect(result.current.phase).toBe("confirming");
		expect(mocks.invalidateQueries).not.toHaveBeenCalled();
	});

	it("invalidates the exact getNote query before reporting receipt success", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const invalidation = deferred<void>();
		mocks.invalidateQueries.mockReturnValue(invalidation.promise);
		const { result, rerender } = renderHook(() => useNotebook());
		await act(async () => {
			await result.current.save();
		});

		receiptState = {
			error: null,
			isError: false,
			isPending: false,
			isSuccess: true,
		};
		rerender();
		await waitFor(() => {
			expect(mocks.invalidateQueries).toHaveBeenCalledWith({
				queryKey: [
					"readContract",
					{
						address: "0x0000000000000000000000000000000000000001",
						args: [account],
						chainId: 11155111,
						functionName: "getNote",
					},
				],
			});
		});
		expect(result.current.phase).toBe("confirming");

		await act(async () => {
			invalidation.resolve();
			await invalidation.promise;
		});
		await waitFor(() => expect(result.current.phase).toBe("success"));
	});

	it("explains that clearing current state does not erase transaction history", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const { result, rerender } = renderHook(() => useNotebook());

		await act(async () => {
			await result.current.clear();
		});

		receiptState = {
			error: null,
			isError: false,
			isPending: false,
			isSuccess: true,
		};
		rerender();

		await waitFor(() => expect(result.current.phase).toBe("success"));
		expect(result.current.message).toBe(
			"当前便签显示已清空；历史交易仍然公开。",
		);
	});

	it("preserves the draft and maps a rejected signature safely", async () => {
		mocks.writeContractAsync.mockRejectedValue({ code: 4001 });
		const { result } = renderHook(() => useNotebook());
		act(() => result.current.setDraft("不要丢失"));

		await act(async () => {
			await result.current.save();
		});

		expect(result.current.draft).toBe("不要丢失");
		expect(result.current.phase).toBe("write-error");
		expect(result.current.message).toBe("你取消了钱包操作，草稿仍然保留。");
	});

	it("does not submit a duplicate write while a signature is pending", async () => {
		const signature = deferred<Hash>();
		mocks.writeContractAsync.mockReturnValue(signature.promise);
		const { result } = renderHook(() => useNotebook());

		let firstSave!: Promise<void>;
		let secondSave!: Promise<void>;
		act(() => {
			firstSave = result.current.save();
			secondSave = result.current.save();
		});
		await secondSave;
		expect(mocks.writeContractAsync).toHaveBeenCalledOnce();

		await act(async () => {
			signature.resolve(transactionHash);
			await firstSave;
		});
	});

	it("uses clearNote rather than encoding clear as setNote with an empty string", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const { result } = renderHook(() => useNotebook());

		await act(async () => {
			await result.current.clear();
		});

		expect(mocks.writeContractAsync).toHaveBeenCalledWith(clearRequest);
	});

	it("does not send an empty draft through setNote", async () => {
		const { result } = renderHook(() => useNotebook());
		act(() => result.current.setDraft(""));

		await act(async () => {
			await result.current.save();
		});

		expect(mocks.writeContractAsync).not.toHaveBeenCalled();
	});
});
