import { describe, expect, it } from "vitest";

import { toWalletMessage } from "./walletError";

describe("wallet error messages", () => {
	it("explains that no wallet provider is available", () => {
		expect(toWalletMessage(undefined)).toBe(
			"未检测到钱包，请安装或解锁 MetaMask 后重试。",
		);
	});

	it("keeps the draft after a user rejects the wallet request", () => {
		expect(toWalletMessage({ code: 4001 })).toBe(
			"你取消了钱包操作，草稿仍然保留。",
		);
	});

	it("explains a failed chain switch", () => {
		expect(toWalletMessage({ code: 4902 })).toBe(
			"切换到 Sepolia 网络失败，请在钱包中确认后重试。",
		);
	});

	it("explains an RPC failure", () => {
		expect(toWalletMessage({ code: -32603 })).toBe(
			"网络请求失败，请检查网络后重试。",
		);
	});

	it("hides contract revert details", () => {
		expect(
			toWalletMessage({
				shortMessage:
					"The contract function setNote reverted: internal provider stack",
			}),
		).toBe("合约执行失败，请检查内容后重试。");
	});

	it("maps a repeated activity without exposing revert arguments", () => {
		expect(
			toWalletMessage({
				errorName: "ActivityAlreadyRecordedToday",
				shortMessage:
					"ActivityAlreadyRecordedToday(0xprivate-provider-details, 0, 20668)",
			}),
		).toBe("今天已经记录这项陪伴，北京时间明天 00:00 后再来。");
	});

	it.each([
		["InvalidTransferRecipient", "请输入有效的 Sepolia 收款钱包地址。"],
		["CannotTransferToSelf", "不能把成长星赠送给当前钱包。"],
		["InvalidTransferAmount", "赠送数量必须是大于 0 的整数。"],
		["InsufficientTransferableBalance", "可赠送成长星不足。"],
	])("maps %s without exposing transfer arguments", (errorName, message) => {
		expect(
			toWalletMessage({
				errorName,
				shortMessage: `${errorName}(private provider details)`,
			}),
		).toBe(message);
	});

	it("maps a viem custom error nested under cause.data", () => {
		expect(
			toWalletMessage({
				shortMessage: "outer provider wrapper",
				cause: {
					shortMessage: "contract reverted with private details",
					data: { errorName: "InsufficientTransferableBalance" },
				},
			}),
		).toBe("可赠送成长星不足。");
	});

	it("hides unknown provider details", () => {
		expect(
			toWalletMessage({
				shortMessage: "untrusted provider stack trace",
			}),
		).toBe("钱包操作失败，请稍后重试。");
	});
});
