import {
	type GrowthStageName,
	growthStageLabel,
} from "../features/growth/growthModel";
import { BrandMark } from "./BrandMark";
import { StarBuddy } from "./StarBuddy";

const HERO_STAGES: GrowthStageName[] = ["egg", "sprout", "explorer", "star"];

export function Hero() {
	return (
		<section className="story-card hero-panel" aria-labelledby="hero-heading">
			<div className="hero-panel__copy">
				<div className="brand-lockup">
					<BrandMark />
					<div>
						<p className="hero-panel__eyebrow">
							中国 + 日本 · 海外亲子社交构想
						</p>
						<h1 id="hero-heading">BabySteps · 成长星球</h1>
					</div>
				</div>
				<p className="hero-panel__lead">
					从一次三分钟的亲子陪伴开始，记录成长，为未来连接同阶段家庭打下基础。
				</p>
				<p className="hero-panel__value">
					访客无需注册即可体验；需要长期保存、家庭协作或领取权益时，再使用
					Google 或邮箱登录。
				</p>
				<ul className="hero-panel__chips" aria-label="亲子体验价值">
					<li>三分钟开始</li>
					<li>低敏成长记录</li>
					<li>中国 + 日本试点构想</li>
				</ul>
			</div>

			<div className="hero-showcase" aria-hidden="true">
				<div className="hero-showcase__buddy">
					<StarBuddy stage="explorer" />
				</div>
				<ul className="hero-stage-trail">
					{HERO_STAGES.map((stage) => (
						<li key={stage}>
							<span className="hero-stage-trail__dot" />
							<span>{growthStageLabel(stage)}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
