import { simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useRef, useState } from "react";
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
	taskMarketplaceV2Abi,
	taskMarketplaceV2Address,
} from "../../contracts/web3Contracts";
import { toWalletMessage } from "../../lib/walletError";
import { deriveWalletState, hasMetaMaskProvider } from "../wallet/walletState";
import type { MarketplaceTask } from "./marketplaceModel";

export type TaskPurchasePhase =
	| "unavailable"
	| "loading"
	| "read-error"
	| "ready-to-approve"
	| "awaiting-approval-signature"
	| "confirming-approval"
	| "ready-to-buy"
	| "awaiting-purchase-signature"
	| "confirming-purchase"
	| "purchased"
	| "success"
	| "write-error";

type TransactionPhase = Extract<
	TaskPurchasePhase,
	| "awaiting-approval-signature"
	| "confirming-approval"
	| "ready-to-buy"
	| "awaiting-purchase-signature"
	| "confirming-purchase"
	| "success"
	| "write-error"
>;

export function useTaskPurchase(
	task: MarketplaceTask,
	babyCoinContractAddress: Address | undefined = babyCoinAddress,
	marketplaceContractAddress: Address | undefined = taskMarketplaceV2Address,
) {
	const { address, chainId, isConnected } = useAccount();
	const { switchChainAsync } = useSwitchChain();
	const { writeContractAsync } = useWriteContract();
	const [approvalHash, setApprovalHash] = useState<Hash>();
	const [purchaseHash, setPurchaseHash] = useState<Hash>();
	const [transactionPhase, setTransactionPhase] = useState<TransactionPhase>();
	const [message, setMessage] = useState<string>();
	const pendingRef = useRef(false);
	const confirmedApprovalRef = useRef<Hash | undefined>(undefined);
	const confirmedPurchaseRef = useRef<Hash | undefined>(undefined);

	const walletState = deriveWalletState({
		hasProvider: hasMetaMaskProvider(),
		isConnected,
		address,
		chainId,
	});
	const contractsConfigured = Boolean(
		babyCoinContractAddress && marketplaceContractAddress,
	);
	const readsEnabled = contractsConfigured && walletState === "ready";

	const balanceRead = useReadContract({
		address: babyCoinContractAddress,
		abi: babyCoinAbi,
		functionName: "balanceOf",
		args: address ? [address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled },
	});
	const allowanceRead = useReadContract({
		address: babyCoinContractAddress,
		abi: babyCoinAbi,
		functionName: "allowance",
		args:
			address && marketplaceContractAddress
				? [address, marketplaceContractAddress]
				: undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled },
	});
	const purchasedRead = useReadContract({
		address: marketplaceContractAddress,
		abi: taskMarketplaceV2Abi,
		functionName: "purchaseIdForBuyer",
		args: address ? [task.id, address] : undefined,
		chainId: sepolia.id,
		query: { enabled: readsEnabled },
	});

	const approvalReceipt = useWaitForTransactionReceipt({
		hash: approvalHash,
		chainId: sepolia.id,
		query: { enabled: Boolean(approvalHash) },
	});
	const purchaseReceipt = useWaitForTransactionReceipt({
		hash: purchaseHash,
		chainId: sepolia.id,
		query: { enabled: Boolean(purchaseHash) },
	});

	useEffect(() => {
		if (!approvalReceipt.isError || !approvalHash) return;
		pendingRef.current = false;
		setTransactionPhase("write-error");
		setMessage(toWalletMessage(approvalReceipt.error));
	}, [approvalHash, approvalReceipt.error, approvalReceipt.isError]);

	useEffect(() => {
		if (
			!approvalReceipt.isSuccess ||
			!approvalHash ||
			confirmedApprovalRef.current === approvalHash
		) {
			return;
		}
		confirmedApprovalRef.current = approvalHash;
		void allowanceRead
			.refetch()
			.then(() => {
				pendingRef.current = false;
				setTransactionPhase("ready-to-buy");
				setMessage("授权已确认，现在可以购买。");
			})
			.catch(() => {
				pendingRef.current = false;
				setTransactionPhase("write-error");
				setMessage("授权已确认，但刷新额度失败，请重试读取。");
			});
	}, [allowanceRead, approvalHash, approvalReceipt.isSuccess]);

	useEffect(() => {
		if (!purchaseReceipt.isError || !purchaseHash) return;
		pendingRef.current = false;
		setTransactionPhase("write-error");
		setMessage(toWalletMessage(purchaseReceipt.error));
	}, [purchaseHash, purchaseReceipt.error, purchaseReceipt.isError]);

	useEffect(() => {
		if (
			!purchaseReceipt.isSuccess ||
			!purchaseHash ||
			confirmedPurchaseRef.current === purchaseHash
		) {
			return;
		}
		confirmedPurchaseRef.current = purchaseHash;
		void Promise.all([
			balanceRead.refetch(),
			allowanceRead.refetch(),
			purchasedRead.refetch(),
		])
			.then(() => {
				pendingRef.current = false;
				setTransactionPhase("success");
				setMessage("购买已确认，等待完成记录与成长证书。");
			})
			.catch(() => {
				pendingRef.current = false;
				setTransactionPhase("write-error");
				setMessage("购买已确认，但刷新链上记录失败，请重试读取。");
			});
	}, [
		allowanceRead,
		balanceRead,
		purchaseHash,
		purchaseReceipt.isSuccess,
		purchasedRead,
	]);

	const balance =
		typeof balanceRead.data === "bigint" ? balanceRead.data : undefined;
	const allowance =
		typeof allowanceRead.data === "bigint" ? allowanceRead.data : undefined;
	const hasPurchased =
		typeof purchasedRead.data === "bigint" && purchasedRead.data !== 0n;
	const readsPending =
		balanceRead.isPending || allowanceRead.isPending || purchasedRead.isPending;
	const readsFailed =
		balanceRead.isError || allowanceRead.isError || purchasedRead.isError;

	let phase: TaskPurchasePhase = "unavailable";
	if (transactionPhase) phase = transactionPhase;
	else if (!contractsConfigured || walletState !== "ready") {
		phase = "unavailable";
	} else if (readsFailed) phase = "read-error";
	else if (readsPending || allowance === undefined) phase = "loading";
	else if (hasPurchased) phase = "purchased";
	else if (task.state !== "active") phase = "unavailable";
	else if (allowance >= task.price) phase = "ready-to-buy";
	else phase = "ready-to-approve";

	const approve = useCallback(async () => {
		if (
			pendingRef.current ||
			phase !== "ready-to-approve" ||
			!address ||
			!babyCoinContractAddress ||
			!marketplaceContractAddress
		) {
			return;
		}

		pendingRef.current = true;
		confirmedApprovalRef.current = undefined;
		setApprovalHash(undefined);
		setTransactionPhase("awaiting-approval-signature");
		setMessage("请在钱包中确认精确 BABY 授权额度。");
		try {
			const simulation = await simulateContract(wagmiConfig, {
				address: babyCoinContractAddress,
				abi: babyCoinAbi,
				functionName: "approve",
				args: [marketplaceContractAddress, task.price],
				account: address,
				chainId: sepolia.id,
			});
			const hash = await writeContractAsync(simulation.request);
			setApprovalHash(hash);
			setTransactionPhase("confirming-approval");
			setMessage("授权交易已广播，正在等待链上确认。");
		} catch (error) {
			pendingRef.current = false;
			setTransactionPhase("write-error");
			setMessage(toWalletMessage(error));
		}
	}, [
		address,
		babyCoinContractAddress,
		marketplaceContractAddress,
		phase,
		task.price,
		writeContractAsync,
	]);

	const buy = useCallback(async () => {
		if (
			pendingRef.current ||
			phase !== "ready-to-buy" ||
			!address ||
			!marketplaceContractAddress
		) {
			return;
		}

		pendingRef.current = true;
		confirmedPurchaseRef.current = undefined;
		setPurchaseHash(undefined);
		setTransactionPhase("awaiting-purchase-signature");
		setMessage("请在钱包中确认购买交易。");
		try {
			const simulation = await simulateContract(wagmiConfig, {
				address: marketplaceContractAddress,
				abi: taskMarketplaceV2Abi,
				functionName: "buy",
				args: [task.id],
				account: address,
				chainId: sepolia.id,
			});
			const hash = await writeContractAsync(simulation.request);
			setPurchaseHash(hash);
			setTransactionPhase("confirming-purchase");
			setMessage("购买交易已广播，正在等待链上确认。");
		} catch (error) {
			pendingRef.current = false;
			setTransactionPhase("write-error");
			setMessage(toWalletMessage(error));
		}
	}, [address, marketplaceContractAddress, phase, task.id, writeContractAsync]);

	const switchToSepolia = useCallback(async () => {
		try {
			await switchChainAsync({ chainId: sepolia.id });
		} catch (error) {
			setTransactionPhase("write-error");
			setMessage(toWalletMessage(error));
		}
	}, [switchChainAsync]);

	return {
		walletState,
		phase,
		message,
		balance,
		allowance,
		hasPurchased,
		canApprove: phase === "ready-to-approve",
		canBuy: phase === "ready-to-buy",
		isPending:
			phase === "awaiting-approval-signature" ||
			phase === "confirming-approval" ||
			phase === "awaiting-purchase-signature" ||
			phase === "confirming-purchase",
		approvalHash,
		purchaseHash,
		approve,
		buy,
		switchToSepolia,
	};
}
