import { useState } from "react";
import performanceArchitectureImage from "../../../docs/architecture/starbuddy-performance-global-architecture.svg";
import performanceSequenceImage from "../../../docs/architecture/starbuddy-performance-pipeline-sequence.svg";
import renderingArchitectureImage from "../../../docs/architecture/starbuddy-rendering-global-architecture.svg";
import renderingSequenceImage from "../../../docs/architecture/starbuddy-rendering-resilience-sequence.svg";
import businessSequenceImage from "../../../docs/architecture/starbuddy-web3-business-sequence.svg";
import globalArchitectureImage from "../../../docs/architecture/starbuddy-web3-global-architecture.svg";
import roleArchitectureUrl from "../../../docs/evidence/architecture/babysteps-role-boundaries.html?url";
import performanceFinalEvidenceUrl from "../../../docs/evidence/deployment/2026-08-29-performance-aws-final.json?url";
import implementedJourneyEvidenceUrl from "../../../docs/evidence/deployment/2026-08-30-implemented-feature-live-journey.json?url";
import roleInventory from "../../../docs/evidence/deployment/2026-08-30-role-boundary-inventory.json";
import roleInventoryUrl from "../../../docs/evidence/deployment/2026-08-30-role-boundary-inventory.json?url";
import performanceFinalVideo from "../../../docs/evidence/recordings/2026-08-29-performance-final/performance-live.webm";
import prdFullWalkthroughVideo from "../../../docs/evidence/recordings/2026-08-30-prd-full-walkthrough/babysteps-prd-full-walkthrough.webm";
import renderingDesktopImage from "../../../docs/evidence/screenshots/2026-08-14-rendering-resilience/rendering-evidence-desktop-1440.png";
import renderingMobileImage from "../../../docs/evidence/screenshots/2026-08-14-rendering-resilience/rendering-evidence-mobile-390.png";
import keepsakeDesktopImage from "../../../docs/evidence/screenshots/2026-08-14-starbuddy-sepolia/keepsake-gallery-sepolia-desktop-1440.png";
import keepsakeMobileImage from "../../../docs/evidence/screenshots/2026-08-14-starbuddy-sepolia/keepsake-gallery-sepolia-mobile-390.png";
import productClosureDesktopImage from "../../../docs/evidence/screenshots/2026-08-20-web3-product-closure/evidence-product-closure-desktop-1440.png";
import providerConsoleMobileImage from "../../../docs/evidence/screenshots/2026-08-20-web3-product-closure/provider-console-mobile-390.png";
import performanceFinalDesktopImage from "../../../docs/evidence/screenshots/2026-08-29-performance-final/performance-live-desktop-1440.png";
import performanceFinalMobileImage from "../../../docs/evidence/screenshots/2026-08-29-performance-final/performance-live-mobile-390.png";
import implementedJourneyRecordUrl from "../../../docs/evidence/testing/2026-08-30-implemented-feature-live-journey.md?url";
import performanceCoverageSemanticsUrl from "../../../docs/evidence/testing/2026-08-30-performance-coverage-semantics.md?url";

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
		"0xb343…F68 + 0xED65…E627 · 固定 12 成长星抽卡、三卡融合与 24 小时恢复",
	],
] as const;
const KEEPSAKE_RECOVERY_PROOF = "24 小时未回调可恢复";
const ROLE_STATUS_LABELS: Record<string, string> = {
	implemented: "已实现",
	"sepolia-verified": "Sepolia 已验证",
	"production-verified": "生产已验证",
	"cloud-verified": "云端已验证",
	historical: "历史版本",
	"readiness-only": "仅就绪模板",
	deferred: "明确延后",
};
const IMPLEMENTED_JOURNEY_GROUPS = [
	["NAV-01", "WALLET-01", "GROWTH-01", "GROWTH-02", "GROWTH-03"],
	["TRANSFER-01", "NOTE-01", "BABY-01", "BABY-02", "BABY-03"],
	[
		"PARENT-READ-01",
		"MARKET-READ-01",
		"MARKET-APPROVE-01",
		"MARKET-BUY-01",
		"CONTENT-01",
		"COMPLETE-SUBMIT-01",
	],
	[
		"PROVIDER-CREATE-01",
		"OWNER-APPROVE-01",
		"OWNER-REJECT-01",
		"COMPLETION-LOAD-01",
		"COMPLETION-CONFIRM-01",
	],
	[
		"KEEPSAKE-DRAW-01",
		"KEEPSAKE-FUSE-01",
		"KEEPSAKE-RECOVER-01",
		"QUOTE-01",
		"SWAP-01",
	],
	[
		"IDENTITY-LOGIN-01",
		"IDENTITY-SESSION-01",
		"PROFILE-01",
		"PERF-01",
		"EVIDENCE-01",
	],
] as const;

