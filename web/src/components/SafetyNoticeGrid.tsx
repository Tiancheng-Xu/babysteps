const SAFETY_NOTICES = [
	{
		title: "公链长期公开",
		body: "钱包、活动、交易时间和积分变化可被长期查看，请只用专用测试钱包。",
		icon: "public",
	},
	{
		title: "只记录活动类别",
		body: "这是成年照护者自报选择，不能证明现实活动真实发生或育儿质量。",
		icon: "category",
	},
	{
		title: "不采集儿童资料",
		body: "不要填写或上传儿童姓名、照片、生日、学校、位置、健康或疫苗信息。",
		icon: "shield",
	},
] as const;

function SafetyIcon({ kind }: { kind: (typeof SAFETY_NOTICES)[number]["icon"] }) {
	if (kind === "category") {
		return (
			<svg viewBox="0 0 32 32" focusable="false">
				<rect x="5" y="7" width="10" height="8" rx="2" />
				<rect x="17" y="7" width="10" height="8" rx="2" />
				<rect x="5" y="17" width="10" height="8" rx="2" />
				<rect x="17" y="17" width="10" height="8" rx="2" />
			</svg>
		);
	}
	if (kind === "shield") {
		return (
			<svg viewBox="0 0 32 32" focusable="false">
				<path d="M16 5l9 4v7c0 6-4 9-9 11-5-2-9-5-9-11V9z" />
				<path d="M12 16l3 3 6-7" fill="none" strokeLinecap="round" />
			</svg>
		);
	}
	return (
		<svg viewBox="0 0 32 32" focusable="false">
			<circle cx="16" cy="16" r="10" fill="none" />
			<path d="M6 16h20M16 6a16 16 0 010 20M16 6a16 16 0 000 20" fill="none" />
		</svg>
	);
}

export function SafetyNoticeGrid() {
	return (
		<section className="safety-grid" aria-label="使用前须知">
			{SAFETY_NOTICES.map((notice) => (
				<article className="story-card safety-card" key={notice.title}>
					<div className="safety-card__icon" aria-hidden="true">
						<SafetyIcon kind={notice.icon} />
					</div>
					<strong>{notice.title}</strong>
					<p>{notice.body}</p>
				</article>
			))}
		</section>
	);
}
