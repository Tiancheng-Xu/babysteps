import { Link } from "react-router-dom";

import { Hero } from "../components/Hero";
import { SafetyNoticeGrid } from "../components/SafetyNoticeGrid";
import type { RouteDefinition } from "../routing/routeDefinitions";

const PUBLIC_SUMMARIES: Partial<Record<RouteDefinition["view"], string>> = {
	marketplace:
		"浏览机构与育婴师发布的成长任务。登录与链上数据将在页面激活后加载。",
	keepsakes:
		"使用可转送成长星抽取随机纪念卡，并通过融合升级收藏；链上状态将在页面激活后读取。",
	evidence:
		"这里汇总架构、关键时序、测试、部署与链上验证证据。完整交互将在页面激活后加载。",
};

export function ServerRouteShell({ route }: { route: RouteDefinition }) {
	if (route.view === "home") {
		return (
			<>
				<Hero />
				<SafetyNoticeGrid />
				<section className="story-card" aria-labelledby="ssr-home-heading">
					<p className="eyebrow">边缘首屏已就绪</p>
					<h2 id="ssr-home-heading">连接测试钱包后继续链上成长</h2>
					<p>账户、余额、签名和交易只在浏览器中读取，不进入服务端 HTML。</p>
				</section>
			</>
		);
	}

	return (
		<section className="story-card" aria-labelledby="server-route-heading">
			<p className="eyebrow">
				{route.renderPolicy === "public" ? "公开内容" : "安全客户端区域"}
			</p>
			<h1 id="server-route-heading">{route.heading}</h1>
			<p>
				{PUBLIC_SUMMARIES[route.view] ??
					"此页面的身份、钱包和实时链上数据只在浏览器中加载，服务端不会保存或输出个人状态。"}
			</p>
		</section>
	);
}

export function NotFoundPage() {
	return (
		<section className="story-card" aria-labelledby="not-found-heading">
			<p className="eyebrow">404</p>
			<h1 id="not-found-heading">页面没有找到</h1>
			<p>这个地址不属于 BabySteps，可能已经移动或输入有误。</p>
			<Link className="primary-link" to="/">
				返回首页
			</Link>
		</section>
	);
}
