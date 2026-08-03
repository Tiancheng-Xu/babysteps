type WalletError = {
	code?: unknown;
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

	const shortMessage = walletError?.shortMessage;
	if (
		typeof shortMessage === "string" &&
		shortMessage.toLowerCase().includes("reverted")
	) {
		return "合约执行失败，请检查内容后重试。";
	}

	return "钱包操作失败，请稍后重试。";
}
