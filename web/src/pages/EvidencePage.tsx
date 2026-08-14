import performanceArchitectureImage from "../../../docs/architecture/starbuddy-performance-global-architecture.svg";
import performanceSequenceImage from "../../../docs/architecture/starbuddy-performance-pipeline-sequence.svg";
import businessSequenceImage from "../../../docs/architecture/starbuddy-web3-business-sequence.svg";
import globalArchitectureImage from "../../../docs/architecture/starbuddy-web3-global-architecture.svg";
import performanceDashboardDesktopImage from "../../../docs/evidence/screenshots/2026-08-13-performance/performance-dashboard-desktop-1920.png";
import performanceDashboardMobileImage from "../../../docs/evidence/screenshots/2026-08-13-performance/performance-dashboard-mobile-390.png";
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
				aria-labelledby="performance-proof-title"
			>
				<header className="evidence-feature-proof__header">
					<div>
						<p className="section-kicker">
							ASSIGNMENT 8 · OBSERVABILITY PIPELINE
						</p>
						<h2 id="performance-proof-title">性能观测架构图</h2>
					</div>
					<span className="evidence-diagram-card__status">AWS 云端待验证</span>
				</header>
				<p className="evidence-feature-proof__lead">
					浏览器 SDK → Worker → AWS 的链路把采集、异步入队、ECS
					清洗、共享数据库和真实统计拆成独立信任边界；本地代码、测试、SAM 与预算
					Gate 已通过，云端资源和清理证据必须由 Actions 实际运行后补齐。
				</p>
				<section
					className="evidence-identity"
					aria-labelledby="performance-identity-title"
				>
					<header>
						<p className="section-kicker">AWS IDENTITY FOUNDATION · VERIFIED</p>
						<h3 id="performance-identity-title">
							OIDC 身份底座与最小权限生命周期
						</h3>
					</header>
					<p>
						这部分只证明身份底座已就绪，不代表性能 Stack
						已部署或业务验收完成。GitHub Actions 以短期 OIDC 身份进入 deploy
						role，再把精确项目 Stack 交给 CloudFormation execution
						role；浏览器、构建日志和仓库均不保存长期 AWS Key。
					</p>
					<ol className="evidence-trust-flow" aria-label="AWS 信任链">
						<li>
							<strong>GitHub OIDC</strong>
							<span>只接受 BabySteps 的 aws-performance Environment</span>
						</li>
						<li>
							<strong>Deploy role</strong>
							<span>验证共享底座、推送精确 ECR、运行/停止临时任务</span>
						</li>
						<li>
							<strong>CloudFormation role</strong>
							<span>只管理 babysteps-performance-* 生命周期</span>
						</li>
						<li>
							<strong>项目资源</strong>
							<span>API / Lambda / SQS / ECS / ECR / Secret / Log / SG</span>
						</li>
					</ol>
					<div className="evidence-identity-grid">
						<article>
							<h4>Environment 与共享变量</h4>
							<p>
								Environment 只保存 Role ARN、共享 VPC/私有子网、NAT、RDS、DB
								Security Group、共享 Secret ARN 和 Artifact Bucket
								等脱敏定位信息；Secret 值不进入 GitHub deploy role。
							</p>
						</article>
						<article>
							<h4>创建期二阶段权限</h4>
							<p>
								SQS 允许 Set/Tag，ECR 允许 PutLifecyclePolicy/Tag，Secrets 允许
								GetRandomPassword 与首次 Tag，Security Group 只可在共享 VPC
								创建并带项目标签；稳定期删除仍要求项目 ResourceTag。
							</p>
						</article>
						<article>
							<h4>线上验证</h4>
							<p>
								共享 Identity Stack 为 UPDATE_COMPLETE、drift IN_SYNC；18/18
								身份契约、CloudFormation validate、Budget Guard
								通过。项目动作模拟 allowed，非项目前缀和 Secret GetSecretValue
								保持 denied。
							</p>
						</article>
						<article>
							<h4>生命周期与清理边界</h4>
							<p>
								项目清理只删除 exact Stack 与 babysteps-performance-*；共享
								NAT、RDS、ALB、OIDC 和 Foundation 删除为
								explicitDeny。失败运行也必须先留脱敏证据，再做九类资源零残留盘点。
							</p>
						</article>
						<article>
							<h4>ECS 官方服务角色</h4>
							<p>
								AWSServiceRoleForECS 由 ECS 服务信任并只挂 AWS 官方托管策略；
								账户级复用、零长期密钥、角色本身不收费。它只让 ECS
								管理任务所需网络资源，不授予浏览器或 GitHub 数据库凭据。
							</p>
						</article>
					</div>
					<section
						className="evidence-runtime-timeline"
						aria-labelledby="performance-runtime-timeline-title"
					>
						<h4 id="performance-runtime-timeline-title">
							真实云端排障与恢复时间线
						</h4>
						<ol>
							<li>
								<a
									href="https://github.com/Tiancheng-Xu/babysteps/actions/runs/31760380214"
									target="_blank"
									rel="noreferrer"
								>
									Run 31760380214
								</a>
								：ECS 任务已实际启动；旧 Cleaner bundle
								在模块加载期退出，尚未读取 Secret
								或连接数据库，因此不把它算成业务成功。
							</li>
							<li>
								<a
									href="https://github.com/Tiancheng-Xu/babysteps/actions/runs/31761586956"
									target="_blank"
									rel="noreferrer"
								>
									Recovery 31761586956
								</a>
								：短期 OIDC
								身份只删除上述精确失败栈，并以九类项目资源归零作为完成条件。
							</li>
						</ol>
					</section>
				</section>
				<div className="evidence-diagrams evidence-diagrams--performance">
					<article className="evidence-diagram-card">
						<header className="evidence-diagram-card__header">
							<div>
								<p className="section-kicker">SYSTEM + DATA + TRUST</p>
								<h3>性能观测架构图</h3>
							</div>
							<span className="evidence-diagram-card__status">
								六层责任边界
							</span>
						</header>
						<figure className="architecture-figure">
							<div className="evidence-diagram-frame">
								<img
									src={performanceArchitectureImage}
									alt="BabySteps 性能观测完整架构图"
									width="2400"
									height="1600"
									loading="lazy"
									decoding="async"
								/>
							</div>
							<figcaption>
								浏览器、Cloudflare、AWS 接收与清洗、共享
								PostgreSQL、真实查询、OIDC 发布和项目级清理都在同一张图中。
							</figcaption>
						</figure>
						<div className="evidence-diagram-walkthrough">
							<p>
								<strong>看哪里</strong>先看三条虚线信任边界，再沿 1–5
								编号箭头追踪数据；底部深色栏写清失败、DLQ、项目清理和受保护共享资源。
							</p>
							<p>
								<strong>证明什么</strong>浏览器没有 AWS 凭据或 Origin Token；ECS
								无常驻 Service；共享 VPC/NAT/RDS 不进入项目 cleanup。
							</p>
						</div>
						<a
							className="evidence-diagram-link"
							href={performanceArchitectureImage}
							target="_blank"
							rel="noreferrer"
						>
							查看性能架构原图
						</a>
					</article>
					<article className="evidence-diagram-card">
						<header className="evidence-diagram-card__header">
							<div>
								<p className="section-kicker">EVENT LIFECYCLE</p>
								<h3>性能事件闭环时序图</h3>
							</div>
							<span className="evidence-diagram-card__status">六阶段闭环</span>
						</header>
						<figure className="architecture-figure">
							<div className="evidence-diagram-frame">
								<img
									src={performanceSequenceImage}
									alt="BabySteps 性能事件闭环时序图"
									width="2400"
									height="1600"
									loading="lazy"
									decoding="async"
								/>
							</div>
							<figcaption>
								从采集和 sendBeacon，到 SQS 有界重试、ECS
								幂等清洗、真实样本统计，再到 Evidence 与资源清理。
							</figcaption>
						</figure>
						<div className="evidence-diagram-walkthrough">
							<p>
								<strong>看哪里</strong>从 01 到 06 顺序读；重点看 202
								只在入队后返回、maxReceiveCount=3、幂等写入和最后的 DROP SCHEMA
								→ delete-stack。
							</p>
							<p>
								<strong>证明什么</strong>
								{
									"Dashboard 展示真实样本数与 p50 / p75 / p95，不平均 percentile，也不在链路故障时使用演示数据。"
								}
							</p>
						</div>
						<a
							className="evidence-diagram-link"
							href={performanceSequenceImage}
							target="_blank"
							rel="noreferrer"
						>
							查看性能时序原图
						</a>
					</article>
				</div>
				<div className="evidence-proof-gallery">
					<figure>
						<img
							src={performanceDashboardDesktopImage}
							alt="BabySteps 性能统计页桌面端本地响应式验证"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里：</strong>
							时间、页面、指标、环境、版本五个筛选，以及“无演示数据兜底”。
							<br />
							<strong>证明什么：</strong>
							桌面端会诚实展示上游不可用，不使用伪造曲线或 Mock 统计。
						</figcaption>
					</figure>
					<figure>
						<img
							src={performanceDashboardMobileImage}
							alt="BabySteps 性能统计页 390 像素手机端本地响应式验证"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里：</strong>390px
							视口内筛选器与状态提示保持单列可读。
							<br />
							<strong>证明什么：</strong>
							手机端没有根级横向溢出；该截图只证明本地 UI，不代表 AWS 已部署。
						</figcaption>
					</figure>
				</div>
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
