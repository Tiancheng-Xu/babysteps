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
import { useGrowth } from "./useGrowth";

const account = "0x1111111111111111111111111111111111111111" as Address;
const transactionHash = `0x${"b".repeat(64)}` as Hash;
const activityRequest = { functionName: "recordActivity", args: [0] };

type ReceiptState = {
	error: unknown;
	isError: boolean;
	isPending: boolean;
	isSuccess: boolean;
};

let receiptState: ReceiptState;
let points = 0n;
let stageCode = 0;
let availability: Array<readonly [boolean, boolean]> = [
	[true, false],
	[true, false],
	[true, false],
];

function installMetaMask() {
	Object.defineProperty(window, "ethereum", {
		configurable: true,
		value: { isMetaMask: true },
	});
}

function successfulRead(functionName: string, args?: readonly unknown[]) {
	let data: bigint | number | readonly [boolean, boolean];
	if (functionName === "getGrowthPoints") data = points;
	else if (functionName === "getGrowthStage") data = stageCode;
	else data = availability[Number(args?.[1] ?? 0)] ?? [false, false];

	return {
		data,
		error: null,
		isError: false,
		isPending: false,
		isSuccess: true,
		refetch: mocks.readRefetch,
	};
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});
	return { promise, reject, resolve };
}

describe("useGrowth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		installMetaMask();
		points = 0n;
		stageCode = 0;
		availability = [
			[true, false],
			[true, false],
			[true, false],
		];
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useReadContract.mockImplementation(
			({ functionName, args }: { functionName: string; args?: unknown[] }) =>
				successfulRead(functionName, args),
		);
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
		mocks.simulateContract.mockResolvedValue({ request: activityRequest });
		mocks.invalidateQueries.mockResolvedValue(undefined);
		mocks.readRefetch.mockResolvedValue(undefined);
	});

	it("keeps growth reads disabled while disconnected", () => {
		mocks.useAccount.mockReturnValue({
			address: undefined,
			chainId: undefined,
			isConnected: false,
		});

		const { result } = renderHook(() => useGrowth());

		expect(result.current.walletState).toBe("disconnected");
		expect(result.current.points).toBeUndefined();
		expect(mocks.useReadContract).toHaveBeenCalledTimes(5);
		for (const [options] of mocks.useReadContract.mock.calls) {
			expect(options.query).toEqual(
				options.functionName === "getActivityAvailability"
					? { enabled: false, refetchInterval: 60_000 }
					: { enabled: false },
			);
		}
	});

	it("does not replace a required read failure with zero points or Egg", async () => {
		mocks.useReadContract.mockImplementation(
			({ functionName, args }: { functionName: string; args?: unknown[] }) =>
				functionName === "getGrowthPoints"
					? {
							data: undefined,
							error: new Error("private RPC details"),
							isError: true,
							isPending: false,
							isSuccess: false,
							refetch: mocks.readRefetch,
						}
					: successfulRead(functionName, args),
		);

		const { result } = renderHook(() => useGrowth());

		expect(result.current.phase).toBe("read-error");
		expect(result.current.points).toBeUndefined();
		expect(result.current.stage).toBeUndefined();
		await act(async () => result.current.retryRead());
		expect(mocks.readRefetch).toHaveBeenCalledTimes(5);
	});

	it("polls and maps exact activity availability without exposing times", () => {
		points = 15n;
		stageCode = 3;
		availability = [
			[false, false],
			[true, false],
			[false, true],
		];

		const { result } = renderHook(() => useGrowth());

		expect(result.current.points).toBe(15n);
		expect(result.current.stage).toBe("star");
		expect(result.current.availabilityByActivity).toEqual({
			meal: { available: false, dailyLimitReached: false },
			walk: { available: true, dailyLimitReached: false },
			read: { available: false, dailyLimitReached: true },
		});
		const activityReads = mocks.useReadContract.mock.calls.filter(
			([options]) => options.functionName === "getActivityAvailability",
		);
		expect(activityReads).toHaveLength(3);
		for (const [options] of activityReads) {
			expect(options.query).toEqual({
				enabled: true,
				refetchInterval: 60_000,
			});
		}
	});

	it.each([
		[[false, false], "星宝的这个活动还没有准备好。"],
		[[false, true], "星宝今天已经很充实了。"],
	] as const)(
		"does not simulate an unavailable activity with state %j",
		async (mealAvailability, message) => {
			availability[0] = mealAvailability;
			const { result } = renderHook(() => useGrowth());

			await act(async () => result.current.recordActivity("meal"));

			expect(mocks.simulateContract).not.toHaveBeenCalled();
			expect(mocks.writeContractAsync).not.toHaveBeenCalled();
			expect(result.current.phase).toBe("write-error");
			expect(result.current.message).toBe(message);
		},
	);

	it("simulates the selected activity before asking the wallet to write", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const { result } = renderHook(() => useGrowth());

		await act(async () => result.current.recordActivity("meal"));

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				functionName: "recordActivity",
				args: [0],
				account,
				chainId: 11155111,
			}),
		);
		expect(mocks.writeContractAsync).toHaveBeenCalledWith(activityRequest);
		expect(result.current.transactionHash).toBe(transactionHash);
		expect(result.current.phase).toBe("confirming");
		expect(result.current.points).toBe(0n);
	});

	it("separates wallet signature from receipt confirmation", async () => {
		const signature = deferred<Hash>();
		mocks.writeContractAsync.mockReturnValue(signature.promise);
		const { result } = renderHook(() => useGrowth());

		let recordPromise!: Promise<void>;
		act(() => {
			recordPromise = result.current.recordActivity("walk");
		});
		expect(result.current.phase).toBe("awaiting-signature");

		await act(async () => {
			signature.resolve(transactionHash);
			await recordPromise;
		});
		expect(result.current.phase).toBe("confirming");
	});

	it("refreshes all growth reads before reporting receipt success", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const invalidation = deferred<void>();
		mocks.invalidateQueries.mockReturnValue(invalidation.promise);
		const { result, rerender } = renderHook(() => useGrowth());
		await act(async () => result.current.recordActivity("read"));

		receiptState = {
			error: null,
			isError: false,
			isPending: false,
			isSuccess: true,
		};
		rerender();

		await waitFor(() =>
			expect(mocks.invalidateQueries).toHaveBeenCalledTimes(6),
		);
		expect(result.current.phase).toBe("confirming");

		await act(async () => {
			invalidation.resolve();
			await invalidation.promise;
		});
		await waitFor(() => expect(result.current.phase).toBe("success"));
		expect(result.current.message).toBe("记录成功，获得 +7 枚成长星。");
	});

	it("blocks a duplicate submission while the first signature is pending", async () => {
		const signature = deferred<Hash>();
		mocks.writeContractAsync.mockReturnValue(signature.promise);
		const { result } = renderHook(() => useGrowth());

		let firstRecord!: Promise<void>;
		let secondRecord!: Promise<void>;
		act(() => {
			firstRecord = result.current.recordActivity("meal");
			secondRecord = result.current.recordActivity("meal");
		});
		await secondRecord;
		expect(mocks.simulateContract).toHaveBeenCalledOnce();
		expect(mocks.writeContractAsync).toHaveBeenCalledOnce();

		await act(async () => {
			signature.resolve(transactionHash);
			await firstRecord;
		});
	});

	it("maps wallet cancellation without changing displayed chain state", async () => {
		points = 8n;
		stageCode = 2;
		mocks.writeContractAsync.mockRejectedValue({ code: 4001 });
		const { result } = renderHook(() => useGrowth());

		await act(async () => result.current.recordActivity("read"));

		expect(result.current.phase).toBe("rejected");
		expect(result.current.message).toBe("已取消，本次没有写入测试链。");
		expect(result.current.points).toBe(8n);
		expect(result.current.stage).toBe("explorer");
	});

	it.each([
		["ActivityCoolingDown", "星宝的这个活动还没有准备好。"],
		["DailyActivityLimitReached", "星宝今天已经很充实了。"],
	])("maps a nested %s simulation safely", async (errorName, message) => {
		mocks.simulateContract.mockRejectedValue({
			cause: { data: { errorName } },
		});
		const { result } = renderHook(() => useGrowth());

		await act(async () => result.current.recordActivity("meal"));

		expect(mocks.writeContractAsync).not.toHaveBeenCalled();
		expect(result.current.phase).toBe("write-error");
		expect(result.current.message).toBe(message);
	});

	it("keeps points unchanged when the submitted transaction reverts", async () => {
		points = 3n;
		stageCode = 1;
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const { result, rerender } = renderHook(() => useGrowth());
		await act(async () => result.current.recordActivity("walk"));

		receiptState = {
			error: new Error("private receipt details"),
			isError: true,
			isPending: false,
			isSuccess: false,
		};
		rerender();

		await waitFor(() => expect(result.current.phase).toBe("write-error"));
		expect(result.current.points).toBe(3n);
		expect(result.current.stage).toBe("sprout");
	});
});
