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

	it("hides unknown provider details", () => {
		expect(
			toWalletMessage({
				shortMessage: "untrusted provider stack trace",
			}),
		).toBe("钱包操作失败，请稍后重试。");
	});
});
