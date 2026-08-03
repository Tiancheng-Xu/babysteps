import { useQueryClient } from "@tanstack/react-query";
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
import { readContractQueryKey } from "wagmi/query";

import { wagmiConfig } from "../../config/wagmi";
import {
	notebookAddress,
	onchainNotebookAbi,
} from "../../contracts/onchainNotebook";
import { toWalletMessage } from "../../lib/walletError";
import { deriveWalletState, hasMetaMaskProvider } from "../wallet/walletState";
import { validatePointTransfer } from "./pointTransferModel";

export type PointTransferPhase =
	| "idle"
	| "reading"
	| "read-error"
	| "awaiting-signature"
	| "confirming"
	| "success"
	| "write-error";

type TransactionPhase = Exclude<
	PointTransferPhase,
	"idle" | "reading" | "read-error"
>;

type SubmittedTransfer = {
	sender: Address;
	recipient: Address;
	amount: bigint;
};

function isUserRejected(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === 4001
	);
}

function shortAddress(address: Address) {
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function usePointTransfer() {
	const queryClient = useQueryClient();
	const { address, chainId, isConnected } = useAccount();
	const { switchChainAsync } = useSwitchChain();
	const { writeContractAsync } = useWriteContract();
	const [recipient, setRecipient] = useState("");
	const [amount, setAmount] = useState("");
	const [transactionHash, setTransactionHash] = useState<Hash>();
	const [transactionPhase, setTransactionPhase] = useState<TransactionPhase>();
	const [transactionMessage, setTransactionMessage] = useState<string>();
	const pendingRef = useRef(false);
	const confirmedHashRef = useRef<Hash | undefined>(undefined);
	const submittedRef = useRef<SubmittedTransfer | undefined>(undefined);

	const walletState = deriveWalletState({
		hasProvider: hasMetaMaskProvider(),
		isConnected,
		address,
		chainId,
	});
	const readEnabled = walletState === "ready";
	const balanceRead = useReadContract({
		address: notebookAddress,
		abi: onchainNotebookAbi,
		functionName: "getTransferableBalance",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readEnabled },
	});
	const balance =
		readEnabled && balanceRead.isSuccess && typeof balanceRead.data === "bigint"
			? balanceRead.data
			: undefined;

	const validation = useMemo(
		() =>
			validatePointTransfer({ sender: address, balance, recipient, amount }),
		[address, amount, balance, recipient],
	);

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
			receipt.data?.status !== "reverted" ||
			!transactionHash
		) {
			return;
		}
		confirmedHashRef.current = transactionHash;
		pendingRef.current = false;
		setTransactionPhase("write-error");
		setTransactionMessage("交易已上链但执行失败，成长星没有转移。");
	}, [receipt.data?.status, receipt.isSuccess, transactionHash]);

	useEffect(() => {
		const submitted = submittedRef.current;
		if (
			!receipt.isSuccess ||
			receipt.data?.status !== "success" ||
			!transactionHash ||
			!submitted ||
			confirmedHashRef.current === transactionHash
		) {
			return;
		}

		confirmedHashRef.current = transactionHash;
		const queryKeys = [submitted.sender, submitted.recipient].map((account) =>
			readContractQueryKey({
				address: notebookAddress,
				functionName: "getTransferableBalance",
				args: [account],
				chainId: sepolia.id,
			}),
		);
		void Promise.all(
			queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
		)
			.then(() => {
				pendingRef.current = false;
				setAmount("");
				setTransactionPhase("success");
				setTransactionMessage(
					`已向 ${shortAddress(submitted.recipient)} 赠送 ${submitted.amount} 枚成长星。`,
				);
			})
			.catch(() => {
				pendingRef.current = false;
				setTransactionPhase("write-error");
				setTransactionMessage("交易已确认，但刷新可赠送余额失败，请重试读取。");
			});
	}, [queryClient, receipt.data?.status, receipt.isSuccess, transactionHash]);

	const transfer = useCallback(async () => {
		if (pendingRef.current || walletState !== "ready" || !address) return;
		if (!validation.ok) {
			setTransactionPhase("write-error");
			setTransactionMessage(validation.message);
			return;
		}

		pendingRef.current = true;
		confirmedHashRef.current = undefined;
		submittedRef.current = {
			sender: address,
			recipient: validation.recipient,
			amount: validation.amount,
		};
		setTransactionHash(undefined);
		setTransactionPhase("awaiting-signature");
		setTransactionMessage("请在 MetaMask 中核对地址和数量后确认赠送。");

		try {
			const simulation = await simulateContract(wagmiConfig, {
				address: notebookAddress,
				abi: onchainNotebookAbi,
				functionName: "transferGrowthPoints",
				args: [validation.recipient, validation.amount],
				account: address,
				chainId: sepolia.id,
			});
			const hash = await writeContractAsync(simulation.request);
			setTransactionHash(hash);
			setTransactionPhase("confirming");
			setTransactionMessage("交易已广播，正在等待 Sepolia 确认。");
		} catch (error) {
			pendingRef.current = false;
			setTransactionPhase("write-error");
			setTransactionMessage(
				isUserRejected(error)
					? "已取消，本次没有转移成长星。"
					: toWalletMessage(error),
			);
		}
	}, [address, validation, walletState, writeContractAsync]);

	const retryRead = useCallback(
		() => balanceRead.refetch().then(() => undefined),
		[balanceRead.refetch],
	);

	const switchToSepolia = useCallback(async () => {
		try {
			await switchChainAsync({ chainId: sepolia.id });
		} catch (error) {
			setTransactionPhase("write-error");
			setTransactionMessage(toWalletMessage(error));
		}
	}, [switchChainAsync]);

	const phase: PointTransferPhase = transactionPhase
		? transactionPhase
		: readEnabled && balanceRead.isError
			? "read-error"
			: readEnabled && balanceRead.isPending
				? "reading"
				: "idle";
	const message = transactionMessage
		? transactionMessage
		: readEnabled && balanceRead.isError
			? "读取可赠送成长星失败，请重试。"
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
		balance,
		recipient,
		setRecipient,
		amount,
		setAmount,
		validationMessage: validation.ok ? undefined : validation.message,
		canTransfer: walletState === "ready" && validation.ok && !isPending,
		phase,
		message,
		transactionHash,
		transfer,
		retryRead,
		switchToSepolia,
		isPending,
	};
}
