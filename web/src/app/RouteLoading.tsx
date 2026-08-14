export function RouteLoading() {
	return (
		<section className="story-card" aria-live="polite" aria-busy="true">
			<p className="eyebrow">正在加载</p>
			<h1>正在准备这个页面</h1>
			<p>公开首屏保持可阅读，钱包和链上交互将在浏览器中继续加载。</p>
		</section>
	);
}
