type WalletError = {
	code?: unknown;
	errorName?: unknown;
	shortMessage?: unknown;
};

function getWalletError(error: unknown): WalletError | undefined {
	return typeof error === "object" && error !== null
		? (error as WalletError)
		: undefined;
}

export function toWalletMessage(error: unknown) {
	if (error === undefined) {
		return "未检测到钱包，请安装或解锁 MetaMask 后重试。";
	}

	const walletError = getWalletError(error);
	if (walletError?.code === 4001) {
		return "你取消了钱包操作，草稿仍然保留。";
	}
	if (walletError?.code === 4902) {
		return "切换到 Sepolia 网络失败，请在钱包中确认后重试。";
	}
	if (walletError?.code === -32603 || walletError?.code === -32000) {
		return "网络请求失败，请检查网络后重试。";
	}
	if (walletError?.errorName === "ActivityAlreadyRecordedToday") {
		return "今天已经记录这项陪伴，北京时间明天 00:00 后再来。";
	}
	if (walletError?.errorName === "InvalidTransferRecipient") {
		return "请输入有效的 Sepolia 收款钱包地址。";
	}
	if (walletError?.errorName === "CannotTransferToSelf") {
		return "不能把成长星赠送给当前钱包。";
	}
	if (walletError?.errorName === "InvalidTransferAmount") {
		return "赠送数量必须是大于 0 的整数。";
	}
	if (walletError?.errorName === "InsufficientTransferableBalance") {
		return "可赠送成长星不足。";
	}

	const shortMessage = walletError?.shortMessage;
	if (
		typeof shortMessage === "string" &&
		shortMessage.toLowerCase().includes("reverted")
	) {
		return "合约执行失败，请检查内容后重试。";
	}

	return "钱包操作失败，请稍后重试。";
}
