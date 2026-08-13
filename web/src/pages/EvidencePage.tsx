import businessSequenceImage from "../../../docs/architecture/starbuddy-web3-business-sequence.svg";
import globalArchitectureImage from "../../../docs/architecture/starbuddy-web3-global-architecture.svg";
import keepsakeDesktopImage from "../../../docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/keepsake-gallery-desktop.png";
import keepsakeMobileImage from "../../../docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/keepsake-gallery-mobile-390.png";

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
	[
		"StarBuddyKeepsakes + KeepsakeSBT",
		"固定 12 成长星抽卡、三卡融合、24 小时恢复；本地已验证，Sepolia 待部署",
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
						<span className="evidence-diagram-card__status">
							六列 × 四带 × 七条编号流
						</span>
					</header>
					<figure className="architecture-figure">
						<div className="evidence-diagram-frame">
							<img
								src={globalArchitectureImage}
								alt="BabySteps 全局架构图"
								width="2400"
								height="1800"
								loading="lazy"
								decoding="async"
							/>
						</div>
						<figcaption>
							六列责任边界 × 四条数据带 ×
							七条编号流，把用户、Web、Cloudflare、Sepolia、外部 Web3
							服务和交付平台放进同一张可跨层追踪的工程真相图。
						</figcaption>
					</figure>
					<div className="evidence-diagram-walkthrough">
						<p>
							<strong>看哪里</strong>
							先按六列责任边界找系统负责人，再到图底部选择 01–07
							编号流跨层追踪载荷、交易、事件和核验结果；重点看兑换的
							{" Router / Pool "}与购买后的 Provider 结算。
						</p>
						<p>
							<strong>证明什么</strong>
							HTTPS、签名交易、JSON-RPC、GraphQL、事件与 OIDC
							各有真实方向；Quote → Approve → Router → Pool → BABY、精确授权 →
							buy → transferFrom → Provider payee 以及失败回滚都能沿线复核。
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
						<span className="evidence-diagram-card__status">六段完整闭环</span>
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
							从登录与会话、<span>Uniswap 获币</span>
							、上架与审核、购买与结算、成长任务完成与证书，到纪念卡抽取与融合，形成六段可追踪业务闭环。
						</figcaption>
					</figure>
					<div className="evidence-diagram-walkthrough">
						<p>
							<strong>看哪里</strong>
							从上到下阅读六段完整闭环；第 05
							段是家长/孩子完成成长任务后的证书，第 06
							段才是可转送成长星抽卡与三卡融合，两者不是同一件事。
						</p>
						<p>
							<strong>证明什么</strong>
							登录签名、Uniswap swap、任务 VRF、精确 approve → buy →
							transferFrom、完成 Relayer、纪念卡 VRF 与两类 SBT
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

			<section
				className="evidence-feature-proof"
				aria-labelledby="keepsake-proof-title"
			>
				<header className="evidence-feature-proof__header">
					<div>
						<p className="section-kicker">FEATURE PROOF · LOCAL VERIFIED</p>
						<h2 id="keepsake-proof-title">StarBuddy 纪念卡抽取与融合</h2>
					</div>
					<span className="evidence-diagram-card__status">Sepolia 待部署</span>
				</header>
				<p className="evidence-feature-proof__lead">
					可转送成长星是唯一消费额度：每次抽卡固定扣 12
					星，随机决定四阶段形象与稀有度；三张同系列、同稀有度卡可融合，失败只随机烧毁一张并解锁另外两张，不再收费。
				</p>
				<div className="evidence-proof-gallery">
					<figure>
						<img
							src={keepsakeDesktopImage}
							alt="StarBuddy 纪念馆桌面端本地验证"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里：</strong>
							固定费用、概率、四阶段卡面、融合入口与真实未配置提示。
							<br />
							<strong>证明什么：</strong>桌面端布局和业务状态已实现；没有伪造
							Sepolia 卡片。
						</figcaption>
					</figure>
					<figure>
						<img
							src={keepsakeMobileImage}
							alt="StarBuddy 纪念馆 390 像素移动端本地验证"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里：</strong>390px
							下操作区、概率和卡片单列，触控按钮不小于 44px。
							<br />
							<strong>证明什么：</strong>手机端无根级横向溢出，信息仍可读。
						</figcaption>
					</figure>
				</div>
				<div className="evidence-diagram-walkthrough">
					<p>
						<strong>抽卡链路</strong>spendTransferable(12) → Chainlink VRF v2.5
						→ 70/22/7/1 稀有度与独立阶段随机 → KeepsakeSBT 铸造。
					</p>
					<p>
						<strong>融合与恢复</strong>锁定 3 张相同卡 → VRF 判定 100/70/40%
						成功率；24 小时未回调可恢复，迟到回调被忽略。
					</p>
				</div>
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
						<span>全仓测试、类型检查、生产构建、Evidence 契约与响应式验证</span>
					</div>
					<div className="verification-summary">
						<strong>纪念卡真实状态</strong>
						<span>
							合约与前端本地已验证；新合约地址、VRF consumer 与真实交易仍待
							Sepolia 部署
						</span>
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
