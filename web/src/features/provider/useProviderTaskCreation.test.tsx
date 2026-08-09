import { act, renderHook, waitFor } from "@testing-library/react";
import type { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	roleRefetch: vi.fn(),
	simulateContract: vi.fn(),
	switchChainAsync: vi.fn(),
	useAccount: vi.fn(),
	useReadContract: vi.fn(),
	useSwitchChain: vi.fn(),
	useWaitForTransactionReceipt: vi.fn(),
	useWriteContract: vi.fn(),
	writeContractAsync: vi.fn(),
	receipt: { error: null as unknown, isError: false, isSuccess: false },
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
import { useProviderTaskCreation } from "./useProviderTaskCreation";

const account = "0x1111111111111111111111111111111111111111" as Address;
const marketplace = "0x2222222222222222222222222222222222222222" as Address;
const transactionHash = `0x${"c".repeat(64)}` as Hash;

function installMetaMask() {
	Object.defineProperty(window, "ethereum", {
		configurable: true,
		value: { isMetaMask: true },
	});
}

describe("useProviderTaskCreation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		installMetaMask();
		mocks.receipt.error = null;
		mocks.receipt.isError = false;
		mocks.receipt.isSuccess = false;
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useReadContract.mockReturnValue({
			data: true,
			isError: false,
			isPending: false,
			refetch: mocks.roleRefetch,
		});
		mocks.useSwitchChain.mockReturnValue({
			switchChainAsync: mocks.switchChainAsync,
		});
		mocks.useWriteContract.mockReturnValue({
			writeContractAsync: mocks.writeContractAsync,
		});
		mocks.useWaitForTransactionReceipt.mockReturnValue(mocks.receipt);
		mocks.simulateContract.mockImplementation(async (_config, request) => ({
			request,
		}));
		mocks.roleRefetch.mockResolvedValue(undefined);
	});

	it("creates a task for the connected Provider and uses it as payee", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const { result } = renderHook(() => useProviderTaskCreation(marketplace));

		act(() => {
			result.current.setActivity("walk");
			result.current.setMetadataUri("ipfs://task-1");
		});
		expect(result.current.canSubmit).toBe(true);
		await act(async () => result.current.createTask());

		expect(mocks.simulateContract).toHaveBeenCalledWith(
			wagmiConfig,
			expect.objectContaining({
				address: marketplace,
				functionName: "createTask",
				args: [account, 1, "ipfs://task-1"],
				account,
				chainId: 11155111,
			}),
		);
		expect(result.current.phase).toBe("confirming");
		expect(result.current.transactionHash).toBe(transactionHash);
	});

	it("blocks a connected wallet without PROVIDER_ROLE", () => {
		mocks.useReadContract.mockReturnValue({
			data: false,
			isError: false,
			isPending: false,
			refetch: mocks.roleRefetch,
		});
		const { result } = renderHook(() => useProviderTaskCreation(marketplace));
		act(() => result.current.setMetadataUri("ipfs://task-1"));

		expect(result.current.hasProviderRole).toBe(false);
		expect(result.current.canSubmit).toBe(false);
		expect(result.current.message).toBe("当前钱包没有 PROVIDER_ROLE。");
	});

	it("reports VRF pending only after the create transaction receipt", async () => {
		mocks.writeContractAsync.mockResolvedValue(transactionHash);
		const { result, rerender } = renderHook(() =>
			useProviderTaskCreation(marketplace),
		);
		act(() => result.current.setMetadataUri("ipfs://task-1"));
		await act(async () => result.current.createTask());

		mocks.receipt.isSuccess = true;
		rerender();
		await waitFor(() => expect(result.current.phase).toBe("success"));
		expect(result.current.message).toBe(
			"任务创建已确认，正在等待 Chainlink VRF 激活。",
		);
		expect(result.current.metadataUri).toBe("");
	});
});
