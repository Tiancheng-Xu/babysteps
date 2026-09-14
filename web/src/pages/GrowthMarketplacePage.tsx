import { MarketplaceTaskCard } from "../features/marketplace/MarketplaceTaskCard";
import { useMarketplace } from "../features/marketplace/useMarketplace";

const TASK_CATEGORIES = [
	{
		name: "喂养陪伴",
		price: "2–4 BABY",
		window: "开放 3–4 小时",
		accent: "apricot",
	},
	{
		name: "户外陪伴",
		price: "2–4 BABY",
		window: "开放 8–12 小时",
		accent: "sage",
	},
	{
		name: "亲子共读",
		price: "2–4 BABY",
		window: "开放 4–6 小时",
		accent: "purple",
	},
] as const;

export function GrowthMarketplacePage() {
	const marketplace = useMarketplace();

	return (
		<section className="product-page" aria-labelledby="marketplace-heading">
			<header className="product-page__hero product-page__hero--marketplace">
				<div>
					<p className="product-page__eyebrow">家庭活动 · 公开浏览</p>
					<h1 id="marketplace-heading">成长任务市集</h1>
					<p>
						先浏览适合家庭的真实成长任务；登录只用于保存和参与，链上购买是可选的进阶能力。
					</p>
				</div>
				<aside className="marketplace-token-card" aria-label="购买流程">
					<span>进阶参与</span>
					<strong>登录 → 确认 → 记录</strong>
					<small>Sepolia 测试资产 · 无真实价值</small>
				</aside>
			</header>

			<div className="deployment-status" role="status">
				<span
					className={
						marketplace.isConfigured
							? "status-dot status-dot--ready"
							: "status-dot"
					}
				/>
				{marketplace.isConfigured
					? (marketplace.message ??
						`已从 Sepolia 读取 ${marketplace.tasks.length} 个成长任务。`)
					: "TaskMarketplace 尚未部署，当前仅展示已确认的上架规则。"}
			</div>

			<section className="marketplace-rule-grid" aria-label="成长任务上架规则">
				{TASK_CATEGORIES.map((category) => (
					<article
						className={`marketplace-rule-card marketplace-rule-card--${category.accent}`}
						key={category.name}
					>
						<div className="marketplace-rule-card__icon" aria-hidden="true">
							★
						</div>
						<h2>{category.name}</h2>
						<p>{category.price}</p>
						<small>{category.window}</small>
					</article>
				))}
			</section>

			{marketplace.tasks.length > 0 ? (
				<div className="marketplace-task-grid" aria-live="polite">
					{marketplace.tasks.map((task) => (
						<MarketplaceTaskCard task={task} key={task.id.toString()} />
					))}
				</div>
			) : (
				<div className="empty-state">
					<div className="empty-state__buddy" aria-hidden="true">
						☆
					</div>
					<h2>暂无已激活的成长任务</h2>
					<p>
						Provider 创建任务后会先进入等待随机数状态；VRF
						回调完成，任务才会在这里开放购买。
					</p>
					{marketplace.phase === "error" ? (
						<button
							type="button"
							className="button button--secondary"
							onClick={() => void marketplace.retryRead()}
						>
							重试读取链上任务
						</button>
					) : (
						<button type="button" className="button button--primary" disabled>
							{marketplace.isPending ? "正在读取" : "等待链上任务"}
						</button>
					)}
				</div>
			)}
		</section>
	);
}
