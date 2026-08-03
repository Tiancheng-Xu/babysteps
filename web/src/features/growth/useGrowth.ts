import { useQueryClient } from "@tanstack/react-query";
import { simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Hash } from "viem";
import {
	useAccount,
	useReadContract,
	useSwitchChain,
	useWaitForTransactionReceipt,
	useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { readContractQueryKey } from "wagmi/query";

import { wagmiConfig } from "../../config/wagmi";
import {
	notebookAddress,
	onchainNotebookAbi,
} from "../../contracts/onchainNotebook";
import { toWalletMessage } from "../../lib/walletError";
import { deriveWalletState, hasMetaMaskProvider } from "../wallet/walletState";
import {
	GROWTH_ACTIVITIES,
	type GrowthActivityId,
	type GrowthStageName,
	growthStageFromCode,
} from "./growthModel";

export type GrowthPhase =
	| "idle"
	| "reading"
	| "read-error"
	| "awaiting-signature"
	| "confirming"
	| "success"
	| "write-error";

type TransactionPhase = Exclude<GrowthPhase, "idle" | "reading" | "read-error">;

type TodayByActivity = Record<GrowthActivityId, boolean>;

function isUserRejected(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === 4001
	);
}

export function useGrowth() {
	const queryClient = useQueryClient();
	const { address, chainId, isConnected } = useAccount();
	const { switchChainAsync } = useSwitchChain();
	const { writeContractAsync } = useWriteContract();
	const [transactionHash, setTransactionHash] = useState<Hash>();
	const [transactionPhase, setTransactionPhase] = useState<TransactionPhase>();
	const [transactionMessage, setTransactionMessage] = useState<string>();
	const pendingRef = useRef(false);
	const confirmedHashRef = useRef<Hash | undefined>(undefined);
	const activityRef = useRef<(typeof GROWTH_ACTIVITIES)[number] | undefined>(
		undefined,
	);

	const walletState = deriveWalletState({
		hasProvider: hasMetaMaskProvider(),
		isConnected,
		address,
		chainId,
	});
	const readEnabled = walletState === "ready";

	const pointsRead = useReadContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "getGrowthPoints",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readEnabled },
	});
	const stageRead = useReadContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "getGrowthStage",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readEnabled },
	});
	const mealRead = useReadContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "hasRecordedToday",
		args: address ? [address, 0] : undefined,
		chainId: sepolia.id,
		query: { enabled: readEnabled },
	});
	const walkRead = useReadContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "hasRecordedToday",
		args: address ? [address, 1] : undefined,
		chainId: sepolia.id,
		query: { enabled: readEnabled },
	});
	const readActivityRead = useReadContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "hasRecordedToday",
		args: address ? [address, 2] : undefined,
		chainId: sepolia.id,
		query: { enabled: readEnabled },
	});

	const reads = [pointsRead, stageRead, mealRead, walkRead, readActivityRead];
	const readsSucceeded = readEnabled && reads.every((read) => read.isSuccess);
	const hasReadError = reads.some((read) => read.isError);
	const isReading = reads.some((read) => read.isPending);

	const points =
		readsSucceeded && typeof pointsRead.data === "bigint"
			? pointsRead.data
			: undefined;
	let stage: GrowthStageName | undefined;
	if (readsSucceeded && typeof stageRead.data === "number") {
		stage = growthStageFromCode(stageRead.data);
	}
	const todayByActivity: TodayByActivity | undefined = readsSucceeded
		? {
				meal: mealRead.data === true,
				walk: walkRead.data === true,
				read: readActivityRead.data === true,
			}
		: undefined;

	const readQueryKeys = useMemo(() => {
		if (!address) return [];
		return [
			readContractQueryKey({
				address: notebookAddress,
				functionName: "getGrowthPoints",
				args: [address],
				chainId: sepolia.id,
			}),
			readContractQueryKey({
				address: notebookAddress,
				functionName: "getGrowthStage",
				args: [address],
				chainId: sepolia.id,
			}),
			readContractQueryKey({
				address: notebookAddress,
				functionName: "getTransferableBalance",
				args: [address],
				chainId: sepolia.id,
			}),
			...GROWTH_ACTIVITIES.map((activity) =>
				readContractQueryKey({
					address: notebookAddress,
					functionName: "hasRecordedToday",
					args: [address, activity.contractValue],
					chainId: sepolia.id,
				}),
			),
		];
	}, [address]);

	const receipt = useWaitForTransactionReceipt({
		hash: transactionHash,
		chainId: sepolia.id,
		query: { enabled: Boolean(transactionHash) },
	});

	useEffect(() => {
		if (!receipt.isError || !transactionHash) return;
		pendingRef.current = false;
		setTransactionPhase("write-error");
		setTransactionMessage(toWalletMessage(receipt.error));
	}, [receipt.error, receipt.isError, transactionHash]);

	useEffect(() => {
		if (
			!receipt.isSuccess ||
			!transactionHash ||
			readQueryKeys.length !== 6 ||
			confirmedHashRef.current === transactionHash
		) {
			return;
		}

		confirmedHashRef.current = transactionHash;
		void Promise.all(
			readQueryKeys.map((queryKey) =>
				queryClient.invalidateQueries({ queryKey }),
			),
		)
			.then(() => {
				pendingRef.current = false;
				setTransactionPhase("success");
				setTransactionMessage(
					`记录成功，获得 +${activityRef.current?.reward ?? 0} 枚成长星。`,
				);
			})
			.catch(() => {
				pendingRef.current = false;
				setTransactionPhase("write-error");
				setTransactionMessage("交易已确认，但刷新成长状态失败，请重试读取。");
			});
	}, [queryClient, readQueryKeys, receipt.isSuccess, transactionHash]);

	const recordActivity = useCallback(
		async (activityId: GrowthActivityId) => {
			if (pendingRef.current || walletState !== "ready" || !address) return;
			const activity = GROWTH_ACTIVITIES.find(({ id }) => id === activityId);
			if (!activity) return;
			if (todayByActivity?.[activityId]) {
				setTransactionPhase("write-error");
				setTransactionMessage(
					"今天已经记录这项陪伴，北京时间明天 00:00 后再来。",
				);
				return;
			}

			pendingRef.current = true;
			confirmedHashRef.current = undefined;
			activityRef.current = activity;
			setTransactionHash(undefined);
			setTransactionPhase("awaiting-signature");
			setTransactionMessage("请在 MetaMask 中确认这次陪伴记录。");

			try {
				const simulation = await simulateContract(wagmiConfig, {
					address: notebookAddress,
					abi: onchainNotebookAbi,
					functionName: "recordActivity",
					args: [activity.contractValue],
					account: address,
					chainId: sepolia.id,
				});
				const hash = await writeContractAsync(simulation.request);
				setTransactionHash(hash);
				setTransactionPhase("confirming");
				setTransactionMessage("交易已广播，正在等待测试链确认。");
			} catch (error) {
				pendingRef.current = false;
				setTransactionPhase("write-error");
				setTransactionMessage(
					isUserRejected(error)
						? "已取消，本次没有写入测试链。"
						: toWalletMessage(error),
				);
			}
		},
		[address, todayByActivity, walletState, writeContractAsync],
	);

	const retryRead = useCallback(
		() =>
			Promise.all([
				pointsRead.refetch(),
				stageRead.refetch(),
				mealRead.refetch(),
				walkRead.refetch(),
				readActivityRead.refetch(),
			]).then(() => undefined),
		[
			pointsRead.refetch,
			stageRead.refetch,
			mealRead.refetch,
			walkRead.refetch,
			readActivityRead.refetch,
		],
	);

	const switchToSepolia = useCallback(async () => {
		try {
			await switchChainAsync({ chainId: sepolia.id });
		} catch (error) {
			setTransactionPhase("write-error");
			setTransactionMessage(toWalletMessage(error));
		}
	}, [switchChainAsync]);

	const phase: GrowthPhase = transactionPhase
		? transactionPhase
		: readEnabled && hasReadError
			? "read-error"
			: readEnabled && isReading
				? "reading"
				: "idle";
	const message = transactionMessage
		? transactionMessage
		: readEnabled && hasReadError
			? "读取成长状态失败，请重试。"
			: walletState === "missing"
				? "未检测到 MetaMask。"
				: walletState === "disconnected"
					? "请连接 MetaMask。"
					: walletState === "wrong-network"
						? "请切换到 Sepolia 网络。"
						: undefined;

	return {
		walletState,
		points,
		stage,
		todayByActivity,
		phase,
		message,
		transactionHash,
		recordActivity,
		retryRead,
		switchToSepolia,
		isPending: phase === "awaiting-signature" || phase === "confirming",
	};
}
