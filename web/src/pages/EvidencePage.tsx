import businessSequenceImage from "../../../docs/architecture/starbuddy-web3-business-sequence.svg";
import globalArchitectureImage from "../../../docs/architecture/starbuddy-web3-global-architecture.svg";

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

			<section className="evidence-diagrams" aria-label="架构与关键业务流程">
				<article
					className="evidence-diagram-card"
					aria-labelledby="global-architecture-title"
				>
					<header className="evidence-diagram-card__header">
						<div>
							<p className="section-kicker">SYSTEM VIEW</p>
							<h2 id="global-architecture-title">全局架构图</h2>
						</div>
						<span className="evidence-diagram-card__status">六列 × 四带</span>
					</header>
					<figure className="architecture-figure">
						<div className="evidence-diagram-frame">
							<img
								src={globalArchitectureImage}
								alt="BabySteps 全局架构图"
								width="2400"
								height="1500"
								loading="lazy"
								decoding="async"
							/>
						</div>
						<figcaption>
							六列责任边界 × 四条数据带，把用户、Web、Cloudflare、Sepolia、外部
							Web3 服务和交付平台放进同一张工程真相图。
						</figcaption>
					</figure>
					<div className="evidence-diagram-walkthrough">
						<p>
							<strong>看哪里</strong>
							先按六列责任边界找系统负责人，再沿四条数据带追踪认证、内容、链上资产和交付；最后看箭头协议、失败回滚与状态图例。
						</p>
						<p>
							<strong>证明什么</strong>
							HTTPS、签名交易、JSON-RPC、GraphQL、事件与 OIDC
							各有真实方向；链上/链下事实、安全权限、费用清理和待验证边界没有被压成节点清单。
						</p>
					</div>
					<a
						className="evidence-diagram-link"
						href={globalArchitectureImage}
						target="_blank"
						rel="noreferrer"
					>
						查看全局架构原图
					</a>
				</article>

				<article
					className="evidence-diagram-card"
					aria-labelledby="business-sequence-title"
				>
					<header className="evidence-diagram-card__header">
						<div>
							<p className="section-kicker">END-TO-END FLOW</p>
							<h2 id="business-sequence-title">核心业务时序图</h2>
						</div>
						<span className="evidence-diagram-card__status">五段完整闭环</span>
					</header>
					<figure className="architecture-figure">
						<div className="evidence-diagram-frame">
							<img
								src={businessSequenceImage}
								alt="BabySteps 核心业务时序图"
								width="2400"
								height="1800"
								loading="lazy"
								decoding="async"
							/>
						</div>
						<figcaption>
							从登录与会话、Uniswap
							获币、上架与审核、购买与结算，到完课与证书，形成五段可追踪业务闭环。
						</figcaption>
					</figure>
					<div className="evidence-diagram-walkthrough">
						<p>
							<strong>看哪里</strong>
							从上到下阅读五段完整闭环；每段先看成功主线，再看同色失败分支如何停止、重试或降级读回。
						</p>
						<p>
							<strong>证明什么</strong>
							登录签名、Uniswap swap、VRF、精确 approve → buy →
							transferFrom、Relayer 与 SBT
							都有明确责任方；失败不会伪造会话、余额、购买或证书。
						</p>
					</div>
					<a
						className="evidence-diagram-link"
						href={businessSequenceImage}
						target="_blank"
						rel="noreferrer"
					>
						查看业务时序原图
					</a>
				</article>
			</section>

			<div className="evidence-grid evidence-grid--summary">
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
						<span>合约 82 · 前端 164 · Worker 48 · Subgraph 4 项测试</span>
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
