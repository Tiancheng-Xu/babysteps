import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";

import { hasMetaMaskProvider } from "../features/wallet/walletState";

function shortenAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletPanel() {
	const { address, chainId, isConnected } = useAccount();
	const { connect, connectors, isPending } = useConnect();
	const { disconnect } = useDisconnect();
	const { switchChainAsync } = useSwitchChain();
	const metaMask = connectors.find(
		(connector) =>
			connector.id.toLowerCase().includes("metamask") ||
			connector.name.toLowerCase().includes("metamask"),
	);

	if (!hasMetaMaskProvider()) {
		return (
			<section className="card wallet-panel" aria-labelledby="wallet-heading">
				<div>
					<p className="eyebrow">步骤 1</p>
					<h2 id="wallet-heading">连接专用测试钱包</h2>
					<p>未检测到 MetaMask。请安装后只使用 Sepolia 测试账户。</p>
				</div>
				<a
					className="button button--secondary"
					href="https://metamask.io/download/"
					target="_blank"
					rel="noreferrer"
				>
					安装 MetaMask
				</a>
			</section>
		);
	}

	if (!isConnected || !address) {
		return (
			<section className="card wallet-panel" aria-labelledby="wallet-heading">
				<div>
					<p className="eyebrow">步骤 1</p>
					<h2 id="wallet-heading">连接专用测试钱包</h2>
					<p>连接只会读取公开地址，不会要求你提供助记词或私钥。</p>
				</div>
				<button
					type="button"
					className="button button--primary"
					disabled={!metaMask || isPending}
					onClick={() =>
						metaMask ? connect({ connector: metaMask }) : undefined
					}
				>
					{isPending ? "等待钱包…" : "连接 MetaMask"}
				</button>
			</section>
		);
	}

	const wrongNetwork = chainId !== sepolia.id;
	return (
		<section className="card wallet-panel" aria-labelledby="wallet-heading">
			<div>
				<p className="eyebrow">步骤 1 · 已连接</p>
				<h2 id="wallet-heading">专用测试钱包</h2>
				<p className="wallet-address" title={address}>
					{shortenAddress(address)}
				</p>
				<p
					className={
						wrongNetwork
							? "network-badge network-badge--wrong"
							: "network-badge"
					}
				>
					{wrongNetwork ? "需要切换到 Sepolia" : "Sepolia · 11155111"}
				</p>
			</div>
			<div className="button-row">
				{wrongNetwork ? (
					<button
						type="button"
						className="button button--primary"
						onClick={() => void switchChainAsync({ chainId: sepolia.id })}
					>
						切换到 Sepolia
					</button>
				) : null}
				<button
					type="button"
					className="button button--ghost"
					onClick={() => disconnect()}
				>
					断开连接
				</button>
			</div>
		</section>
	);
}
