import { type Address, getAddress, isAddress } from "viem";

export type PointTransferValidation =
	| { ok: true; recipient: Address; amount: bigint }
	| { ok: false; message: string };

type PointTransferInput = {
	sender?: Address;
	balance?: bigint;
	recipient: string;
	amount: string;
};

export function validatePointTransfer({
	sender,
	balance,
	recipient,
	amount,
}: PointTransferInput): PointTransferValidation {
	if (!isAddress(recipient)) {
		return {
			ok: false,
			message: "请输入有效的 Sepolia 收款钱包地址。",
		};
	}

	const normalizedRecipient = getAddress(recipient);
	if (
		sender !== undefined &&
		normalizedRecipient.toLowerCase() === sender.toLowerCase()
	) {
		return { ok: false, message: "不能把成长星赠送给当前钱包。" };
	}

	if (!/^[0-9]+$/.test(amount)) {
		return { ok: false, message: "赠送数量必须是大于 0 的整数。" };
	}
	const parsedAmount = BigInt(amount);
	if (parsedAmount === 0n) {
		return { ok: false, message: "赠送数量必须是大于 0 的整数。" };
	}
	if (balance === undefined) {
		return { ok: false, message: "正在读取可赠送成长星。" };
	}
	if (parsedAmount > balance) {
		return { ok: false, message: "可赠送成长星不足。" };
	}

	return { ok: true, recipient: normalizedRecipient, amount: parsedAmount };
}
