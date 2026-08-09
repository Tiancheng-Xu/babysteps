import { useCallback, useMemo } from "react";
import type { Address } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { sepolia } from "wagmi/chains";

import {
	taskMarketplaceAbi,
	taskMarketplaceAddress,
} from "../../contracts/web3Contracts";
import {
	isMarketplaceContractTask,
	type MarketplaceTask,
	toMarketplaceTask,
} from "./marketplaceModel";

const MAX_VISIBLE_TASKS = 50n;

export type MarketplacePhase = "unconfigured" | "loading" | "ready" | "error";

function taskIdsFor(nextTaskId: bigint | undefined) {
	if (!nextTaskId || nextTaskId <= 1n) return [];
	const lastTaskId = nextTaskId - 1n;
	const firstTaskId =
		lastTaskId > MAX_VISIBLE_TASKS ? lastTaskId - MAX_VISIBLE_TASKS + 1n : 1n;
	return Array.from(
		{ length: Number(lastTaskId - firstTaskId + 1n) },
		(_, index) => firstTaskId + BigInt(index),
	);
}

export function useMarketplace(
	marketplaceAddress: Address | undefined = taskMarketplaceAddress,
	now: bigint = BigInt(Math.floor(Date.now() / 1_000)),
) {
	const isConfigured = Boolean(marketplaceAddress);
	const countRead = useReadContract({
		address: marketplaceAddress,
		abi: taskMarketplaceAbi,
		functionName: "nextTaskId",
		chainId: sepolia.id,
		query: { enabled: isConfigured },
	});

	const taskIds = useMemo(
		() =>
			taskIdsFor(
				typeof countRead.data === "bigint" ? countRead.data : undefined,
			),
		[countRead.data],
	);
	const taskReads = useReadContracts({
		allowFailure: true,
		contracts: taskIds.map((taskId) => ({
			address: marketplaceAddress,
			abi: taskMarketplaceAbi,
			functionName: "getTask" as const,
			args: [taskId] as const,
			chainId: sepolia.id,
		})),
		query: { enabled: isConfigured && taskIds.length > 0 },
	});

	const tasks = useMemo(() => {
		const mapped: MarketplaceTask[] = [];
		for (const [index, read] of (taskReads.data ?? []).entries()) {
			if (
				read.status !== "success" ||
				!isMarketplaceContractTask(read.result)
			) {
				continue;
			}
			const taskId = taskIds[index];
			if (taskId === undefined) continue;
			mapped.push(toMarketplaceTask(taskId, read.result, now));
		}
		return mapped;
	}, [now, taskIds, taskReads.data]);

	let phase: MarketplacePhase = "ready";
	let message: string | undefined;
	if (!isConfigured) phase = "unconfigured";
	else if (countRead.isError || taskReads.isError) {
		phase = "error";
		message = "读取链上成长任务失败，请稍后重试。";
	} else if (countRead.isPending || taskReads.isPending) {
		phase = "loading";
		message = "正在读取 Sepolia 成长任务。";
	}

	const retryRead = useCallback(async () => {
		await countRead.refetch();
		if (taskIds.length > 0) await taskReads.refetch();
	}, [countRead, taskIds.length, taskReads]);

	return {
		isConfigured,
		tasks,
		phase,
		message,
		isPending: phase === "loading",
		retryRead,
	};
}
