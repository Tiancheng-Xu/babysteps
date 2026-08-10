import { getAddress, isAddress } from "viem";

export type TaskKey = `${number}:0x${string}:${bigint}`;

export type ParsedTaskKey = {
	chainId: number;
	marketplaceAddress: `0x${string}`;
	taskId: bigint;
};

function invalidIdentity(): never {
	throw new Error("TASK_IDENTITY_INVALID");
}

export function buildTaskKey(
	chainId: number,
	marketplaceAddress: `0x${string}`,
	taskId: bigint,
): TaskKey {
	if (!Number.isSafeInteger(chainId) || chainId <= 0 || taskId <= 0n) {
		return invalidIdentity();
	}
	const candidate = marketplaceAddress.startsWith("0X")
		? `0x${marketplaceAddress.slice(2)}`
		: marketplaceAddress;
	if (!isAddress(candidate, { strict: false })) {
		return invalidIdentity();
	}
	const normalizedAddress = getAddress(
		candidate,
	).toLowerCase() as `0x${string}`;

	return `${chainId}:${normalizedAddress}:${taskId}`;
}

export function parseTaskKey(key: string): ParsedTaskKey {
	const parts = key.split(":");
	if (
		parts.length !== 3 ||
		!/^\d+$/u.test(parts[0]) ||
		!/^\d+$/u.test(parts[2])
	) {
		return invalidIdentity();
	}
	const chainId = Number(parts[0]);
	const taskId = BigInt(parts[2]);
	const normalized = buildTaskKey(chainId, parts[1] as `0x${string}`, taskId);
	if (normalized !== key.toLowerCase()) {
		return invalidIdentity();
	}

	return { chainId, marketplaceAddress: parts[1] as `0x${string}`, taskId };
}