export function EvidencePage() {
	const [isRoleArchitectureOpen, setIsRoleArchitectureOpen] = useState(false);

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

			<section
				className="evidence-recorded-proof"
				aria-labelledby="prd-full-walkthrough-title"
			>
				<header className="evidence-recorded-proof__header">
					<div>
						<p className="section-kicker">
							PRD FULL WALKTHROUGH · PRE-PUSH GATE
						</p>
						<h2 id="prd-full-walkthrough-title">PRD 全功能可见走读</h2>
					</div>
					<span className="evidence-diagram-card__status">
						本地生产构建 · 16 段 · pageerror 0
					</span>
				</header>
				<p>
					34.4 秒无声受控浏览器录屏，覆盖 9 条产品路由、1440px 桌面端与 390px
					移动端：首页钱包与网络、双账本成长、赠送、链上便签、任务、家长中心、
					纪念卡、Provider、兑换、身份、性能观测与 Evidence 映射。
				</p>
				<p>
					录屏只证明本地生产构建 UI 与安全只读交互：钱包写入 0、链上交易
					0。Sepolia 报价真实结算为脱敏失败；AWS Runtime
					关闭时性能筛选保持禁用并记录为 unavailable。链上写入、第三方登录与临时
					AWS 闭环继续以各自独立 Evidence 为准。
				</p>
				<figure className="evidence-video-proof">
					<video
						aria-label="BabySteps PRD 全功能本地生产构建走读录屏"
						controls
						muted
						playsInline
						preload="metadata"
						poster={productClosureDesktopImage}
					>
						<source src={prdFullWalkthroughVideo} type="video/webm" />
						当前浏览器不支持 WebM 视频播放。
					</video>
					<figcaption>
						来源：controlled-browser local production build · commit
						55fac7c9ab84 · SHA-256 61c0188e…e3dc7f87。
					</figcaption>
				</figure>
			</section>

			<section
				className="evidence-role-ledger"
				aria-labelledby="role-boundary-title"
			>
				<header className="evidence-role-ledger__header">
					<div>
						<p className="section-kicker">AUTHORIZATION · TRUST · DENY</p>
						<h2 id="role-boundary-title">全角色与权限边界</h2>
					</div>
					<span className="evidence-diagram-card__status">
						{roleInventory.groups.reduce(
							(total, group) => total + group.roles.length,
							0,
						)}{" "}
						项 · 当前 / 历史 / 延后分层
					</span>
				</header>
				<p className="evidence-role-ledger__lead">
					这里把“产品身份、链上 RBAC、合约持有者、后端服务主体、GitHub/AWS
					角色”分开记录。每项都写明能做什么、明确不能做什么、由谁授予，以及证据状态；
					同一个钱包可同时持有多个角色，但角色不会互相隐式继承。
				</p>
				<div className="evidence-role-ledger__actions">
					<button
						type="button"
						className="evidence-diagram-link evidence-role-ledger__button"
						aria-expanded={isRoleArchitectureOpen}
						aria-controls="role-architecture-panel"
						onClick={() => setIsRoleArchitectureOpen(true)}
					>
						打开全角色架构图
					</button>
					<a
						className="evidence-diagram-link"
						href={roleInventoryUrl}
						target="_blank"
						rel="noreferrer"
					>
						下载机器可读角色清单
					</a>
					<a
						className="evidence-diagram-link"
						href={roleArchitectureUrl}
						target="_blank"
						rel="noreferrer"
					>
						在新窗口打开架构图
					</a>
				</div>

				{isRoleArchitectureOpen ? (
					<div
						id="role-architecture-panel"
						className="evidence-role-architecture"
					>
						<header>
							<div>
								<strong>Archify 交互式角色架构</strong>
								<span>独立自包含 HTML · 首屏不加载 · 仅点击后挂载</span>
							</div>
							<button
								type="button"
								onClick={() => setIsRoleArchitectureOpen(false)}
							>
								关闭全角色架构图
							</button>
						</header>
						<iframe
							title="BabySteps 全角色与信任边界"
							src={roleArchitectureUrl}
							sandbox="allow-scripts allow-downloads"
							loading="lazy"
							referrerPolicy="no-referrer"
						/>
					</div>
				) : null}

				<div className="evidence-role-groups">
					{roleInventory.groups.map((group, groupIndex) => (
						<details key={group.id} open={groupIndex < 2}>
							<summary>
								<span>{group.title}</span>
								<small>{group.roles.length} 项</small>
							</summary>
							<p>{group.summary}</p>
							<div className="evidence-role-grid">
								{group.roles.map((role) => (
									<article key={role.id}>
										<header>
											<h3>{role.name}</h3>
											<span data-role-status={role.status}>
												{ROLE_STATUS_LABELS[role.status] ?? role.status}
											</span>
										</header>
										<dl>
											<div>
												<dt>主体</dt>
												<dd>{role.holder}</dd>
											</div>
											<div>
												<dt>允许</dt>
												<dd>{role.allowed}</dd>
											</div>
											<div>
												<dt>拒绝</dt>
												<dd>{role.denied}</dd>
											</div>
											<div>
												<dt>授予/约束</dt>
												<dd>{role.authority}</dd>
											</div>
										</dl>
									</article>
								))}
							</div>
						</details>
					))}
				</div>
			</section>

			<section
				className="evidence-feature-proof"
				aria-labelledby="implemented-feature-journey-title"
			>
				<header className="evidence-feature-proof__header">
					<div>
						<p className="section-kicker">VISIBLE UI · REAL JOURNEY GATE</p>
						<h2 id="implemented-feature-journey-title">已实现功能真实全旅程</h2>
					</div>
					<span className="evidence-diagram-card__status">
						local-verified · 31 个 Journey
					</span>
				</header>
				<p className="evidence-feature-proof__lead">
					本地已锁定 31 个可见产品 Journey、20 个低基数业务性能指标、31
					章录屏合同，以及 9 条路由 × 4 个视口的浏览器与 BackstopJS Gate。旧
					34.4 秒录屏仍只证明 UI 走读；最终录屏、Sepolia 本轮交易、AWS Live
					与生产回读必须在同一最终提交上完成后才能升级状态。
				</p>
				<div className="evidence-runtime-grid">
					<article>
						<strong>状态层级</strong>
						<span>
							local-verified → sepolia-verified → aws-live-verified →
							production-verified；失败使用 blocked
						</span>
					</article>
					<article>
						<strong>当前确定性 Gate</strong>
						<span>
							Validator 106/106 · 页面语义 36/36 · BackstopJS 36/36 ·
							生产构建通过
						</span>
					</article>
				</div>
				<section
					className="evidence-requirement-map"
					aria-labelledby="implemented-journey-catalog-title"
				>
					<h3 id="implemented-journey-catalog-title">Journey ID 目录</h3>
					<div>
						{IMPLEMENTED_JOURNEY_GROUPS.map((group) => (
							<article key={group[0]}>
								<code>{group.join(" · ")}</code>
							</article>
						))}
					</div>
				</section>
				<article className="evidence-diagram-card">
					<h3>当前实现边界</h3>
					<p>
						不在当前实现范围：Provider D1 草稿编辑、Owner
						角色管理、独立任务详情与评论、 家长购买总览、购买抽屉自动
						Swap，以及属于 Agent Market 的仲裁和
						Cocos。它们不会用隐藏接口或夹具冒充产品 UI。
					</p>
					<div className="evidence-diagram-card__actions">
						<a
							className="evidence-diagram-link"
							href={implementedJourneyEvidenceUrl}
						>
							查看机器证据
						</a>
						<a
							className="evidence-diagram-link"
							href={implementedJourneyRecordUrl}
						>
							查看实现记录
						</a>
					</div>
				</article>
			</section>

			<section
				className="evidence-feature-proof"
				aria-labelledby="rendering-resilience-title"
			>
				<header className="evidence-feature-proof__header">
					<div>
						<p className="section-kicker">STATIC-FIRST · EDGE RENDERING</p>
						<h2 id="rendering-resilience-title">边缘渲染与故障降级</h2>
					</div>
					<span className="evidence-diagram-card__status">
						生产部署已验证 · 2026-08-14
					</span>
				</header>
				<p className="evidence-feature-proof__lead">
					边缘 SSR → 精确水合 → 纯 CSR 降级。公开页面先由 Cloudflare Edge
					输出可读摘要壳；浏览器只在服务端标记、当前路径和构建版本
					一致时启动水合，并记录 React 发现的可恢复 DOM
					差异。钱包与身份只在客户端激活，SSR
					超时、异常或致命水合失败时最多一次切回纯 CSR。
				</p>

				<section className="evidence-requirement-map" aria-label="渲染实现映射">
					<h3>要求、实现与证据映射</h3>
					<div>
						<article>
							<strong>交付要求</strong>
							<span>真实 URL 与深链</span>
							<strong>实现功能</strong>
							<span>BrowserRouter、九条路由、404 状态保留</span>
							<strong>代码位置</strong>
							<code>web/src/routing</code>
							<strong>验证证据</strong>
							<span>路由单测与 Worker 路由矩阵通过</span>
							<strong>当前状态</strong>
							<span>本地已验证</span>
						</article>
						<article>
							<strong>交付要求</strong>
							<span>SSR、水合与故障降级</span>
							<strong>实现功能</strong>
							<span>Web Streams SSR、严格水合、最多一次 CSR 重挂载</span>
							<strong>代码位置</strong>
							<code>web/src/entry-server.tsx · web/src/bootstrap.tsx</code>
							<strong>验证证据</strong>
							<span>单元测试、双端生产构建与内置 Worker 读回</span>
							<strong>当前状态</strong>
							<span>本地与 Cloudflare production 均已验证</span>
						</article>
						<article>
							<strong>交付要求</strong>
							<span>成本与安全边界</span>
							<strong>实现功能</strong>
							<span>Edge 承担前端渲染；不序列化钱包、用户或令牌</span>
							<strong>代码位置</strong>
							<code>web/src/pages-worker.ts · web/src/ssr/renderState.ts</code>
							<strong>验证证据</strong>
							<span>AWS 无写操作；安全状态白名单测试通过</span>
							<strong>当前状态</strong>
							<span>AWS 增量成本 $0</span>
						</article>
						<article>
							<strong>交付要求</strong>
							<span>共享 Static-First Gate</span>
							<strong>实现功能</strong>
							<span>edge-ssr 契约、产物检查与 built Worker 运行矩阵</span>
							<strong>代码位置</strong>
							<code>.github/workflows/verify-baby2b-project.yml</code>
							<strong>验证证据</strong>
							<span>共享 main 0c9185f、68/68；BabySteps Run 31791893461</span>
							<strong>当前状态</strong>
							<span>共享远端已发布；BabySteps 远端 Gate 与 Preview 已验证</span>
						</article>
					</div>
				</section>

				<article className="evidence-diagram-card">
					<h3>应反向优化的共享能力</h3>
					<p>
						已验证两条通用规则：资源根路径必须按交付契约判断；渲染 Gate
						必须直接执行构建后的 Worker，覆盖尾斜杠、真实 404、API
						直通和客户端区域缓存。BabySteps
						已完成项目发现与本地验证。共享任务已将规则回写到
						standard、检测脚本、TC Flow 和 reusable workflow，并以 68/68
						测试回归既有 SSG 项目，并通过 PR #14 发布到共享 main
						<code>0c9185f</code>。BabySteps 已声明 edge-ssr、rendering
						manifest、server artifact 与 built Worker 运行命令。PR #23 的
						Repository Policy、共享项目验证与 Cloudflare Pages 三项 Gate
						均成功；Run 31791893461 在构建后执行共享策略与 built Worker
						矩阵，Preview deployment{" "}
						<code>23e11aa6-5e04-4aa0-ba79-6fd3b66dc1f4</code>的
						SSR、深链、404、静态资源和 TLS
						已读回。项目专属路由或钱包逻辑不会进入通用规则。
					</p>
					<div className="evidence-diagram-card__actions">
						<a
							className="evidence-diagram-link"
							href="https://github.com/Tiancheng-Xu/.github/pull/14"
						>
							查看共享 Gate PR
						</a>
						<a
							className="evidence-diagram-link"
							href="https://github.com/Tiancheng-Xu/babysteps/actions/runs/31791893461"
						>
							查看 BabySteps Gate Run
						</a>
						<a
							className="evidence-diagram-link"
							href="https://23e11aa6.babysteps-83x.pages.dev/evidence"
						>
							查看 BabySteps Preview
						</a>
					</div>
				</article>

				<article className="evidence-diagram-card">
					<h3>生产发布闭环</h3>
					<p>
						PR #21 经 Repository Policy、项目验证和 Cloudflare Pages 预览三项
						Gate 通过后合并；main 合并提交为 <code>91dcc4c</code>，验证记录为
						Run 31789478284，Cloudflare deployment
						<code>5f4a39e0-0fc5-4bd2-87a2-25158fe2111b</code> 均成功。
					</p>
					<p>
						deployment-specific、pages.dev、自定义域名、Evidence
						与个人中心深链均返回 200；未知路由返回真实 404；TLS 校验结果为
						0。公开页保持 SSR 响应，个人区域为 <code>private, no-store</code>。
					</p>
					<div className="evidence-diagram-card__actions">
						<a
							className="evidence-diagram-link"
							href="https://github.com/Tiancheng-Xu/babysteps/pull/21"
						>
							查看合并 PR
						</a>
						<a
							className="evidence-diagram-link"
							href="https://github.com/Tiancheng-Xu/babysteps/actions/runs/31789478284"
						>
							查看主分支验证 Run
						</a>
						<a
							className="evidence-diagram-link"
							href="https://5f4a39e0.babysteps-83x.pages.dev/"
						>
							查看本次部署 URL
						</a>
					</div>
				</article>

				<section className="evidence-diagrams" aria-label="渲染架构与降级时序">
					<article className="evidence-diagram-card">
						<h3>边缘渲染运行架构</h3>
						<figure className="architecture-figure">
							<div className="evidence-diagram-frame">
								<img
									src={renderingArchitectureImage}
									alt="BabySteps 边缘渲染架构图"
									width="2000"
									height="1200"
									loading="lazy"
									decoding="async"
								/>
							</div>
							<figcaption>
								静态资源、HTML 文档、客户端身份与性能上报各走独立边界。
							</figcaption>
						</figure>
						<div className="evidence-diagram-walkthrough">
							<p>
								<strong>看哪里</strong>：从请求分类开始，沿
								SSR、浏览器水合和客户端 Provider 三层阅读。
							</p>
							<p>
								<strong>证明什么</strong>：钱包与身份只在客户端激活；前端 SSR
								不复制到 AWS，因此 AWS 增量成本 $0。
							</p>
						</div>
						<a
							className="evidence-diagram-link"
							href={renderingArchitectureImage}
							target="_blank"
							rel="noreferrer"
						>
							查看渲染架构原图
						</a>
					</article>

					<article className="evidence-diagram-card">
						<h3>SSR、水合与 CSR 降级时序</h3>
						<figure className="architecture-figure">
							<div className="evidence-diagram-frame">
								<img
									src={renderingSequenceImage}
									alt="BabySteps SSR、水合与 CSR 降级时序图"
									width="2000"
									height="1300"
									loading="lazy"
									decoding="async"
								/>
							</div>
							<figcaption>
								正常路径和两条降级路径并列，失败不会无限重试或输出私有状态。
							</figcaption>
						</figure>
						<div className="evidence-diagram-walkthrough">
							<p>
								<strong>看哪里</strong>：绿色是正常 SSR/水合，杏色是 SSR
								fallback，红色是水合致命失败。
							</p>
							<p>
								<strong>证明什么</strong>：404 保留状态码；SSR
								失败仍返回可启动的 HTML；水合失败最多一次 CSR 重挂载。
							</p>
						</div>
						<a
							className="evidence-diagram-link"
							href={renderingSequenceImage}
							target="_blank"
							rel="noreferrer"
						>
							查看渲染时序原图
						</a>
					</article>
				</section>

				<section
					className="evidence-screenshot-grid"
					aria-label="渲染响应式截图"
				>
					<figure>
						<img
							src={renderingDesktopImage}
							alt="本地 SSR 水合桌面端验证"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里</strong>：1440
							像素下状态、三列映射与架构图连续可读。
							<br />
							<strong>证明什么</strong>：本地产物以 SSR
							标记进入浏览器并完成水合。
						</figcaption>
					</figure>
					<figure>
						<img
							src={renderingMobileImage}
							alt="本地 SSR 水合 390 像素手机端验证"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里</strong>：390 像素下卡片单列、长路径自动换行。
							<br />
							<strong>证明什么</strong>：375 / 390 / 430 / 1440 均无横向溢出。
						</figcaption>
					</figure>
				</section>
			</section>

			<section
				className="evidence-feature-proof"
				aria-labelledby="web3-product-closure-title"
			>
				<header className="evidence-feature-proof__header">
					<div>
						<p className="section-kicker">
							WEB3 PRODUCT CLOSURE · CLOUDFLARE DEPLOYED
						</p>
						<h2 id="web3-product-closure-title">
							上架、内容解锁与任务完成证书入口
						</h2>
					</div>
					<span className="evidence-diagram-card__status">
						核心交付已验证 · 生产增强待复核
					</span>
				</header>
				<p className="evidence-feature-proof__lead">
					Provider 改为 V2 requestTask，Owner
					钱包负责审核；公共任务详情不再返回视频，只有签名会话和链上购买事实同时成立时才能解锁。家长提交任务完成说明后，Owner
					把同一 evidence hash 写入 Sepolia，Marketplace 再按 purchaseId
					幂等铸造锁定 SBT。
				</p>
				<section
					className="evidence-requirement-map"
					aria-labelledby="performance-coverage-semantics-title"
				>
					<h3 id="performance-coverage-semantics-title">
						全路由采样与覆盖语义
					</h3>
					<div>
						<article>
							<strong>本地实现状态</strong>
							<span>本地已验证 · 云端样本待刷新</span>
							<strong>修复内容</strong>
							<span>
								把“已有样本、健康零事件、场景未执行、真实缺样本、环境不可用”拆成五种状态，不再把错误为
								0、Long Task 为 0、未执行 Web3 与 DNS/TLS
								不可测混写成同一句“无样本”。
							</span>
							<strong>路由与安全采样</strong>
							<span>
								9 条产品路由 × 4 个视口共 36 项浏览器检查通过；受控 Journey 完成
								23 项强制观测：五项 Web Vitals、导航、七类 Resource
								Timing、三类渲染，以及 contract/RPC/Uniswap
								只读场景；不制造错误、坏 CLS、钱包授权或链上交易填数。
							</span>
							<strong>验证证据</strong>
							<span>
								全量测试、typecheck、生产 build、公开内容扫描、根级
								overflow/pageerror 检查与 BackstopJS 375/390/430/1440 均通过。
							</span>
							<a
								href={performanceCoverageSemanticsUrl}
								target="_blank"
								rel="noreferrer"
							>
								查看覆盖语义与全路由检查记录
							</a>
							<strong>证据边界</strong>
							<span>
								Run 33304145710 在无 AWS 权限的本地前置 Gate 因缺少 INP
								停止，云端 Job 被跳过；当前生产历史快照仍来自 Run
								33279132965。只有合并后新的临时 AWS Run
								完成采集、Cleaner、查询与零残留清理，才能把新增资源覆盖标记为云端已验证。
							</span>
						</article>
					</div>
				</section>
				<section
					className="evidence-requirement-map"
					aria-label="Web3 产品闭环实现映射"
				>
					<h3>要求、实现与证据映射</h3>
					<div>
						<article>
							<strong>上架审核</strong>
							<span>Provider requestTask → Owner approve/reject → VRF</span>
							<strong>代码位置</strong>
							<code>web/src/features/provider</code>
							<strong>验证证据</strong>
							<span>Provider/Owner Hook 与 ABI 测试通过</span>
							<strong>当前状态</strong>
							<span>
								Sepolia Provider → Owner → VRF 已有真实交易；新版 UI
								新交易为增强复核
							</span>
						</article>
						<article>
							<strong>购买后解锁</strong>
							<span>公开视频脱敏；会话 + purchaseIdForBuyer 双门禁</span>
							<strong>代码位置</strong>
							<code>worker/src/routes/tasks.ts · TaskLearningPanel.tsx</code>
							<strong>验证证据</strong>
							<span>未登录、未购买、RPC 失败和已购路径均有测试</span>
							<strong>当前状态</strong>
							<span>
								链上 + D1 ID 绑定与评论已闭环；新版已购内容接口为增强复核
							</span>
						</article>
						<article>
							<strong>任务完成与证书</strong>
							<span>D1 证据申请 → Owner 钱包 → confirmCompletion → SBT</span>
							<strong>代码位置</strong>
							<code>
								worker/src/routes/completions.ts ·
								OwnerCompletionReviewPanel.tsx
							</code>
							<strong>验证证据</strong>
							<span>Worker 62/62、Web 226/226；生产无会话请求为 401</span>
							<strong>当前状态</strong>
							<span>
								真实 confirmCompletion 与锁定 SBT #1；新版 D1 completion UI
								为增强复核
							</span>
						</article>
					</div>
				</section>
				<section
					className="evidence-screenshot-grid"
					aria-label="Web3 产品闭环本地响应式截图"
				>
					<figure>
						<img
							src={productClosureDesktopImage}
							alt="Web3 产品闭环 Evidence 桌面端本地验证"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里</strong>：1440
							像素下三列映射、状态标签与中英文代码路径均完整换行。
							<br />
							<strong>证明什么</strong>：新增 Evidence
							走读真实渲染且无横向溢出；云端发布另由 Worker #4、D1 migration 与
							HTTP 结果证明。
						</figcaption>
					</figure>
					<figure>
						<img
							src={providerConsoleMobileImage}
							alt="Provider 与 Owner 控制台 390 像素本地验证"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里</strong>：390 像素下 V2
							提交、任务审核和任务完成审核按单列排列。
							<br />
							<strong>证明什么</strong>
							：产品入口与移动端布局已落地；只读状态不冒充钱包角色或链上交易成功。
						</figcaption>
					</figure>
				</section>
			</section>

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
							transferFrom、Owner 任务完成确认（可替换 KMS Relayer）、纪念卡 VRF
							与两类 SBT 都有明确责任方；失败不会伪造会话、余额、购买或证书。
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
							PERFORMANCE DELIVERY · OBSERVABILITY PIPELINE
						</p>
						<h2 id="performance-proof-title">性能观测架构图</h2>
					</div>
					<span className="evidence-diagram-card__status">
						最终闭环已验证 · 取证后零残留
					</span>
				</header>
				<p className="evidence-feature-proof__lead">
					浏览器 SDK → Worker → AWS 的链路把采集、异步入队、ECS
					清洗、共享数据库和真实统计拆成独立信任边界。GitHub Actions Run
					33279132965 在 commit 1e703caeba2d 上以受控 Chromium、Vite Web 和本地
					Worker 代理访问 5 条页面路径，再连接临时 AWS 后端完成 SQS 入队、ECS
					Cleaner、PostgreSQL 聚合与 Live Dashboard 取证；随后删除 Schema
					与精确项目 Stack，复核队列、DLQ 与 12 类项目资源全部为 0。
				</p>
				<section
					className="evidence-requirement-map"
					aria-labelledby="performance-requirement-map-title"
				>
					<h3 id="performance-requirement-map-title">要求、实现与证据映射</h3>
					<div>
						<article>
							<strong>交付要求</strong>
							<span>浏览器性能 SDK</span>
							<strong>实现功能</strong>
							<span>五项 Web Vitals、错误、自定义耗时、批量与安全降级</span>
							<strong>代码位置</strong>
							<code>packages/performance-sdk/src</code>
							<strong>验证证据</strong>
							<span>
								5 条真实页面路径、14 个批次、{"85 个唯一事件"}
								；LCP、CLS、INP、FCP、TTFB 与导航阶段均有受控样本
							</span>
							<strong>当前状态</strong>
							<span>已实现并验证</span>
						</article>
						<article>
							<strong>交付要求</strong>
							<span>AWS 接收、队列与 ECS 清洗</span>
							<strong>实现功能</strong>
							<span>Worker 代理、HTTP API、SQS/DLQ、一次性 ECS Cleaner</span>
							<strong>代码位置</strong>
							<code>aws/src/performance · aws/performance-template.yaml</code>
							<strong>验证证据</strong>
							<code>Run 33279132965</code>
							<strong>当前状态</strong>
							<span>
								ECS Cleaner 处理并写入 85 条，0 丢弃、0 可重试失败；SQS 与 DLQ
								的 visible、in-flight、delayed 均为 0
							</span>
						</article>
						<article>
							<strong>交付要求</strong>
							<span>真实统计页面与可回收云资源</span>
							<strong>实现功能</strong>
							<span>PostgreSQL 聚合查询、p50/p75/p95、项目级自动清理</span>
							<strong>代码位置</strong>
							<code>
								web/src/pages/PerformanceDashboardPage.tsx ·
								.github/workflows/aws-performance.yml
							</code>
							<strong>验证证据</strong>
							<span>
								Live API 实测 LCP/CLS/INP/FCP/TTFB、导航和脚本资源分位数；Schema
								与精确项目 Stack 已删除，12 类项目资源全部为 0
							</span>
							<a
								href={performanceFinalEvidenceUrl}
								target="_blank"
								rel="noreferrer"
							>
								查看机器可读证据
							</a>
							<strong>当前状态</strong>
							<span>已实现并验证</span>
						</article>
					</div>
				</section>
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
						身份底座已参与最终闭环验证。GitHub Actions 以短期 OIDC 身份进入
						deploy role，再把精确项目 Stack 交给 CloudFormation execution
						role；浏览器、构建日志和仓库均不保存长期 AWS Key，临时 Stack
						在证据生成后删除。
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
								最终 Run 已删除 exact Stack 与 babysteps-performance-*；共享
								NAT、RDS、ALB、OIDC 和 Foundation 删除为 explicitDeny。清理后 12
								类项目运行资源均为 0。
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
							临时 AWS 验证与恢复时间线
						</h4>
						<ol>
							<li>
								<code>Run 33279132965</code>
								：commit 1e703caeba2d 的最终合同完成 5 条页面路径、85
								个唯一事件、14 个接收批次与 85 条幂等写入；LCP 4、CLS 5、INP
								1、FCP 5、TTFB 5， 导航分项各 5。队列/DLQ 全量排空，Schema、精确
								Stack 与 12 类项目资源全部归零。
							</li>
							<li>
								<code>Run 33253468433</code>
								：截图已生成但生命周期 drain 在一次传输失败后只按 attempt
								计数，导致
								<code>/tasks</code> 超时。修复改为按 eventId 对账：3 秒单次
								attempt 超时后允许 SDK
								以同一事件重试，只有全部唯一事件最终被接收才通过；该失败 Run 的
								Schema、Stack 与 12 类资源也已验证归零。
							</li>
							<li>
								<code>Run 33160455921</code>
								：历史快照曾采集 415 条、写入 103 条，但清理前仍有 80 条 SQS
								可见消息，因此只保留为“部分排空”的旧证据，不再作为当前完成态。
							</li>
							<li>
								<code>Run 31760380214</code>
								：ECS 任务已实际启动；旧 Cleaner bundle
								在模块加载期退出，尚未读取 Secret
								或连接数据库，因此不把它算成业务成功。
							</li>
							<li>
								<code>Recovery 31761586956</code>
								：短期 OIDC
								身份只删除上述精确失败栈，并以九类项目资源归零作为完成条件。
							</li>
							<li>
								<code>Run 31763815468</code>
								：PostgreSQL 报 42P18，定位到 format 参数缺少显式 text
								类型；修复后由 Recovery 31764528855 删除失败栈并再次验证零残留。
							</li>
							<li>
								<code>Run 31765573258</code>
								：commit 485999c 的最终闭环成功，ECS Cleaner exitCode=0，
								sampleCount=1，p50=p75=p95=321；Schema、Stack
								与九类项目资源均完成清理。
							</li>
							<li>
								<code>Run 32626397427</code>
								：commit acd4898f61fc 的历史复验成功，受控 LCP 为 321ms， ECS
								Cleaner exitCode=0；Schema 与精确项目 Stack 已删除，项目 ECS
								Cluster 为 0，共享 Foundation 保持受保护。
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
							src={performanceFinalDesktopImage}
							alt="最终 AWS 性能统计桌面端真实页面截图"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里：</strong>
							时间、页面、指标、环境、版本五个筛选，以及“无演示数据兜底”。
							<br />
							<strong>证明什么：</strong>
							1440px 页面直接读取临时 AWS Live API，展示真实样本、覆盖状态和 p50
							/ p75 / p95；不使用伪造曲线或 Mock 统计。
						</figcaption>
					</figure>
					<figure>
						<img
							src={performanceFinalMobileImage}
							alt="最终 AWS 性能统计 390 像素手机端真实页面截图"
							loading="lazy"
						/>
						<figcaption>
							<strong>看哪里：</strong>390px
							视口内筛选器与状态提示保持单列可读。
							<br />
							<strong>证明什么：</strong>
							手机端没有根级横向溢出；截图来自同一 Run 的真实 Live API，取证后
							AWS 临时项目资源已全部清理。
						</figcaption>
					</figure>
				</div>
				<section
					className="evidence-recorded-proof"
					aria-labelledby="performance-recorded-proof-title"
				>
					<header className="evidence-recorded-proof__header">
						<div>
							<p className="section-kicker">VISIBLE PROOF · AFTER CLEANUP</p>
							<h3 id="performance-recorded-proof-title">
								本地浏览器接临时 AWS、截图与录屏
							</h3>
						</div>
						<span className="evidence-diagram-card__status">
							真实 Run 截图 · 取证后已清理
						</span>
					</header>
					<p>
						截图和录屏由本地 Chromium、Vite Preview 和本地 Worker 代理连接临时
						AWS API、SQS、ECS 与 PostgreSQL 后采集；随后 Run 33279132965
						删除项目 Schema 与临时 Stack，并用固定清单验证零残留。
						因此这些媒体证明真实运行窗口，公开页面则诚实保持非实时，不伪装成持续在线
						AWS 服务。
					</p>
					<div className="evidence-screenshot-grid">
						<figure>
							<img
								src={performanceFinalDesktopImage}
								alt="最终 AWS 性能统计桌面端真实页面截图"
								loading="lazy"
							/>
							<figcaption>
								<strong>桌面证据：</strong>1440 像素完整 Live 页面，显示 Core
								Web Vitals、导航、资源、错误、Web3 指标与真实覆盖状态。
							</figcaption>
						</figure>
						<figure>
							<img
								src={performanceFinalMobileImage}
								alt="最终 AWS 性能统计 390 像素手机端真实页面截图"
								loading="lazy"
							/>
							<figcaption>
								<strong>手机证据：</strong>390
								像素完整页面无根级横向溢出，筛选器、状态和全量指标保持单列可读。
							</figcaption>
						</figure>
					</div>
					<figure className="evidence-video-proof">
						<video
							aria-label="最终 AWS 性能统计页面走读录屏"
							controls
							muted
							playsInline
							preload="metadata"
							poster={performanceFinalDesktopImage}
						>
							<source src={performanceFinalVideo} type="video/webm" />
							当前浏览器不支持 WebM 视频播放。
						</video>
						<figcaption>
							4.84 秒无声走读录屏，只包含真实 Live
							Dashboard；不包含账号、Token、 Cookie 或其他窗口内容。
						</figcaption>
					</figure>
				</section>
			</section>

			<section
				className="evidence-feature-proof"
				aria-labelledby="keepsake-proof-title"
			>
				<header className="evidence-feature-proof__header">
					<div>
						<p className="section-kicker">FEATURE PROOF · SEPOLIA VERIFIED</p>
						<h2 id="keepsake-proof-title">StarBuddy 纪念卡抽取与融合</h2>
					</div>
					<span className="evidence-diagram-card__status">
						StarBuddy Sepolia 已验证
					</span>
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
							固定费用、概率、四阶段卡面、融合入口与钱包未连接状态。
							<br />
							<strong>证明什么：</strong>
							正式 Sepolia 地址已进入发布候选；未连接钱包时不伪造余额或卡片。
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
						→ 70/22/7/1 稀有度与独立阶段随机 → KeepsakeSBT 铸造；真实 SBT #1 ·
						星耀 · 闪耀星宝 已读回。
					</p>
					<p>
						<strong>融合与恢复</strong>锁定 3 张相同卡 → VRF 判定 100/70/40%
						成功率；{KEEPSAKE_RECOVERY_PROOF}
						，迟到回调被忽略。真实融合等待自然积累三张匹配卡，不设置管理员造卡后门。
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
							新版 Notebook + 两份纪念卡合约已部署；VRF consumer、12
							星扣款、随机结果与锁定 SBT #1 已链上验证
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
						<span>
							新版 Worker/D1 migration、Owner 任务完成角色、新 UI 与可选 IPFS
							pin
						</span>
					</div>
				</section>
			</div>
		</section>
	);
}
