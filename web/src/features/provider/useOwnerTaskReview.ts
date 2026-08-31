import { simulateContract } from "@wagmi/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type Address,
	type Hash,
	keccak256,
	stringToBytes,
	zeroHash,
} from "viem";
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
import { createBusinessOperationLifecycle } from "../../performance/runtime";

export type OwnerReviewPhase =
	| "unavailable"
	| "loading"
	| "ready"
	| "awaiting-signature"
	| "confirming"
	| "success"
	| "error";

function parseTaskId(value: string): bigint | undefined {
	if (!/^[1-9]\d*$/u.test(value.trim())) return undefined;
	return BigInt(value.trim());
}

export function useOwnerTaskReview(
	marketplaceAddress: Address | undefined = taskMarketplaceV2Address,
) {
	const { address, chainId, isConnected } = useAccount();
	const { writeContractAsync } = useWriteContract();
	const [taskId, setTaskId] = useState("");
	const [rejectionReason, setRejectionReason] = useState("");
	const [transactionHash, setTransactionHash] = useState<Hash>();
	const [phase, setPhase] = useState<OwnerReviewPhase>("unavailable");
	const [message, setMessage] = useState<string>();
	const pendingRef = useRef(false);
	const confirmedHashRef = useRef<Hash | undefined>(undefined);
	const businessLifecycle = useMemo(createBusinessOperationLifecycle, []);

	const roleRead = useReadContract({
		address: marketplaceAddress,
		abi: taskMarketplaceV2Abi,
		functionName: "hasRole",
		args: address ? [zeroHash, address] : undefined,
		chainId: sepolia.id,
		query: {
			enabled: Boolean(marketplaceAddress && address && isConnected),
		},
	});
	const receipt = useWaitForTransactionReceipt({
		hash: transactionHash,
		chainId: sepolia.id,
		query: { enabled: Boolean(transactionHash) },
	});

	const isOwner = roleRead.data === true;
	const ready =
		Boolean(marketplaceAddress) &&
		isConnected &&
		chainId === sepolia.id &&
		isOwner;
	const parsedTaskId = parseTaskId(taskId);
	const canApprove = ready && parsedTaskId !== undefined && !pendingRef.current;
	const canReject =
		canApprove &&
		rejectionReason.trim().length >= 2 &&
		rejectionReason.length <= 200;

	useEffect(() => {
		if (pendingRef.current || transactionHash) return;
		if (!marketplaceAddress || !isConnected || chainId !== sepolia.id) {
			setPhase("unavailable");
		} else if (roleRead.isPending) setPhase("loading");
		else if (roleRead.isError) {
			setPhase("error");
			setMessage("读取 Owner 权限失败，请稍后重试。");
		} else if (!isOwner) {
			setPhase("unavailable");
			setMessage("当前钱包不是合约 Owner。");
		} else setPhase("ready");
	}, [
		chainId,
		isConnected,
		isOwner,
		marketplaceAddress,
		roleRead.isError,
		roleRead.isPending,
		transactionHash,
	]);

	useEffect(() => {
		if (receipt.isError && transactionHash) {
			pendingRef.current = false;
			businessLifecycle.fail();
			setPhase("error");
			setMessage(toWalletMessage(receipt.error));
		}
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
		pendingRef.current = false;
		businessLifecycle.succeed();
		setPhase("success");
		setMessage("审核交易已确认，请等待链上状态刷新。");
	}, [businessLifecycle, receipt.isSuccess, transactionHash]);

	const submit = useCallback(
		async (action: "approve" | "reject") => {
			const currentTaskId = parseTaskId(taskId);
			if (
				!ready ||
				!currentTaskId ||
				!address ||
				!marketplaceAddress ||
				pendingRef.current
			) {
				return;
			}
			const normalizedReason = rejectionReason.trim();
			if (
				action === "reject" &&
				(normalizedReason.length < 2 || normalizedReason.length > 200)
			) {
				return;
			}

			pendingRef.current = true;
			businessLifecycle.start(
				action === "approve"
					? "business.owner.approve"
					: "business.owner.reject",
			);
			confirmedHashRef.current = undefined;
			setPhase("awaiting-signature");
			setMessage("请在 Owner 钱包确认审核交易。");
			try {
				const simulation = await simulateContract(wagmiConfig, {
					address: marketplaceAddress,
					abi: taskMarketplaceV2Abi,
					functionName: action === "approve" ? "approveTask" : "rejectTask",
					args:
						action === "approve"
							? [currentTaskId]
							: [currentTaskId, keccak256(stringToBytes(normalizedReason))],
					account: address,
					chainId: sepolia.id,
				});
				const hash = await writeContractAsync(simulation.request);
				setTransactionHash(hash);
				setPhase("confirming");
				setMessage("审核交易已广播，正在等待链上确认。");
			} catch (error) {
				pendingRef.current = false;
				businessLifecycle.fail();
				setPhase("error");
				setMessage(toWalletMessage(error));
			}
		},
		[
			address,
			businessLifecycle,
			marketplaceAddress,
			ready,
			rejectionReason,
			taskId,
			writeContractAsync,
		],
	);

	return {
		taskId,
		setTaskId,
		rejectionReason,
		setRejectionReason,
		isOwner,
		phase,
		message,
		transactionHash,
		canApprove,
		canReject,
		isPending: phase === "awaiting-signature" || phase === "confirming",
		approve: () => submit("approve"),
		reject: () => submit("reject"),
	};
}
