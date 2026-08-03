import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Hash } from "viem";
import {
	useAccount,
	useReadContract,
	useSimulateContract,
	useSwitchChain,
	useWaitForTransactionReceipt,
	useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { readContractQueryKey } from "wagmi/query";

import {
	notebookAddress,
	onchainNotebookAbi,
} from "../../contracts/onchainNotebook";
import { isNoteWithinLimit } from "../../lib/noteBytes";
import { toWalletMessage } from "../../lib/walletError";
import {
	deriveWalletState,
	hasMetaMaskProvider,
	type WalletState,
} from "../wallet/walletState";

export type NotebookWalletState = WalletState;

export type NotebookPhase =
	| "idle"
	| "reading"
	| "read-error"
	| "awaiting-signature"
	| "confirming"
	| "success"
	| "write-error";

type TransactionPhase = Exclude<
	NotebookPhase,
	"idle" | "reading" | "read-error"
>;

export function useNotebook() {
	const queryClient = useQueryClient();
	const { address, chainId, isConnected } = useAccount();
	const { switchChainAsync } = useSwitchChain();
	const { writeContractAsync } = useWriteContract();
	const [draft, setDraftState] = useState("");
	const [transactionHash, setTransactionHash] = useState<Hash>();
	const [transactionPhase, setTransactionPhase] = useState<TransactionPhase>();
	const [transactionMessage, setTransactionMessage] = useState<string>();
	const pendingRef = useRef(false);
	const draftDirtyRef = useRef(false);
	const confirmedHashRef = useRef<Hash | undefined>(undefined);
	const operationRef = useRef<"save" | "clear">("save");

	const walletState = deriveWalletState({
		hasProvider: hasMetaMaskProvider(),
		isConnected,
		address,
		chainId,
	});
	const writeEnabled = walletState === "ready";

	const read = useReadContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "getNote",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: writeEnabled },
	});

	const saveSimulation = useSimulateContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "setNote",
		args: [draft],
		account: address,
		chainId: sepolia.id,
		query: {
			enabled: writeEnabled && draft.length > 0 && isNoteWithinLimit(draft),
		},
	});

	const clearSimulation = useSimulateContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "clearNote",
		account: address,
		chainId: sepolia.id,
		query: { enabled: writeEnabled },
	});

	const receipt = useWaitForTransactionReceipt({
		hash: transactionHash,
		chainId: sepolia.id,
		query: { enabled: Boolean(transactionHash) },
	});

	const readQueryKey = useMemo(
		() =>
			address
				? readContractQueryKey({
						address: notebookAddress,
						functionName: "getNote",
						args: [address],
						chainId: sepolia.id,
					})
				: undefined,
		[address],
	);

	useEffect(() => {
		if (
			read.isSuccess &&
			typeof read.data === "string" &&
			!draftDirtyRef.current
		) {
			setDraftState(read.data);
		}
	}, [read.data, read.isSuccess]);

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
			!readQueryKey ||
			confirmedHashRef.current === transactionHash
		) {
			return;
		}

		confirmedHashRef.current = transactionHash;
		void queryClient
			.invalidateQueries({ queryKey: readQueryKey })
			.then(() => {
				draftDirtyRef.current = false;
				pendingRef.current = false;
				setTransactionPhase("success");
				setTransactionMessage(
					operationRef.current === "clear"
						? "当前便签显示已清空；历史交易仍然公开。"
						: "笔记已保存到链上。",
				);
			})
			.catch(() => {
				pendingRef.current = false;
				setTransactionPhase("write-error");
				setTransactionMessage("交易已确认，但刷新链上笔记失败，请重试读取。");
			});
	}, [queryClient, readQueryKey, receipt.isSuccess, transactionHash]);

	const setDraft = useCallback((nextDraft: string) => {
		draftDirtyRef.current = true;
		setDraftState(nextDraft);
		setTransactionPhase(undefined);
		setTransactionMessage(undefined);
	}, []);

	const executeWrite = useCallback(
		async (
			operation: "save" | "clear",
			request: Parameters<typeof writeContractAsync>[0] | undefined,
		) => {
			if (
				pendingRef.current ||
				walletState !== "ready" ||
				chainId !== sepolia.id
			) {
				return;
			}
			if (!request) {
				setTransactionPhase("write-error");
				setTransactionMessage("交易尚未准备好，请稍后重试。");
				return;
			}

			pendingRef.current = true;
			operationRef.current = operation;
			confirmedHashRef.current = undefined;
			setTransactionHash(undefined);
			setTransactionPhase("awaiting-signature");
			setTransactionMessage("请在 MetaMask 中确认交易。");

			try {
				const hash = await writeContractAsync(request);
				setTransactionHash(hash);
				setTransactionPhase("confirming");
				setTransactionMessage("交易已广播，正在等待链上确认。");
			} catch (error) {
				pendingRef.current = false;
				setTransactionPhase("write-error");
				setTransactionMessage(toWalletMessage(error));
			}
		},
		[chainId, walletState, writeContractAsync],
	);

	const save = useCallback(() => {
		if (draft.length === 0 || !isNoteWithinLimit(draft))
			return Promise.resolve();
		return executeWrite("save", saveSimulation.data?.request);
	}, [draft, executeWrite, saveSimulation.data?.request]);

	const clear = useCallback(
		() => executeWrite("clear", clearSimulation.data?.request),
		[clearSimulation.data?.request, executeWrite],
	);

	const retryRead = useCallback(
		() => read.refetch().then(() => undefined),
		[read],
	);

	const switchToSepolia = useCallback(async () => {
		try {
			await switchChainAsync({ chainId: sepolia.id });
		} catch (error) {
			setTransactionPhase("write-error");
			setTransactionMessage(toWalletMessage(error));
		}
	}, [switchChainAsync]);

	const phase: NotebookPhase = transactionPhase
		? transactionPhase
		: read.isError
			? "read-error"
			: read.isPending && writeEnabled
				? "reading"
				: "idle";

	const message = transactionMessage
		? transactionMessage
		: read.isError
			? "读取链上笔记失败，请重试。"
			: walletState === "missing"
				? "未检测到 MetaMask。"
				: walletState === "disconnected"
					? "请连接 MetaMask。"
					: walletState === "wrong-network"
						? "请切换到 Sepolia 网络。"
						: undefined;

	const isPending = phase === "awaiting-signature" || phase === "confirming";

	return {
		walletState,
		chainNote: read.isSuccess ? read.data : undefined,
		draft,
		setDraft,
		save,
		clear,
		retryRead,
		switchToSepolia,
		transactionHash,
		phase,
		message,
		canSave:
			writeEnabled &&
			draft.length > 0 &&
			isNoteWithinLimit(draft) &&
			Boolean(saveSimulation.data?.request) &&
			!isPending,
		canClear:
			writeEnabled && Boolean(clearSimulation.data?.request) && !isPending,
	};
}
