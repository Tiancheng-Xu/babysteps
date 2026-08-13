import { simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Hash } from "viem";
import {
	useAccount,
	useReadContract,
	useReadContracts,
	useSwitchChain,
	useWaitForTransactionReceipt,
	useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";

import { wagmiConfig } from "../../config/wagmi";
import {
	notebookAddress,
	onchainNotebookAbi,
} from "../../contracts/onchainNotebook";
import {
	starBuddyKeepsakeSbtAbi,
	starBuddyKeepsakeSbtAddress,
	starBuddyKeepsakesAbi,
	starBuddyKeepsakesAddress,
} from "../../contracts/web3Contracts";
import { toWalletMessage } from "../../lib/walletError";
import { deriveWalletState, hasMetaMaskProvider } from "../wallet/walletState";
import type { KeepsakeCard } from "./keepsakeModel";

export type KeepsakeRequest = {
	requestId: bigint;
	owner: `0x${string}`;
	kind: number;
	status: number;
	requestedAt: bigint;
	tokenIds: readonly [bigint, bigint, bigint];
	resultTokenId: bigint;
	burnedTokenId: bigint;
};

export type KeepsakePhase =
	| "unavailable"
	| "reading"
	| "ready"
	| "awaiting-signature"
	| "confirming"
	| "randomness"
	| "success"
	| "failure"
	| "error";

type LocalPhase = Extract<
	KeepsakePhase,
	"awaiting-signature" | "confirming" | "error"
>;

function normalizeRequest(
	requestId: bigint,
	value: unknown,
): KeepsakeRequest | undefined {
	if (!value || typeof value !== "object") return undefined;
	const request = value as Partial<Omit<KeepsakeRequest, "requestId">>;
	if (
		typeof request.owner !== "string" ||
		typeof request.kind !== "number" ||
		typeof request.status !== "number" ||
		typeof request.requestedAt !== "bigint" ||
		!Array.isArray(request.tokenIds) ||
		typeof request.resultTokenId !== "bigint" ||
		typeof request.burnedTokenId !== "bigint"
	) {
		return undefined;
	}
	return {
		requestId,
		owner: request.owner as `0x${string}`,
		kind: request.kind,
		status: request.status,
		requestedAt: request.requestedAt,
		tokenIds: request.tokenIds as [bigint, bigint, bigint],
		resultTokenId: request.resultTokenId,
		burnedTokenId: request.burnedTokenId,
	};
}

export function useKeepsakes() {
	const { address, chainId, isConnected } = useAccount();
	const { switchChainAsync } = useSwitchChain();
	const { writeContractAsync } = useWriteContract();
	const [transactionHash, setTransactionHash] = useState<Hash>();
	const [localPhase, setLocalPhase] = useState<LocalPhase>();
	const [localMessage, setLocalMessage] = useState<string>();
	const pendingRef = useRef(false);
	const settledRequestRef = useRef<bigint | undefined>(undefined);

	const walletState = deriveWalletState({
		hasProvider: hasMetaMaskProvider(),
		isConnected,
		address,
		chainId,
	});
	const isConfigured = Boolean(
		starBuddyKeepsakeSbtAddress && starBuddyKeepsakesAddress,
	);
	const readsEnabled =
		isConfigured && walletState === "ready" && Boolean(address);

	const balanceRead = useReadContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "getTransferableBalance",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled },
	});
	const tokenIdsRead = useReadContract({
		address: starBuddyKeepsakeSbtAddress,
		abi: starBuddyKeepsakeSbtAbi,
		functionName: "tokensOfOwner",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled },
	});
	const latestRequestRead = useReadContract({
		address: starBuddyKeepsakesAddress,
		abi: starBuddyKeepsakesAbi,
		functionName: "latestRequestIdByOwner",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled },
	});

	const tokenIds = useMemo(
		() =>
			Array.isArray(tokenIdsRead.data)
				? (tokenIdsRead.data as readonly bigint[])
				: [],
		[tokenIdsRead.data],
	);
	const latestRequestId =
		typeof latestRequestRead.data === "bigint" ? latestRequestRead.data : 0n;
	const detailReads = useReadContracts({
		contracts: tokenIds.flatMap((tokenId) => [
			{
				address: starBuddyKeepsakeSbtAddress,
				abi: starBuddyKeepsakeSbtAbi,
				functionName: "getKeepsake" as const,
				args: [tokenId] as const,
				chainId: sepolia.id,
			},
			{
				address: starBuddyKeepsakesAddress,
				abi: starBuddyKeepsakesAbi,
				functionName: "isTokenLocked" as const,
				args: [tokenId] as const,
				chainId: sepolia.id,
			},
		]),
		query: { enabled: readsEnabled && tokenIds.length > 0 },
	});
	const requestRead = useReadContract({
		address: starBuddyKeepsakesAddress,
		abi: starBuddyKeepsakesAbi,
		functionName: "getRequest",
		args: latestRequestId > 0n ? [latestRequestId] : undefined,
		chainId: sepolia.id,
		query: {
			enabled: readsEnabled && latestRequestId > 0n,
			refetchInterval: latestRequestId > 0n ? 8_000 : false,
		},
	});
	const request = normalizeRequest(latestRequestId, requestRead.data);
	const cards = useMemo(() => {
		const results = detailReads.data ?? [];
		return tokenIds.flatMap((tokenId, index): KeepsakeCard[] => {
			const traits = results[index * 2]?.result;
			const locked = results[index * 2 + 1]?.result;
			if (!Array.isArray(traits) || typeof locked !== "boolean") return [];
			return [
				{
					tokenId,
					series: Number(traits[0]),
					rarity: Number(traits[1]),
					locked,
				},
			];
		});
	}, [detailReads.data, tokenIds]);

	const receipt = useWaitForTransactionReceipt({
		hash: transactionHash,
		chainId: sepolia.id,
		query: { enabled: Boolean(transactionHash) },
	});

	useEffect(() => {
		if (!receipt.isError) return;
		pendingRef.current = false;
		setLocalPhase("error");
		setLocalMessage(toWalletMessage(receipt.error));
	}, [receipt.error, receipt.isError]);

	useEffect(() => {
		if (!receipt.isSuccess) return;
		pendingRef.current = false;
		setLocalPhase(undefined);
		setLocalMessage("请求交易已确认，正在等待 Chainlink VRF 返回随机结果。");
		void Promise.all([
			balanceRead.refetch(),
			tokenIdsRead.refetch(),
			latestRequestRead.refetch(),
		]);
	}, [
		balanceRead.refetch,
		latestRequestRead.refetch,
		receipt.isSuccess,
		tokenIdsRead.refetch,
	]);

	useEffect(() => {
		if (!request || ![2, 3, 4].includes(request.status)) return;
		if (settledRequestRef.current === request.requestId) return;
		settledRequestRef.current = request.requestId;
		void Promise.all([
			balanceRead.refetch(),
			tokenIdsRead.refetch(),
			detailReads.refetch(),
		]);
	}, [balanceRead.refetch, detailReads.refetch, request, tokenIdsRead.refetch]);

	const submit = useCallback(
		async (
			functionName: "requestDraw" | "requestFusion" | "recover",
			args:
				| readonly []
				| readonly [[bigint, bigint, bigint]]
				| readonly [bigint],
			message: string,
		) => {
			if (
				pendingRef.current ||
				!address ||
				!starBuddyKeepsakesAddress ||
				walletState !== "ready"
			) {
				return;
			}
			pendingRef.current = true;
			setTransactionHash(undefined);
			setLocalPhase("awaiting-signature");
			setLocalMessage(message);
			try {
				const simulation = await simulateContract(wagmiConfig, {
					address: starBuddyKeepsakesAddress,
					abi: starBuddyKeepsakesAbi,
					functionName,
					args,
					account: address,
					chainId: sepolia.id,
				});
				const hash = await writeContractAsync(simulation.request);
				setTransactionHash(hash);
				setLocalPhase("confirming");
				setLocalMessage("交易已广播，正在等待 Sepolia 确认。");
			} catch (error) {
				pendingRef.current = false;
				setLocalPhase("error");
				setLocalMessage(toWalletMessage(error));
			}
		},
		[address, walletState, writeContractAsync],
	);

	const draw = useCallback(
		() => submit("requestDraw", [], "请在钱包中确认消耗 12 枚成长星抽卡。"),
		[submit],
	);
	const fuse = useCallback(
		(tokenIdsToFuse: [bigint, bigint, bigint]) =>
			submit(
				"requestFusion",
				[tokenIdsToFuse],
				"请在钱包中确认锁定这 3 张纪念卡并发起融合。",
			),
		[submit],
	);
	const recover = useCallback(
		(requestId: bigint) =>
			submit("recover", [requestId], "请确认恢复超时请求。"),
		[submit],
	);
	const switchToSepolia = useCallback(async () => {
		try {
			await switchChainAsync({ chainId: sepolia.id });
		} catch (error) {
			setLocalPhase("error");
			setLocalMessage(toWalletMessage(error));
		}
	}, [switchChainAsync]);

	const readsPending =
		readsEnabled &&
		(balanceRead.isPending ||
			tokenIdsRead.isPending ||
			latestRequestRead.isPending);
	const readsError =
		balanceRead.isError || tokenIdsRead.isError || latestRequestRead.isError;
	let phase: KeepsakePhase = "ready";
	if (!isConfigured || walletState !== "ready") phase = "unavailable";
	else if (localPhase) phase = localPhase;
	else if (readsError) phase = "error";
	else if (readsPending) phase = "reading";
	else if (request?.status === 1) phase = "randomness";
	else if (request?.status === 2) phase = "success";
	else if (request?.status === 3) phase = "failure";

	let message = localMessage;
	if (!message && walletState === "missing") message = "未检测到可用钱包。";
	else if (!message && walletState === "disconnected") message = "请连接钱包。";
	else if (!message && walletState === "wrong-network")
		message = "请切换到 Sepolia。";
	else if (!message && readsError) message = "读取链上纪念卡失败，请稍后重试。";
	else if (!message && request?.status === 1) {
		message = `随机请求 #${request.requestId.toString()} 已提交，可离开页面后再回来查看。`;
	} else if (!message && request?.status === 2)
		message = "链上随机结果已确认。";
	else if (!message && request?.status === 3) {
		message = `本次融合未成功，Token #${request.burnedTokenId.toString()} 已按随机结果销毁。`;
	} else if (!message && request?.status === 4)
		message = "超时请求已安全恢复。";

	const canRecover = Boolean(
		request?.status === 1 &&
			Date.now() / 1_000 >= Number(request.requestedAt) + 24 * 60 * 60,
	);

	return {
		isConfigured,
		walletState,
		balance:
			typeof balanceRead.data === "bigint" ? balanceRead.data : undefined,
		cards,
		request,
		phase,
		message,
		transactionHash,
		isPending:
			pendingRef.current ||
			phase === "awaiting-signature" ||
			phase === "confirming" ||
			phase === "randomness",
		canRecover,
		draw,
		fuse,
		recover,
		switchToSepolia,
	};
}
