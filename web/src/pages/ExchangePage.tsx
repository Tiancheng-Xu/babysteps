import { useUniswapSwap } from "../features/exchange/useUniswapSwap";

export function ExchangePage() {
	const exchange = useUniswapSwap();
	return (
		<section className="product-page exchange-page">
			<header className="product-page__hero product-page__hero--exchange">
				<div>
					<p className="section-kicker">UNISWAP V3 · SEPOLIA</p>
					<h1>BabyCoin 兑换</h1>
					<p>使用官方 Sepolia USDC 或 WETH 买入 BABY；所有资产均无真实价值。</p>
				</div>
				<div className="provider-role-badge">0.3% fee · 1% slippage cap</div>
			</header>

			<div className="exchange-layout">
				<section
					className="identity-card"
					aria-labelledby="exchange-form-title"
				>
					<p className="section-kicker">QUOTE → APPROVE → SWAP</p>
					<h2 id="exchange-form-title">测试币兑换</h2>
					<label htmlFor="exchange-asset">支付资产</label>
					<select
						id="exchange-asset"
						value={exchange.asset}
						onChange={(event) =>
							exchange.setAsset(event.target.value as "USDC" | "ETH")
						}
					>
						<option value="USDC">官方 Sepolia USDC</option>
						<option value="ETH">测试 ETH（不足时先包装为 WETH）</option>
					</select>
					<label htmlFor="exchange-amount">输入数量</label>
					<input
						id="exchange-amount"
						inputMode="decimal"
						value={exchange.amount}
						onChange={(event) => exchange.setAmount(event.target.value)}
					/>
					<div className="exchange-quote">
						<span>预计获得</span>
						<strong>
							{exchange.quotedBaby ? `${exchange.quotedBaby} BABY` : "等待报价"}
						</strong>
					</div>
					<div className="button-row">
						<button
							className="button"
							type="button"
							onClick={exchange.quote}
							disabled={!exchange.canQuote || exchange.phase === "quoting"}
						>
							{exchange.phase === "quoting" ? "报价中…" : "读取链上报价"}
						</button>
						{exchange.walletState === "wrong-network" ? (
							<button
								className="button button--secondary"
								type="button"
								onClick={exchange.switchToSepolia}
							>
								切换 Sepolia
							</button>
						) : (
							<button
								className="button button--secondary"
								type="button"
								onClick={exchange.execute}
								disabled={!exchange.canExecute}
							>
								确认有限授权并兑换
							</button>
						)}
					</div>
					{exchange.message ? (
						<p className="identity-message" role="status">
							{exchange.message}
						</p>
					) : null}
					{exchange.transactionHash ? (
						<a
							href={`https://sepolia.etherscan.io/tx/${exchange.transactionHash}`}
							target="_blank"
							rel="noreferrer"
						>
							查看兑换交易
						</a>
					) : null}
				</section>

				<aside
					className="identity-card"
					aria-labelledby="exchange-boundary-title"
				>
					<p className="section-kicker">SAFETY BOUNDARY</p>
					<h2 id="exchange-boundary-title">为什么是 WETH</h2>
					<p>
						Uniswap v3 池只接受 ERC-20。ETH 路径先调用官方 WETH9 的
						deposit，再执行有限授权和兑换。
					</p>
					<ul className="marketplace-rule-grid">
						<li>不部署 MockUSDC</li>
						<li>不使用无限授权</li>
						<li>报价失败不发送交易</li>
						<li>1% 最小到账保护</li>
					</ul>
				</aside>
			</div>
		</section>
	);
}
