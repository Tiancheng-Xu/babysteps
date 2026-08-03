import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";

import { hasMetaMaskProvider } from "../features/wallet/walletState";

function shortenAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function networkName(chainId?: number) {
	if (chainId === sepolia.id) return "Sepolia 测试网";
	if (chainId === 1) return "以太坊主网";
	if (chainId === undefined) return "未知网络";
	return `链 ID ${chainId}`;
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
			<section
				className="story-card wallet-panel"
				aria-labelledby="wallet-heading"
			>
				<div className="story-card__header">
					<div>
						<h2 id="wallet-heading">步骤 1 · 连接测试钱包</h2>
						<p className="story-card__lead">
							先确认正在使用的是专用 Sepolia 测试钱包，再继续后面的链上操作。
						</p>
					</div>
				</div>
				<div className="wallet-shell">
					<div className="wallet-summary">
						<span className="status-pill status-pill--warning">
							尚未安装 MetaMask
						</span>
						<p>
							未检测到 MetaMask。请先安装，再使用只用于课程演示的测试账户连接。
						</p>
					</div>
					<div className="wallet-support">
						<p className="wallet-support__title">连接前提醒</p>
						<p>
							页面只会读取公开地址，不会要求你提供助记词、私钥或真实身份资料。
						</p>
					</div>
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
			<section
				className="story-card wallet-panel"
				aria-labelledby="wallet-heading"
			>
				<div className="story-card__header">
					<div>
						<h2 id="wallet-heading">步骤 1 · 连接测试钱包</h2>
						<p className="story-card__lead">
							连接后会读取钱包地址、Sepolia 网络和课程所需的公开链上状态。
						</p>
					</div>
				</div>
				<div className="wallet-shell">
					<div className="wallet-summary">
						<span className="status-pill status-pill--neutral">
							尚未连接测试钱包
						</span>
						<p>连接只会读取公开地址，不会要求你提供助记词或私钥。</p>
					</div>
					<div className="wallet-support">
						<p className="wallet-support__title">连接后你会看到</p>
						<ul className="wallet-support__list">
							<li>当前测试账户地址</li>
							<li>是否已经切换到 Sepolia</li>
							<li>星宝成长、可赠送余额和公开便签</li>
						</ul>
					</div>
				</div>
				<button
					type="button"
					className="button button--web3"
					disabled={!metaMask || isPending}
					onClick={() =>
						metaMask ? connect({ connector: metaMask }) : undefined
					}
				>
					{isPending ? "正在连接测试钱包" : "连接 MetaMask"}
				</button>
			</section>
		);
	}

	const wrongNetwork = chainId !== sepolia.id;
	return (
		<section
			className="story-card wallet-panel"
			aria-labelledby="wallet-heading"
		>
			<div className="story-card__header">
				<div>
					<h2 id="wallet-heading">步骤 1 · 连接测试钱包</h2>
					<p className="story-card__lead">
						让不熟悉 Web3
						的照护者也能确认：当前连接的是哪个测试账户、在哪条测试链上。
					</p>
				</div>
			</div>
			<div className="wallet-shell">
				<div className="wallet-summary">
					<span
						className={
							wrongNetwork
								? "status-pill status-pill--danger"
								: "status-pill status-pill--success"
						}
					>
						{wrongNetwork ? "网络环境异常" : "Sepolia 已连接"}
					</span>
					<p className="wallet-address" title={address}>
						{shortenAddress(address)}
					</p>
					<p>
						{wrongNetwork
							? "当前钱包已连接，但还没有切换到课程要求的 Sepolia 测试网。"
							: "当前测试账户已经准备好，可以继续记录陪伴、赠送成长星和保存公开便签。"}
					</p>
				</div>
				<div className="wallet-support wallet-support--facts">
					<dl className="wallet-facts">
						<div>
							<dt>当前网络</dt>
							<dd>{networkName(chainId)}</dd>
						</div>
						<div>
							<dt>目标网络</dt>
							<dd>Sepolia 测试网</dd>
						</div>
						<div>
							<dt>当前地址</dt>
							<dd>{shortenAddress(address)}</dd>
						</div>
					</dl>
				</div>
			</div>
			<div className="button-row">
				{wrongNetwork ? (
					<button
						type="button"
						className="button button--web3"
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
