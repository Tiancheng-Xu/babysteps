import { Link } from "react-router-dom";

import { WalletPanel } from "../components/WalletPanel";
import { BabyCoinGrowthPanel } from "../features/babycoin/BabyCoinGrowthPanel";
import { NotebookPanel } from "../features/notebook/NotebookPanel";

export function ParentDashboardPage() {
	return (
		<section
			className="product-page"
			aria-labelledby="parent-dashboard-heading"
		>
			<header className="product-page__hero product-page__hero--parent">
				<div>
					<p className="product-page__eyebrow">家庭档案 · 按需登录</p>
					<h1 id="parent-dashboard-heading">家长成长中心</h1>
					<p>
						首次陪伴可匿名保存在当前浏览器；需要跨设备保存和家庭协作时，再登录建立长期档案。
					</p>
				</div>
				<div className="parent-stage-seal" aria-hidden="true">
					<span>★</span>
					<small>StarBuddy</small>
				</div>
			</header>
			<section
				className="parent-onboarding-note"
				aria-labelledby="parent-onboarding-title"
			>
				<div>
					<p className="section-kicker">START LIGHT, SAVE WHEN READY</p>
					<h2 id="parent-onboarding-title">不登录也能先体验</h2>
					<p>
						首页三分钟任务只保存粗粒度阶段和完成状态；这里的余额、购买与链上记录属于进阶能力。
					</p>
				</div>
				<Link className="button button--primary" to="/profile">
					登录后长期保存
				</Link>
			</section>
			<WalletPanel />
			<BabyCoinGrowthPanel />
			<NotebookPanel />
		</section>
	);
}
