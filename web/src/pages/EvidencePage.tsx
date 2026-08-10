import architectureImage from "../../../docs/architecture/starbuddy-web3-architecture-v2.png";

const CONTRACTS = [
	["BabyCoin", "ERC-20 奖励与 lifetimeEarned 双账本"],
	["GrowthActivities", "3/5/7 BABY、随机冷却、UTC+8 日上限"],
	["TaskMarketplace", "Provider、VRF、购买与完成确认"],
	["GrowthCertificate", "每笔已完成购买一张 ERC-721"],
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
				<span className="evidence-status">本地验证完成 · Sepolia 待部署</span>
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
						<strong>本地门禁</strong>
						<span>合约、部署与前端自动测试持续通过</span>
					</div>
				</section>
			</div>
		</section>
	);
}
