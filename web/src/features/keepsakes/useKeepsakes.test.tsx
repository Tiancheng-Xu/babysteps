import { act, renderHook, waitFor } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	refetch: vi.fn(),
	simulateContract: vi.fn(),
	switchChainAsync: vi.fn(),
	useAccount: vi.fn(),
	useReadContract: vi.fn(),
	useReadContracts: vi.fn(),
	useSwitchChain: vi.fn(),
	useWaitForTransactionReceipt: vi.fn(),
	useWriteContract: vi.fn(),
	writeContractAsync: vi.fn(),
	businessStart: vi.fn(),
	businessSucceed: vi.fn(),
	businessFail: vi.fn(),
	createBusinessOperationLifecycle: vi.fn(),
}));

vi.mock("../../performance/runtime", () => ({
	createBusinessOperationLifecycle: mocks.createBusinessOperationLifecycle,
}));

vi.mock("@wagmi/core", () => ({ simulateContract: mocks.simulateContract }));

vi.mock("wagmi", async (importOriginal) => {
	const actual = await importOriginal<typeof import("wagmi")>();
	return {
		...actual,
		useAccount: mocks.useAccount,
		useReadContract: mocks.useReadContract,
		useReadContracts: mocks.useReadContracts,
		useSwitchChain: mocks.useSwitchChain,
		useWaitForTransactionReceipt: mocks.useWaitForTransactionReceipt,
		useWriteContract: mocks.useWriteContract,
	};
});

vi.mock("../../contracts/web3Contracts", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../../contracts/web3Contracts")>();
	return {
		...actual,
		starBuddyKeepsakeSbtAddress:
			"0x0000000000000000000000000000000000000021" as Address,
		starBuddyKeepsakesAddress:
			"0x0000000000000000000000000000000000000022" as Address,
	};
});

import { wagmiConfig } from "../../config/wagmi";
import { useKeepsakes } from "./useKeepsakes";

const account = "0x1111111111111111111111111111111111111111" as Address;
const transactionHash = `0x${"e".repeat(64)}` as Hash;
let latestRequestId = 0n;
let requestStatus = 1;

function installMetaMask() {
	Object.defineProperty(window, "ethereum", {
		configurable: true,
		value: { isMetaMask: true },
	});
}

describe("useKeepsakes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		installMetaMask();
		latestRequestId = 0n;
		requestStatus = 1;
		mocks.createBusinessOperationLifecycle.mockReturnValue({
			start: mocks.businessStart,
			succeed: mocks.businessSucceed,
			fail: mocks.businessFail,
			isPending: () => false,
		});
		mocks.businessStart.mockReturnValue(true);
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useReadContract.mockImplementation(
			(input: { functionName: string }) => {
				const dataByFunction: Record<string, unknown> = {
					getTransferableBalance: 24n,
					tokensOfOwner: [1n, 2n, 3n],
					latestRequestIdByOwner: latestRequestId,
					getRequest: {
						owner: account,
						kind: 1,
						status: requestStatus,
						requestedAt: 1_786_000_000n,
						tokenIds: [0n, 0n, 0n],
						resultTokenId: 0n,
						burnedTokenId: 0n,
					},
				};
				return {
					data: dataByFunction[input.functionName],
					isError: false,
					isPending: false,
					refetch: mocks.refetch,
				};
			},
		);
		mocks.useReadContracts.mockReturnValue({
			data: [
				{ result: [0, 0] },
				{ result: false },
				{ result: [0, 0] },
				{ result: false },
				{ result: [0, 0] },
				{ result: true },
			],
			refetch: mocks.refetch,
		});
		mocks.useSwitchChain.mockReturnValue({
			switchChainAsync: mocks.switchChainAsync,
		});
		mocks.useWriteContract.mockReturnValue({
			writeContractAsync: mocks.writeContractAsync,
		});
		mocks.useWaitForTransactionReceipt.mockReturnValue({
			isError: false,
			isSuccess: false,
			error: undefined,
		});
		mocks.refetch.mockResolvedValue(undefined);
		mocks.simulateContract.mockResolvedValue({
			request: { chainId: 11155111 },
		});
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
	});

	it("maps real balance, enumerable cards, traits, and lock state", () => {
		const { result } = renderHook(() => useKeepsakes());

		expect(result.current.isConfigured).toBe(true);
		expect(result.current.balance).toBe(24n);
		expect(result.current.cards).toEqual([
			{ tokenId: 1n, series: 0, rarity: 0, locked: false },
			{ tokenId: 2n, series: 0, rarity: 0, locked: false },
			{ tokenId: 3n, series: 0, rarity: 0, locked: true },
		]);
	});

	it("simulates the fixed-cost draw before asking the wallet to write", async () => {
		const { result } = renderHook(() => useKeepsakes());

		await act(async () => result.current.draw());

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				functionName: "requestDraw",
				args: [],
				account,
				chainId: 11155111,
			}),
		);
		expect(result.current.transactionHash).toBe(transactionHash);
		expect(result.current.phase).toBe("confirming");
		expect(mocks.businessStart).toHaveBeenCalledWith("business.keepsake.draw");
		expect(mocks.businessSucceed).not.toHaveBeenCalled();
	});

	it("settles the draw metric only after the VRF result and readback", async () => {
		const { result, rerender } = renderHook(() => useKeepsakes());
		await act(async () => result.current.draw());

		latestRequestId = 9n;
		requestStatus = 2;
		rerender();

		await waitFor(() => expect(mocks.businessSucceed).toHaveBeenCalledOnce());
		expect(mocks.refetch).toHaveBeenCalled();
	});

	it("restores a pending VRF request after returning to the page", () => {
		latestRequestId = 9n;
		const { result } = renderHook(() => useKeepsakes());

		expect(result.current.request?.requestId).toBe(9n);
		expect(result.current.phase).toBe("randomness");
		expect(result.current.message).toContain("可离开页面后再回来查看");
		expect(result.current.isPending).toBe(true);
	});
});
