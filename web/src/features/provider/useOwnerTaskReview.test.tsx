import { act, renderHook } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	simulateContract: vi.fn(),
	useAccount: vi.fn(),
	useReadContract: vi.fn(),
	useWaitForTransactionReceipt: vi.fn(),
	useWriteContract: vi.fn(),
	writeContractAsync: vi.fn(),
}));

vi.mock("@wagmi/core", () => ({ simulateContract: mocks.simulateContract }));
vi.mock("wagmi", async (importOriginal) => ({
	...(await importOriginal<typeof import("wagmi")>()),
	useAccount: mocks.useAccount,
	useReadContract: mocks.useReadContract,
	useWaitForTransactionReceipt: mocks.useWaitForTransactionReceipt,
	useWriteContract: mocks.useWriteContract,
}));

import { wagmiConfig } from "../../config/wagmi";
import { useOwnerTaskReview } from "./useOwnerTaskReview";

const owner = "0x1111111111111111111111111111111111111111" as Address;
const marketplace = "0x2222222222222222222222222222222222222222" as Address;
const hash = `0x${"a".repeat(64)}` as Hash;

describe("useOwnerTaskReview", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.useAccount.mockReturnValue({
			address: owner,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useReadContract.mockReturnValue({
			data: true,
			isError: false,
			isPending: false,
		});
		mocks.useWaitForTransactionReceipt.mockReturnValue({
			isError: false,
			isSuccess: false,
			error: null,
		});
		mocks.useWriteContract.mockReturnValue({
			writeContractAsync: mocks.writeContractAsync,
		});
		mocks.simulateContract.mockImplementation(async (_config, request) => ({
			request,
		}));
		mocks.writeContractAsync.mockResolvedValue(hash);
	});

	it("approves a pending V2 task only for the admin wallet", async () => {
		const { result } = renderHook(() => useOwnerTaskReview(marketplace));
		act(() => result.current.setTaskId("7"));
		expect(result.current.canApprove).toBe(true);
		await act(async () => result.current.approve());

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				address: marketplace,
				functionName: "approveTask",
				args: [7n],
				account: owner,
			}),
		);
	});

	it("hashes a normalized rejection reason before rejecting", async () => {
		const { result } = renderHook(() => useOwnerTaskReview(marketplace));
		act(() => {
			result.current.setTaskId("8");
			result.current.setRejectionReason("  元数据不完整  ");
		});
		expect(result.current.canReject).toBe(true);
		await act(async () => result.current.reject());

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				functionName: "rejectTask",
				args: [8n, expect.stringMatching(/^0x[0-9a-f]{64}$/u)],
			}),
		);
	});

	it("blocks writes when the connected wallet is not the contract admin", () => {
		mocks.useReadContract.mockReturnValue({
			data: false,
			isError: false,
			isPending: false,
		});
		const { result } = renderHook(() => useOwnerTaskReview(marketplace));
		act(() => result.current.setTaskId("7"));
		expect(result.current.isOwner).toBe(false);
		expect(result.current.canApprove).toBe(false);
	});
});
