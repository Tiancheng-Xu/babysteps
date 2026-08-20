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
import { useOwnerCompletionConfirmation } from "./useOwnerCompletionConfirmation";

const owner = "0x1111111111111111111111111111111111111111" as Address;
const marketplace = "0x2222222222222222222222222222222222222222" as Address;
const transactionHash = `0x${"b".repeat(64)}` as Hash;

describe("useOwnerCompletionConfirmation", () => {
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
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
	});

	it("confirms the exact D1-reviewed evidence on V2", async () => {
		const { result } = renderHook(() =>
			useOwnerCompletionConfirmation(
				{
					purchaseId: "9",
					evidenceHash: `0x${"a".repeat(64)}`,
					certificateUri: "ipfs://certificate-1",
				},
				marketplace,
			),
		);
		expect(result.current.canConfirm).toBe(true);
		await act(async () => result.current.confirm());

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				address: marketplace,
				functionName: "confirmCompletion",
				args: [9n, `0x${"a".repeat(64)}`, "ipfs://certificate-1"],
				account: owner,
			}),
		);
	});

	it("blocks confirmation when the wallet lacks the completion role", () => {
		mocks.useReadContract.mockReturnValue({
			data: false,
			isError: false,
			isPending: false,
		});
		const { result } = renderHook(() =>
			useOwnerCompletionConfirmation(
				{
					purchaseId: "9",
					evidenceHash: `0x${"a".repeat(64)}`,
					certificateUri: "ipfs://certificate-1",
				},
				marketplace,
			),
		);
		expect(result.current.hasCompletionRole).toBe(false);
		expect(result.current.canConfirm).toBe(false);
	});
});
