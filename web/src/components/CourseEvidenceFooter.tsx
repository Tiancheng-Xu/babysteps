const EVIDENCE_POINTS = [
	"React + wagmi 连接 MetaMask，并把合约作为数据后端。",
	"Hardhat 开发、测试和部署同一份 Solidity 0.8.28 合约。",
	"交易哈希只代表广播；receipt 成功后才刷新链上状态。",
	"累计养成值与可赠送成长星分开；成长星不是 Token 或 NFT。",
] as const;

export function CourseEvidenceFooter() {
	return (
		<footer className="course-evidence">
			<div className="story-card course-evidence__shell">
				<div className="course-evidence__copy">
					<h2>这份作业展示了什么？</h2>
					<ul className="course-evidence__list">
						{EVIDENCE_POINTS.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
				<div className="course-evidence__card">
					<p className="course-evidence__card-title">课程验收要点</p>
					<p>
						页面保留了公开链上便签、双账本成长、测试链赠送、钱包网络识别和
						transaction receipt 成功后再刷新的课程关键证据。
					</p>
				</div>
			</div>
		</footer>
	);
}
