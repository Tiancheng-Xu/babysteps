import type { ProductView } from "../routing/routeDefinitions";

const EVIDENCE_POINTS = [
	"React + wagmi 连接 MetaMask，并把合约作为数据后端。",
	"Hardhat 开发、测试和部署同一份 Solidity 0.8.28 合约。",
	"交易哈希只代表广播；receipt 成功后才刷新链上状态。",
	"累计养成值与可赠送成长星分开；成长星不是 Token 或 NFT。",
] as const;

const PORTFOLIO_URL = "https://baby2b.online/";
const PROJECT_URL = "https://babysteps.baby2b.online/";
const EVIDENCE_URL = "https://evidence.baby2b.online/babysteps/";

export function CourseEvidenceFooter({
	currentView,
}: {
	currentView: ProductView | "not-found";
}) {
	const isEvidenceView = currentView === "evidence";

	return (
		<footer className="course-evidence">
			{currentView === "home" ? (
				<div className="story-card course-evidence__shell">
					<div className="course-evidence__copy">
						<h2>核心技术能力</h2>
						<ul className="course-evidence__list">
							{EVIDENCE_POINTS.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</div>
					<div className="course-evidence__card">
						<p className="course-evidence__card-title">链上交互说明</p>
						<p>
							页面覆盖公开链上便签、双账本成长、测试链赠送、钱包网络识别和
							transaction receipt 成功后再刷新的完整链上交互闭环。
						</p>
						<p>
							<a
								href="https://sepolia.etherscan.io/address/0xeb7216D50a2708a59fef5322e452e34382aFCDaD#code"
								target="_blank"
								rel="noreferrer"
								className="explorer-link"
							>
								Sepolia 源码验证地址
							</a>
						</p>
					</div>
				</div>
			) : null}
			<div className="site-footer">
				<nav
					className="site-footer__navigation"
					aria-label="作品与工作证明导航"
				>
					<a href={PORTFOLIO_URL}>作品集首页</a>
					<a
						href={PROJECT_URL}
						aria-current={isEvidenceView ? undefined : "page"}
					>
						项目主页
					</a>
					<a
						href={EVIDENCE_URL}
						aria-current={isEvidenceView ? "page" : undefined}
					>
						工作证明
					</a>
				</nav>
				<a className="site-footer__evidence-link" href={EVIDENCE_URL}>
					查看完整工作证明
				</a>
			</div>
		</footer>
	);
}
