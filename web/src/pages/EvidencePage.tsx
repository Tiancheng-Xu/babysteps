import architectureImage from "../../../docs/architecture/starbuddy-web3-architecture-v2.png";

const CONTRACTS = [
	["BabyCoin", "0x108a…5471b · ERC-20 余额与 lifetimeEarned 成长值分离"],
	[
		"TaskMarketplaceV2",
		"0x2EE9…15de · Provider 提交、Owner 审核、VRF、购买与完成",
	],
	[
		"GrowthCertificateSBT",
		"0xF4ef…F654 · 每笔完成购买一张不可转让 ERC-5192 证书",
	],
] as const;

export function EvidencePage() {
	return (
		<section className="product-page" aria-labelledby="evidence-heading">
			<header className="product-page__hero product-page__hero--evidence">
				<div>
					<p className="product-page__eyebrow">可复核工程记录</p>
					<h1 id="evidence-heading">链上工作证据</h1>
					<p>
						用架构图、自动测试、部署记录和区块浏览器链接展示每一层如何协作。
					</p>
				</div>
				<span className="evidence-status">Sepolia V2 闭环已验证</span>
			</header>

			<div className="evidence-grid">
				<figure className="architecture-figure">
					<img src={architectureImage} alt="StarBuddy Web3 架构图" />
					<figcaption>
						StarBuddy
						四阶段串起身份、任务、购买与证书，底层由合约、VRF、索引和链下服务协作。
					</figcaption>
				</figure>

				<section
					className="contract-evidence"
					aria-labelledby="contract-evidence-heading"
				>
					<h2 id="contract-evidence-heading">合约职责清单</h2>
					<ul>
						{CONTRACTS.map(([name, responsibility]) => (
							<li key={name}>
								<strong>{name}</strong>
								<span>{responsibility}</span>
							</li>
						))}
					</ul>
					<div className="verification-summary">
						<strong>链上闭环</strong>
						<span>任务 #1 · 随机 2 BABY / 5 小时 · 购买 #1 · 锁定 SBT #1</span>
					</div>
					<div className="verification-summary">
						<strong>链下 API</strong>
						<span>
							任务 #2 · 公开 API + D1 绑定 · 购买 #2 · 用户名与评论读回
						</span>
					</div>
					<div className="verification-summary">
						<strong>Uniswap v3</strong>
						<span>BABY/USDC + BABY/WETH 两池 · 两次真实 swap 已验证</span>
					</div>
					<a
						href="https://babysteps-api.baby2b.online/api/health"
						target="_blank"
						rel="noreferrer"
					>
						验证 Worker 健康状态
					</a>
					<div className="verification-summary">
						<strong>自动门禁</strong>
						<span>合约 82 · 前端 157 · Worker 48 · Subgraph 4 项测试</span>
					</div>
					<div className="verification-summary">
						<strong>外部读链与索引</strong>
						<span>
							The Graph 100% 同步 · Public / Infura / Alchemy 三源一致
						</span>
					</div>
					<div className="verification-summary">
						<strong>仍待外部闭环</strong>
						<span>Privy 登录 UI 与可选 IPFS pin</span>
					</div>
				</section>
			</div>
		</section>
	);
}
