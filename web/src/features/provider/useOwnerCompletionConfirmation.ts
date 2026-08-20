import { simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Address, type Hash, keccak256, stringToBytes } from "viem";
import {
	useAccount,
	useReadContract,
	useWaitForTransactionReceipt,
	useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { wagmiConfig } from "../../config/wagmi";
import {
	taskMarketplaceV2Abi,
	taskMarketplaceV2Address,
} from "../../contracts/web3Contracts";
import { toWalletMessage } from "../../lib/walletError";

const COMPLETION_RELAYER_ROLE = keccak256(
	stringToBytes("COMPLETION_RELAYER_ROLE"),
);

export type CompletionConfirmationInput = {
	purchaseId: string;
	evidenceHash: `0x${string}`;
	certificateUri: string;
};

export function useOwnerCompletionConfirmation(
	input: CompletionConfirmationInput,
	marketplaceAddress: Address | undefined = taskMarketplaceV2Address,
) {
	const { address, chainId, isConnected } = useAccount();
	const { writeContractAsync } = useWriteContract();
	const [transactionHash, setTransactionHash] = useState<Hash>();
	const [phase, setPhase] = useState<
		| "ready"
		| "unavailable"
		| "awaiting-signature"
		| "confirming"
		| "success"
		| "error"
	>("unavailable");
	const [message, setMessage] = useState<string>();
	const pendingRef = useRef(false);
	const confirmedRef = useRef<Hash | undefined>(undefined);

	const roleRead = useReadContract({
		address: marketplaceAddress,
		abi: taskMarketplaceV2Abi,
		functionName: "hasRole",
		args: address ? [COMPLETION_RELAYER_ROLE, address] : undefined,
		chainId: sepolia.id,
		query: { enabled: Boolean(marketplaceAddress && address && isConnected) },
	});
	const receipt = useWaitForTransactionReceipt({
		hash: transactionHash,
		chainId: sepolia.id,
		query: { enabled: Boolean(transactionHash) },
	});
	const hasCompletionRole = roleRead.data === true;
	const canConfirm =
		Boolean(marketplaceAddress) &&
		isConnected &&
		chainId === sepolia.id &&
		hasCompletionRole &&
		/^[1-9]\d*$/u.test(input.purchaseId) &&
		!pendingRef.current;

	useEffect(() => {
		if (pendingRef.current || transactionHash) return;
		if (canConfirm) {
			setPhase("ready");
			setMessage(undefined);
		} else {
			setPhase("unavailable");
			if (isConnected && roleRead.data === false) {
				setMessage(
					"当前钱包没有 COMPLETION_RELAYER_ROLE，暂不能确认任务完成。",
				);
			}
		}
	}, [canConfirm, isConnected, roleRead.data, transactionHash]);

	useEffect(() => {
		if (!receipt.isError || !transactionHash) return;
		pendingRef.current = false;
		setPhase("error");
		setMessage(toWalletMessage(receipt.error));
	}, [receipt.error, receipt.isError, transactionHash]);

	useEffect(() => {
		if (
			!receipt.isSuccess ||
			!transactionHash ||
			confirmedRef.current === transactionHash
		) {
			return;
		}
		confirmedRef.current = transactionHash;
		pendingRef.current = false;
		setPhase("success");
		setMessage("任务完成确认已上链，成长证书已按 purchaseId 幂等铸造。");
	}, [receipt.isSuccess, transactionHash]);

	const confirm = useCallback(async () => {
		if (!canConfirm || !address || !marketplaceAddress || pendingRef.current) {
			return;
		}
		pendingRef.current = true;
		confirmedRef.current = undefined;
		setPhase("awaiting-signature");
		setMessage("请在授权钱包确认任务完成交易。");
		try {
			const simulation = await simulateContract(wagmiConfig, {
				address: marketplaceAddress,
				abi: taskMarketplaceV2Abi,
				functionName: "confirmCompletion",
				args: [
					BigInt(input.purchaseId),
					input.evidenceHash,
					input.certificateUri,
				],
				account: address,
				chainId: sepolia.id,
			});
			const hash = await writeContractAsync(simulation.request);
			setTransactionHash(hash);
			setPhase("confirming");
			setMessage("交易已广播，正在等待 Sepolia 确认。");
		} catch (error) {
			pendingRef.current = false;
			setPhase("error");
			setMessage(toWalletMessage(error));
		}
	}, [address, canConfirm, input, marketplaceAddress, writeContractAsync]);

	return {
		hasCompletionRole,
		canConfirm,
		confirm,
		transactionHash,
		phase,
		message,
		isPending: phase === "awaiting-signature" || phase === "confirming",
	};
}
