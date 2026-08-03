import { WalletPanel } from "./components/WalletPanel";
import { GrowthPanel } from "./features/growth/GrowthPanel";
import { NotebookPanel } from "./features/notebook/NotebookPanel";

export default function App() {
	return (
		<main className="page-shell">
			<header className="hero">
				<div className="hero__copy">
					<p className="eyebrow hero__eyebrow">课程概念验证 · Sepolia 测试网</p>
					<h1>BabySteps · 成长星球</h1>
					<p className="hero__lead">
						记录一件小小的陪伴，让原创虚拟伙伴“星宝”在测试链上慢慢长大。
					</p>
					<p className="value-warning">成长星无价格，不可转让或兑换。</p>
				</div>
				<div className="hero__orbit" aria-hidden="true">
					<span>3</span>
					<span>5</span>
					<span>7</span>
				</div>
			</header>

			<section className="safety-grid" aria-label="使用前须知">
				<article>
					<strong>公链长期公开</strong>
					<p>
						钱包、活动、交易时间和积分变化可被长期查看。请只使用专用测试钱包。
					</p>
				</article>
				<article>
					<strong>只记录活动类别</strong>
					<p>这是成年照护者自报的陪伴记录，不是活动真实性或育儿质量证明。</p>
				</article>
				<article>
					<strong>不采集儿童资料</strong>
					<p>
						请勿填写或上传儿童姓名、照片、生日、学校、位置、健康或疫苗信息。
					</p>
				</article>
			</section>

			<WalletPanel />
			<GrowthPanel />
			<NotebookPanel />

			<footer className="course-notes">
				<h2>这份作业展示了什么？</h2>
				<ul>
					<li>React + wagmi 连接 MetaMask，并把合约作为数据后端。</li>
					<li>Hardhat 开发、测试和部署同一份 Solidity 0.8.28 合约。</li>
					<li>交易哈希只代表广播；receipt 成功后才刷新链上状态。</li>
					<li>成长星和星宝都只用于 Sepolia 课程演示，不是 Token 或 NFT。</li>
				</ul>
			</footer>
		</main>
	);
}
