import { simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Address, type Hash, keccak256, stringToBytes } from "viem";
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
	taskMarketplaceAbi,
	taskMarketplaceAddress,
} from "../../contracts/web3Contracts";
import { toWalletMessage } from "../../lib/walletError";
import { deriveWalletState, hasMetaMaskProvider } from "../wallet/walletState";

export type ProviderActivity = "meal" | "walk" | "read";
export type ProviderTaskPhase =
	| "unavailable"
	| "loading"
	| "ready"
	| "awaiting-signature"
	| "confirming"
	| "success"
	| "error";

const PROVIDER_ROLE = keccak256(stringToBytes("PROVIDER_ROLE"));
const ACTIVITY_VALUES: Record<ProviderActivity, number> = {
	meal: 0,
	walk: 1,
	read: 2,
};

function isValidMetadataUri(value: string) {
	const normalized = value.trim();
	return normalized.startsWith("ipfs://") || normalized.startsWith("https://");
}

export function useProviderTaskCreation(
	marketplaceContractAddress: Address | undefined = taskMarketplaceAddress,
) {
	const { address, chainId, isConnected } = useAccount();
	const { switchChainAsync } = useSwitchChain();
	const { writeContractAsync } = useWriteContract();
	const [activity, setActivity] = useState<ProviderActivity>("walk");
	const [metadataUri, setMetadataUri] = useState("");
	const [transactionHash, setTransactionHash] = useState<Hash>();
	const [transactionPhase, setTransactionPhase] =
		useState<
			Extract<
				ProviderTaskPhase,
				"awaiting-signature" | "confirming" | "success" | "error"
			>
		>();
	const [transactionMessage, setTransactionMessage] = useState<string>();
	const pendingRef = useRef(false);
	const confirmedHashRef = useRef<Hash | undefined>(undefined);

	const walletState = deriveWalletState({
		hasProvider: hasMetaMaskProvider(),
		isConnected,
		address,
		chainId,
	});
	const roleRead = useReadContract({
		address: marketplaceContractAddress,
		abi: taskMarketplaceAbi,
		functionName: "hasRole",
		args: address ? [PROVIDER_ROLE, address] : undefined,
		chainId: sepolia.id,
		query: {
			enabled: Boolean(marketplaceContractAddress) && walletState === "ready",
		},
	});
	const receipt = useWaitForTransactionReceipt({
		hash: transactionHash,
		chainId: sepolia.id,
		query: { enabled: Boolean(transactionHash) },
	});

	useEffect(() => {
		if (!receipt.isError || !transactionHash) return;
		pendingRef.current = false;
		setTransactionPhase("error");
		setTransactionMessage(toWalletMessage(receipt.error));
	}, [receipt.error, receipt.isError, transactionHash]);

	useEffect(() => {
		if (
			!receipt.isSuccess ||
			!transactionHash ||
			confirmedHashRef.current === transactionHash
		) {
			return;
		}
		confirmedHashRef.current = transactionHash;
		pendingRef.current = false;
		setMetadataUri("");
		setTransactionPhase("success");
		setTransactionMessage("任务创建已确认，正在等待 Chainlink VRF 激活。");
	}, [receipt.isSuccess, transactionHash]);

	const hasProviderRole = roleRead.data === true;
	let phase: ProviderTaskPhase = "unavailable";
	if (transactionPhase) phase = transactionPhase;
	else if (!marketplaceContractAddress || walletState !== "ready") {
		phase = "unavailable";
	} else if (roleRead.isError) phase = "error";
	else if (roleRead.isPending) phase = "loading";
	else if (hasProviderRole) phase = "ready";

	let message = transactionMessage;
	if (!message && marketplaceContractAddress && walletState === "ready") {
		if (roleRead.isError) message = "读取 Provider 权限失败，请稍后重试。";
		else if (!roleRead.isPending && !hasProviderRole) {
			message = "当前钱包没有 PROVIDER_ROLE。";
		}
	}

	const canSubmit =
		phase === "ready" &&
		hasProviderRole &&
		isValidMetadataUri(metadataUri) &&
		!pendingRef.current;

	const createTask = useCallback(async () => {
		if (
			!canSubmit ||
			pendingRef.current ||
			!address ||
			!marketplaceContractAddress
		) {
			return;
		}

		pendingRef.current = true;
		confirmedHashRef.current = undefined;
		setTransactionHash(undefined);
		setTransactionPhase("awaiting-signature");
		setTransactionMessage("请在钱包中确认创建成长任务。");
		try {
			const simulation = await simulateContract(wagmiConfig, {
				address: marketplaceContractAddress,
				abi: taskMarketplaceAbi,
				functionName: "createTask",
				args: [address, ACTIVITY_VALUES[activity], metadataUri.trim()],
				account: address,
				chainId: sepolia.id,
			});
			const hash = await writeContractAsync(simulation.request);
			setTransactionHash(hash);
			setTransactionPhase("confirming");
			setTransactionMessage("创建交易已广播，正在等待链上确认。");
		} catch (error) {
			pendingRef.current = false;
			setTransactionPhase("error");
			setTransactionMessage(toWalletMessage(error));
		}
	}, [
		activity,
		address,
		canSubmit,
		marketplaceContractAddress,
		metadataUri,
		writeContractAsync,
	]);

	const switchToSepolia = useCallback(async () => {
		try {
			await switchChainAsync({ chainId: sepolia.id });
		} catch (error) {
			setTransactionPhase("error");
			setTransactionMessage(toWalletMessage(error));
		}
	}, [switchChainAsync]);

	return {
		isConfigured: Boolean(marketplaceContractAddress),
		walletState,
		activity,
		setActivity,
		metadataUri,
		setMetadataUri,
		hasProviderRole,
		phase,
		message,
		canSubmit,
		isPending: phase === "awaiting-signature" || phase === "confirming",
		transactionHash,
		createTask,
		switchToSepolia,
	};
}
