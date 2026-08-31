import { simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address, Hash } from "viem";
import {
	useAccount,
	useReadContract,
	useSwitchChain,
	useWaitForTransactionReceipt,
	useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";

import { wagmiConfig } from "../../config/wagmi";
import {
	babyCoinAbi,
	babyCoinAddress,
	growthActivitiesAbi,
	growthActivitiesAddress,
} from "../../contracts/web3Contracts";
import { toWalletMessage } from "../../lib/walletError";
import { createBusinessOperationLifecycle } from "../../performance/runtime";
import {
	GROWTH_ACTIVITIES,
	type GrowthActivityId,
	type GrowthStageName,
	growthStageFromCode,
} from "../growth/growthModel";
import { deriveWalletState, hasMetaMaskProvider } from "../wallet/walletState";

export type BabyCoinGrowthPhase =
	| "unconfigured"
	| "unavailable"
	| "loading"
	| "read-error"
	| "ready"
	| "awaiting-signature"
	| "confirming"
	| "success"
	| "write-error";

export type BabyCoinActivityAvailability = {
	available: boolean;
	dailyLimitReached: boolean;
};

type AvailabilityByActivity = Record<
	GrowthActivityId,
	BabyCoinActivityAvailability
>;

type TransactionPhase = Extract<
	BabyCoinGrowthPhase,
	"awaiting-signature" | "confirming" | "success" | "write-error"
>;

export function useBabyCoinGrowth(
	babyCoinContractAddress: Address | undefined = babyCoinAddress,
	activitiesContractAddress: Address | undefined = growthActivitiesAddress,
) {
	const { address, chainId, isConnected } = useAccount();
	const { switchChainAsync } = useSwitchChain();
	const { writeContractAsync } = useWriteContract();
	const [transactionHash, setTransactionHash] = useState<Hash>();
	const [transactionPhase, setTransactionPhase] = useState<TransactionPhase>();
	const [message, setMessage] = useState<string>();
	const pendingRef = useRef(false);
	const confirmedHashRef = useRef<Hash | undefined>(undefined);
	const activityRef = useRef<(typeof GROWTH_ACTIVITIES)[number] | undefined>(
		undefined,
	);
	const businessLifecycle = useMemo(createBusinessOperationLifecycle, []);

	const walletState = deriveWalletState({
		hasProvider: hasMetaMaskProvider(),
		isConnected,
		address,
		chainId,
	});
	const isConfigured = Boolean(
		babyCoinContractAddress && activitiesContractAddress,
	);
	const readsEnabled = isConfigured && walletState === "ready";

	const balanceRead = useReadContract({
		address: babyCoinContractAddress,
		abi: babyCoinAbi,
		functionName: "balanceOf",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled },
	});
	const earnedRead = useReadContract({
		address: babyCoinContractAddress,
		abi: babyCoinAbi,
		functionName: "lifetimeEarned",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled },
	});
	const stageRead = useReadContract({
		address: babyCoinContractAddress,
		abi: babyCoinAbi,
		functionName: "growthStageOf",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled },
	});
	const mealRead = useReadContract({
		address: activitiesContractAddress,
		abi: growthActivitiesAbi,
		functionName: "getActivityAvailability",
		args: address ? [address, 0] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled, refetchInterval: 60_000 },
	});
	const walkRead = useReadContract({
		address: activitiesContractAddress,
		abi: growthActivitiesAbi,
		functionName: "getActivityAvailability",
		args: address ? [address, 1] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled, refetchInterval: 60_000 },
	});
	const readingRead = useReadContract({
		address: activitiesContractAddress,
		abi: growthActivitiesAbi,
		functionName: "getActivityAvailability",
		args: address ? [address, 2] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled, refetchInterval: 60_000 },
	});

	const reads = [
		balanceRead,
		earnedRead,
		stageRead,
		mealRead,
		walkRead,
		readingRead,
	];
	const readsSucceeded = readsEnabled && reads.every((read) => read.isSuccess);
	const readsFailed = reads.some((read) => read.isError);
	const readsPending = reads.some((read) => read.isPending);
	const balance =
		readsSucceeded && typeof balanceRead.data === "bigint"
			? balanceRead.data
			: undefined;
	const lifetimeEarned =
		readsSucceeded && typeof earnedRead.data === "bigint"
			? earnedRead.data
			: undefined;
	let stage: GrowthStageName | undefined;
	if (
		readsSucceeded &&
		(typeof stageRead.data === "number" || typeof stageRead.data === "bigint")
	) {
		stage = growthStageFromCode(Number(stageRead.data));
	}
	const availabilityByActivity: AvailabilityByActivity | undefined =
		readsSucceeded &&
		mealRead.data !== undefined &&
		walkRead.data !== undefined &&
		readingRead.data !== undefined
			? {
					meal: {
						available: mealRead.data[0],
						dailyLimitReached: mealRead.data[1],
					},
					walk: {
						available: walkRead.data[0],
						dailyLimitReached: walkRead.data[1],
					},
					read: {
						available: readingRead.data[0],
						dailyLimitReached: readingRead.data[1],
					},
				}
			: undefined;
	const refetchBalance = balanceRead.refetch;
	const refetchEarned = earnedRead.refetch;
	const refetchStage = stageRead.refetch;
	const refetchMeal = mealRead.refetch;
	const refetchWalk = walkRead.refetch;
	const refetchReading = readingRead.refetch;
	const refetchAll = useCallback(
		async () =>
			Promise.all([
				refetchBalance(),
				refetchEarned(),
				refetchStage(),
				refetchMeal(),
				refetchWalk(),
				refetchReading(),
			]),
		[
			refetchBalance,
			refetchEarned,
			refetchMeal,
			refetchReading,
			refetchStage,
			refetchWalk,
		],
	);

	const receipt = useWaitForTransactionReceipt({
		hash: transactionHash,
		chainId: sepolia.id,
		query: { enabled: Boolean(transactionHash) },
	});

	useEffect(() => {
		if (!receipt.isError || !transactionHash) return;
		pendingRef.current = false;
		businessLifecycle.fail();
		setTransactionPhase("write-error");
		setMessage(toWalletMessage(receipt.error));
	}, [businessLifecycle, receipt.error, receipt.isError, transactionHash]);

	useEffect(() => {
		if (
			!receipt.isSuccess ||
			!transactionHash ||
			confirmedHashRef.current === transactionHash
		) {
			return;
		}
		confirmedHashRef.current = transactionHash;
		void refetchAll()
			.then(() => {
				pendingRef.current = false;
				businessLifecycle.succeed();
				setTransactionPhase("success");
				setMessage(
					`活动已确认，获得 +${activityRef.current?.reward ?? 0} BABY。`,
				);
			})
			.catch(() => {
				pendingRef.current = false;
				businessLifecycle.fail();
				setTransactionPhase("write-error");
				setMessage("交易已确认，但刷新 BabyCoin 状态失败，请重试读取。");
			});
	}, [businessLifecycle, receipt.isSuccess, refetchAll, transactionHash]);

	let phase: BabyCoinGrowthPhase = "unavailable";
	if (transactionPhase) phase = transactionPhase;
	else if (!isConfigured) phase = "unconfigured";
	else if (walletState !== "ready") phase = "unavailable";
	else if (readsFailed) phase = "read-error";
	else if (readsPending || !readsSucceeded) phase = "loading";
	else phase = "ready";

	const recordActivity = useCallback(
		async (activityId: GrowthActivityId) => {
			if (
				pendingRef.current ||
				walletState !== "ready" ||
				!address ||
				!activitiesContractAddress
			) {
				return;
			}
			const activity = GROWTH_ACTIVITIES.find(({ id }) => id === activityId);
			if (!activity) return;
			const availability = availabilityByActivity?.[activityId];
			if (!availability?.available) {
				setTransactionPhase("write-error");
				setMessage(
					availability?.dailyLimitReached
						? "这个活动今天已达到领取上限。"
						: "这个活动仍在随机冷却时间内。",
				);
				return;
			}

			pendingRef.current = true;
			businessLifecycle.start("business.babycoin.activity");
			confirmedHashRef.current = undefined;
			activityRef.current = activity;
			setTransactionHash(undefined);
			setTransactionPhase("awaiting-signature");
			setMessage("请在 MetaMask 中确认这次成长活动。");
			try {
				const simulation = await simulateContract(wagmiConfig, {
					address: activitiesContractAddress,
					abi: growthActivitiesAbi,
					functionName: "recordActivity",
					args: [activity.contractValue],
					account: address,
					chainId: sepolia.id,
				});
				const hash = await writeContractAsync(simulation.request);
				setTransactionHash(hash);
				setTransactionPhase("confirming");
				setMessage("活动交易已广播，正在等待链上确认。");
			} catch (error) {
				pendingRef.current = false;
				businessLifecycle.fail();
				setTransactionPhase("write-error");
				setMessage(toWalletMessage(error));
			}
		},
		[
			activitiesContractAddress,
			address,
			availabilityByActivity,
			businessLifecycle,
			walletState,
			writeContractAsync,
		],
	);

	const retryRead = useCallback(async () => {
		await refetchAll();
	}, [refetchAll]);

	const switchToSepolia = useCallback(async () => {
		try {
			await switchChainAsync({ chainId: sepolia.id });
		} catch (error) {
			setTransactionPhase("write-error");
			setMessage(toWalletMessage(error));
		}
	}, [switchChainAsync]);

	return {
		isConfigured,
		walletState,
		balance,
		lifetimeEarned,
		stage,
		availabilityByActivity,
		phase,
		message,
		transactionHash,
		isPending: phase === "awaiting-signature" || phase === "confirming",
		recordActivity,
		retryRead,
		switchToSepolia,
	};
}
