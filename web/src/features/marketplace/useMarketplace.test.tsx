import { renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	countRefetch: vi.fn(),
	tasksRefetch: vi.fn(),
	useReadContract: vi.fn(),
	useReadContracts: vi.fn(),
}));

vi.mock("wagmi", async (importOriginal) => {
	const actual = await importOriginal<typeof import("wagmi")>();
	return {
		...actual,
		useReadContract: mocks.useReadContract,
		useReadContracts: mocks.useReadContracts,
	};
});

import { useMarketplace } from "./useMarketplace";

const marketplace = "0x3333333333333333333333333333333333333333" as Address;
const provider = "0x1111111111111111111111111111111111111111" as Address;
const payee = "0x2222222222222222222222222222222222222222" as Address;

describe("useMarketplace", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.useReadContract.mockReturnValue({
			data: undefined,
			error: null,
			isError: false,
			isPending: false,
			refetch: mocks.countRefetch,
		});
		mocks.useReadContracts.mockReturnValue({
			data: undefined,
			error: null,
			isError: false,
			isPending: false,
			refetch: mocks.tasksRefetch,
		});
	});

	it("disables every read when the marketplace is not deployed", () => {
		const { result } = renderHook(() => useMarketplace(undefined, 5_000n));

		expect(result.current.isConfigured).toBe(false);
		expect(result.current.tasks).toEqual([]);
		expect(mocks.useReadContract).toHaveBeenCalledWith(
			expect.objectContaining({ query: { enabled: false } }),
		);
		expect(mocks.useReadContracts).toHaveBeenCalledWith(
			expect.objectContaining({ query: { enabled: false } }),
		);
	});

	it("reads every existing task and maps only successful results", () => {
		mocks.useReadContract.mockReturnValue({
			data: 3n,
			error: null,
			isError: false,
			isPending: false,
			refetch: mocks.countRefetch,
		});
		mocks.useReadContracts.mockReturnValue({
			data: [
				{
					status: "success",
					result: {
						provider,
						payee,
						activityType: 0,
						metadataUri: "ipfs://meal",
						requestId: 1n,
						price: 2n * 10n ** 18n,
						opensAt: 1_000n,
						closesAt: 8_000n,
						active: true,
						paused: false,
					},
				},
				{ status: "failure", error: new Error("RPC failure") },
			],
			error: null,
			isError: false,
			isPending: false,
			refetch: mocks.tasksRefetch,
		});

		const { result } = renderHook(() => useMarketplace(marketplace, 5_000n));

		expect(result.current.isConfigured).toBe(true);
		expect(result.current.tasks).toHaveLength(1);
		expect(result.current.tasks[0]).toMatchObject({
			id: 1n,
			activity: "meal",
			priceLabel: "2 BABY",
			state: "active",
		});
		expect(mocks.useReadContracts).toHaveBeenCalledWith(
			expect.objectContaining({
				allowFailure: true,
				contracts: [
					expect.objectContaining({ functionName: "getTask", args: [1n] }),
					expect.objectContaining({ functionName: "getTask", args: [2n] }),
				],
			}),
		);
	});

	it("reports a read error without substituting fake tasks", () => {
		mocks.useReadContract.mockReturnValue({
			data: undefined,
			error: new Error("private rpc details"),
			isError: true,
			isPending: false,
			refetch: mocks.countRefetch,
		});

		const { result } = renderHook(() => useMarketplace(marketplace, 5_000n));

		expect(result.current.phase).toBe("error");
		expect(result.current.tasks).toEqual([]);
		expect(result.current.message).toBe("读取链上成长任务失败，请稍后重试。");
	});
});
