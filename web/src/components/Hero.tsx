import { growthStageLabel, type GrowthStageName } from "../features/growth/growthModel";
import { StarBuddy } from "./StarBuddy";
import { BrandMark } from "./BrandMark";

const HERO_STAGES: GrowthStageName[] = ["egg", "sprout", "explorer", "star"];

export function Hero() {
	return (
		<section className="story-card hero-panel" aria-labelledby="hero-heading">
			<div className="hero-panel__copy">
				<div className="brand-lockup">
					<BrandMark />
					<div>
						<p className="hero-panel__eyebrow">课程概念验证 · Sepolia 测试网</p>
						<h1 id="hero-heading">BabySteps · 成长星球</h1>
					</div>
				</div>
				<p className="hero-panel__lead">
					记录一件小小的陪伴，让原创虚拟伙伴“星宝”在测试链上慢慢长大。
				</p>
				<p className="hero-panel__value">
					成长星无价格，只用于 Sepolia 课程演示；可在测试钱包间赠送，不可兑换。
				</p>
				<ul className="hero-panel__chips" aria-label="课程演示边界">
					<li>公开链上便签</li>
					<li>双账本成长星</li>
					<li>测试钱包间赠送</li>
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
