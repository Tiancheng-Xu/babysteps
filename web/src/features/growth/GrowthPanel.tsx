import { useEffect, useState } from "react";

import { StarBuddy } from "../../components/StarBuddy";
import {
	type ActivityVisualState,
	resolveActivityVisualState,
} from "./activityVisualState";
import {
	firstJourneyProgress,
	GROWTH_ACTIVITIES,
	type GrowthActivityId,
	type GrowthStageName,
	growthStageLabel,
} from "./growthModel";
import { useGrowth } from "./useGrowth";

const EXPLORER_TX_BASE = "https://sepolia.etherscan.io/tx/";
const RANDOM_STATE_DISCLAIMER =
	"这是随机游戏状态，不代表真实婴儿的饥饿、睡眠或活动需求。";

function ActivityIllustration({
	activityId,
}: {
	activityId: GrowthActivityId;
}) {
	if (activityId === "meal") {
		return (
			<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
				<path d="M9 16h22a10 10 0 01-22 0z" fill="none" />
				<path d="M15 11v6M20 9v8M25 11v6" fill="none" strokeLinecap="round" />
				<path d="M8 16h24" />
			</svg>
		);
	}
	if (activityId === "walk") {
		return (
			<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
				<path d="M20 29c0-8 5-13 10-16-1 10-4 15-10 16z" />
				<path d="M20 29c0-9-5-14-10-17 0 10 3 15 10 17z" />
				<path d="M20 29v-14" fill="none" strokeLinecap="round" />
			</svg>
		);
	}
	return (
		<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
			<path d="M10 11h12a5 5 0 015 5v13H10z" fill="none" />
			<path d="M13 14h11M13 18h9M13 22h12" fill="none" strokeLinecap="round" />
			<path d="M27 11l4 2v16l-4-2z" />
		</svg>
	);
}

function activityCardClassName(state: ActivityVisualState) {
	if (state === "cooldown" || state === "daily-limit") {
		return "activity-card activity-card--cooldown";
	}
	if (state === "loading") {
		return "activity-card activity-card--loading";
	}
	if (state === "awaiting-signature" || state === "confirming") {
		return "activity-card activity-card--pending";
	}
	if (
		state === "read-error" ||
		state === "rejected" ||
		state === "write-error"
	) {
		return "activity-card activity-card--error";
	}
	return "activity-card activity-card--available";
}

export function GrowthPanel() {
	const growth = useGrowth();
	const [activeActivityId, setActiveActivityId] = useState<
		GrowthActivityId | undefined
	>(undefined);
	const visibleStage: GrowthStageName = growth.stage ?? "egg";
	const progress = firstJourneyProgress(growth.points ?? 0n);
	const hasChainState =
		growth.points !== undefined && growth.stage !== undefined;
	const isError =
		growth.phase === "read-error" || growth.phase === "write-error";

	useEffect(() => {
		if (growth.phase === "idle" || growth.phase === "reading") {
			setActiveActivityId(undefined);
		}
	}, [growth.phase]);

	return (
		<section
			className="story-card growth-panel"
			aria-labelledby="growth-heading"
		>
			<div className="story-card__header">
				<div>
					<h2 id="growth-heading">步骤 2 · 虚拟伙伴养成</h2>
					<h3 className="story-card__title">陪伴变成星宝的成长能量</h3>
				</div>
			</div>

			<div className="growth-shell">
				<div className="growth-stage-card">
					<StarBuddy stage={visibleStage} />
					<p className="growth-stage-card__label">
						当前阶段：{growthStageLabel(visibleStage)}
					</p>
				</div>

				<div className="growth-summary-card">
					<div className="metric-grid">
						<article className="metric-tile">
							<p className="metric-tile__label">累计养成值</p>
							<p className="metric-tile__value">
								{hasChainState ? growth.points?.toString() : "连接后读取"}
							</p>
						</article>
						<article className="metric-tile metric-tile--warm">
							<p className="metric-tile__label">首轮进度</p>
							<p className="metric-tile__value metric-tile__value--compact">
								{progress.complete
									? "首轮养成已完成"
									: `${progress.current} / 15`}
							</p>
						</article>
					</div>

					<div
						className="progress-track"
						role="progressbar"
						aria-label="星宝首轮养成进度"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={progress.percent}
					>
						<span style={{ width: `${progress.percent}%` }} />
					</div>

					<p className="helper-copy">
						累计养成值只来自当前钱包记录的活动，不因赠送而减少，也不代表孩子的发育或表现等级。
					</p>
					<p className="disclaimer-banner">{RANDOM_STATE_DISCLAIMER}</p>
				</div>
			</div>

			<section className="activity-grid" aria-label="今日陪伴活动">
				{GROWTH_ACTIVITIES.map((activity) => {
					const isActiveCard = activeActivityId === activity.id;
					const visualState = resolveActivityVisualState({
						activityId: activity.id,
						availability: growth.availabilityByActivity?.[activity.id],
						isActive: isActiveCard,
						message: growth.message,
						phase: growth.phase,
						walletReady: growth.walletState === "ready",
					});
					const cardClassName = activityCardClassName(visualState.state);

					return (
						<article className={cardClassName} key={activity.id}>
							<div className="activity-card__topline">
								<div className="activity-card__icon" aria-hidden="true">
									<ActivityIllustration activityId={activity.id} />
								</div>
								<span className="activity-card__reward">
									+{activity.reward} 成长星
								</span>
							</div>
							<h4>{activity.title}</h4>
							<p className="activity-card__description">
								{activity.description}
							</p>
							<p className="activity-card__status">
								{visualState.statusMessage}
							</p>
							<div className="activity-card__actions">
								{visualState.showButton ? (
									<button
										type="button"
										className="button button--primary"
										disabled={visualState.buttonDisabled}
										onClick={() => {
											setActiveActivityId(activity.id);
											void growth.recordActivity(activity.id);
										}}
									>
										记录这次陪伴
									</button>
								) : null}
							</div>
						</article>
					);
				})}
			</section>

			{growth.message ? (
				<div
					className={
						isError
							? "transaction-panel transaction-panel--error"
							: "transaction-panel"
					}
					role={isError ? "alert" : "status"}
					aria-live="polite"
				>
					<p>{growth.message}</p>
					{growth.phase === "read-error" ? (
						<button
							type="button"
							className="button button--secondary"
							onClick={() => void growth.retryRead()}
						>
							重试读取成长状态
						</button>
					) : null}
				</div>
			) : null}

			{growth.transactionHash ? (
				<a
					className="explorer-link"
					href={`${EXPLORER_TX_BASE}${growth.transactionHash}`}
					target="_blank"
					rel="noreferrer"
				>
					查看链上交易
				</a>
			) : null}
		</section>
	);
}
