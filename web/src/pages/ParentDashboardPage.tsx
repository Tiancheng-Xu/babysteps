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
					<p className="product-page__eyebrow">成年照护者专用</p>
					<h1 id="parent-dashboard-heading">家长成长中心</h1>
					<p>
						在一个地方查看星宝成长、BabyCoin 余额、成长任务购买与公开链上记录。
					</p>
				</div>
				<div className="parent-stage-seal" aria-hidden="true">
					<span>★</span>
					<small>StarBuddy</small>
				</div>
			</header>
			<WalletPanel />
			<BabyCoinGrowthPanel />
			<NotebookPanel />
		</section>
	);
}
