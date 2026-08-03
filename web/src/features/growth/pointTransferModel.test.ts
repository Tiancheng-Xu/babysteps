import type { Address } from "viem";
import { describe, expect, it } from "vitest";

import { validatePointTransfer } from "./pointTransferModel";

const sender = "0x1111111111111111111111111111111111111111" as Address;
const recipient = "0x2222222222222222222222222222222222222222";
const zeroAddress = "0x0000000000000000000000000000000000000000";

describe("point transfer validation", () => {
	it("normalizes a valid recipient and parses an integer amount", () => {
		expect(
			validatePointTransfer({ sender, balance: 7n, recipient, amount: "5" }),
		).toEqual({ ok: true, recipient, amount: 5n });
	});

	it.each(["", "not-an-address", "0x1234"])(
		"rejects invalid recipient %j",
		(value) => {
			expect(
				validatePointTransfer({
					sender,
					balance: 7n,
					recipient: value,
					amount: "1",
				}),
			).toEqual({
				ok: false,
				message: "请输入有效的 Sepolia 收款钱包地址。",
			});
		},
	);

	it("rejects the sender address case-insensitively", () => {
		expect(
			validatePointTransfer({
				sender,
				balance: 7n,
				recipient: sender.toUpperCase().replace("0X", "0x"),
				amount: "1",
			}),
		).toEqual({
			ok: false,
			message: "不能把成长星赠送给当前钱包。",
		});
	});

	it("rejects the zero address before contract simulation", () => {
		expect(
			validatePointTransfer({
				sender,
				balance: 7n,
				recipient: zeroAddress,
				amount: "1",
			}),
		).toEqual({
			ok: false,
			message: "请输入有效的 Sepolia 收款钱包地址。",
		});
	});

	it.each(["", "0", "-1", "1.5", "1e2", " 1 "])(
		"rejects non-positive or non-integer amount %j",
		(amount) => {
			expect(
				validatePointTransfer({ sender, balance: 7n, recipient, amount }),
			).toEqual({
				ok: false,
				message: "赠送数量必须是大于 0 的整数。",
			});
		},
	);

	it("does not invent a zero balance while the chain read is unavailable", () => {
		expect(
			validatePointTransfer({
				sender,
				balance: undefined,
				recipient,
				amount: "1",
			}),
		).toEqual({ ok: false, message: "正在读取可赠送成长星。" });
	});

	it("rejects an amount above the transferable balance", () => {
		expect(
			validatePointTransfer({ sender, balance: 7n, recipient, amount: "8" }),
		).toEqual({ ok: false, message: "可赠送成长星不足。" });
	});
});
