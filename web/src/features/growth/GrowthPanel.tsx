import { type ReactNode, useEffect, useState } from "react";

import { StarBuddy } from "../../components/StarBuddy";
import {
	firstJourneyProgress,
	GROWTH_ACTIVITIES,
	growthStageLabel,
	type GrowthActivityId,
	type GrowthStageName,
} from "./growthModel";
import { useGrowth } from "./useGrowth";

const EXPLORER_TX_BASE = "https://sepolia.etherscan.io/tx/";
const RANDOM_STATE_DISCLAIMER =
	"这是随机游戏状态，不代表真实婴儿的饥饿、睡眠或活动需求。";

const COOLDOWN_COPY: Record<GrowthActivityId, string> = {
	meal: "星宝现在还不饿",
	walk: "星宝正在休息",
	read: "星宝还在回味故事",
};

function ActivityIllustration({ activityId }: { activityId: GrowthActivityId }) {
	if (activityId === "meal") {
		return (
			<svg viewBox="0 0 40 40" focusable="false">
				<path d="M9 16h22a10 10 0 01-22 0z" fill="none" />
				<path d="M15 11v6M20 9v8M25 11v6" fill="none" strokeLinecap="round" />
				<path d="M8 16h24" />
			</svg>
		);
	}
	if (activityId === "walk") {
		return (
			<svg viewBox="0 0 40 40" focusable="false">
				<path d="M20 29c0-8 5-13 10-16-1 10-4 15-10 16z" />
				<path d="M20 29c0-9-5-14-10-17 0 10 3 15 10 17z" />
				<path d="M20 29v-14" fill="none" strokeLinecap="round" />
			</svg>
		);
	}
	return (
		<svg viewBox="0 0 40 40" focusable="false">
			<path d="M10 11h12a5 5 0 015 5v13H10z" fill="none" />
			<path d="M13 14h11M13 18h9M13 22h12" fill="none" strokeLinecap="round" />
			<path d="M27 11l4 2v16l-4-2z" />
		</svg>
	);
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
	const isPending =
		growth.phase === "awaiting-signature" || growth.phase === "confirming";

	useEffect(() => {
		if (growth.phase === "idle" || growth.phase === "reading") {
			setActiveActivityId(undefined);
		}
	}, [growth.phase]);

	return (
		<section className="story-card growth-panel" aria-labelledby="growth-heading">
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
								{progress.complete ? "首轮养成已完成" : `${progress.current} / 15`}
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
					const recorded = growth.todayByActivity?.[activity.id] === true;
					const isActiveCard = activeActivityId === activity.id;
					const canAct =
						growth.walletState === "ready" &&
						growth.phase === "idle" &&
						recorded !== true;

					let cardClassName = "activity-card";
					let statusMessage =
						"活动可领取时才会显示记录按钮，不显示任何倒计时。";
					let button: ReactNode = null;

					if (growth.phase === "reading") {
						cardClassName += " activity-card--loading";
						statusMessage = "正在读取星宝状态";
					} else if (growth.phase === "read-error") {
						cardClassName += " activity-card--error";
						statusMessage = growth.message ?? "读取成长状态失败，请重试。";
					} else if (recorded) {
						cardClassName += " activity-card--cooldown";
						statusMessage = COOLDOWN_COPY[activity.id];
					} else if (isActiveCard && growth.phase === "awaiting-signature") {
						cardClassName += " activity-card--pending";
						statusMessage = growth.message ?? "请在 MetaMask 中确认";
						button = (
							<button
								type="button"
								className="button button--primary"
								disabled
							>
								记录这次陪伴
							</button>
						);
					} else if (isActiveCard && growth.phase === "confirming") {
						cardClassName += " activity-card--pending";
						statusMessage = growth.message ?? "交易已提交，正在等待链上确认";
						button = (
							<button
								type="button"
								className="button button--primary"
								disabled
							>
								记录这次陪伴
							</button>
						);
					} else if (isActiveCard && growth.phase === "write-error") {
						cardClassName += " activity-card--error";
						statusMessage = growth.message ?? "本次记录失败，积分没有变化。";
						button = (
							<button
								type="button"
								className="button button--primary"
								onClick={() => {
									setActiveActivityId(activity.id);
									void growth.recordActivity(activity.id);
								}}
							>
								记录这次陪伴
							</button>
						);
					} else if (canAct) {
						cardClassName += " activity-card--available";
						statusMessage = `本次奖励 +${activity.reward} 成长星`;
						button = (
							<button
								type="button"
								className="button button--primary"
								onClick={() => {
									setActiveActivityId(activity.id);
									void growth.recordActivity(activity.id);
								}}
							>
								记录这次陪伴
							</button>
						);
					} else if (growth.walletState !== "ready" || isPending) {
						cardClassName += " activity-card--muted";
						statusMessage =
							"先在上方连接 Sepolia 测试钱包，再读取活动状态。";
					}

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
							<p className="activity-card__description">{activity.description}</p>
							<p className="activity-card__status">{statusMessage}</p>
							<div className="activity-card__actions">{button}</div>
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
