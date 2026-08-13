import { useState } from "react";

import { StarBuddy } from "../../components/StarBuddy";
import {
	firstJourneyProgress,
	GROWTH_ACTIVITIES,
	type GrowthActivityId,
	growthStageLabel,
} from "../growth/growthModel";
import { formatBabyCoinAmount } from "./formatBabyCoinAmount";
import { useBabyCoinGrowth } from "./useBabyCoinGrowth";

const EXPLORER_TX_BASE = "https://sepolia.etherscan.io/tx/";
const TOKEN_UNIT = 10n ** 18n;

type BabyCoinMetricProps = {
	id: string;
	label: string;
	note: string;
	value: bigint | undefined;
	warm?: boolean;
};

function BabyCoinMetric({ id, label, note, value, warm }: BabyCoinMetricProps) {
	const formatted = formatBabyCoinAmount(value);
	const exactLabel = formatted.exact
		? `完整链上数值 ${formatted.exact} BABY`
		: undefined;

	return (
		<article
			className={warm ? "metric-tile metric-tile--warm" : "metric-tile"}
			aria-labelledby={`${id}-label`}
		>
			<h3 className="metric-tile__label" id={`${id}-label`}>
				{label}
			</h3>
			<p className="metric-tile__value" title={exactLabel} aria-live="polite">
				<span className="metric-tile__number">{formatted.display}</span>
				<span className="metric-tile__unit" translate="no">
					BABY
				</span>
				{formatted.isApproximate && exactLabel ? (
					<span className="visually-hidden">{exactLabel}</span>
				) : null}
			</p>
			<p className="metric-tile__note">
				{value === undefined ? "连接 Sepolia 钱包后读取。" : note}
			</p>
		</article>
	);
}

function activityStatus(
	activityId: GrowthActivityId,
	growth: ReturnType<typeof useBabyCoinGrowth>,
) {
	if (!growth.isConfigured) return "等待 Sepolia 合约部署";
	if (growth.walletState !== "ready") return "连接 Sepolia 钱包后可记录";
	const availability = growth.availabilityByActivity?.[activityId];
	if (!availability) return "正在读取链上额度";
	if (availability.dailyLimitReached) return "今天已达到领取上限";
	if (!availability.available) return "随机冷却中，稍后再试";
	return "当前可记录并领取 BABY";
}

export function BabyCoinGrowthPanel() {
	const growth = useBabyCoinGrowth();
	const [activeActivity, setActiveActivity] = useState<GrowthActivityId>();
	const lifetimeWhole = (growth.lifetimeEarned ?? 0n) / TOKEN_UNIT;
	const progress = firstJourneyProgress(lifetimeWhole);
	const stage = growth.stage ?? "egg";
	const isError =
		growth.phase === "read-error" || growth.phase === "write-error";

	return (
		<section
			className="story-card growth-panel"
			aria-labelledby="babycoin-growth-heading"
		>
			<div className="story-card__header">
				<div>
					<p className="product-page__eyebrow">BabyCoin 成长面板</p>
					<h2 id="babycoin-growth-heading">链上成长与可用余额</h2>
				</div>
			</div>

			<div className="growth-shell">
				<div className="growth-stage-card">
					<StarBuddy stage={stage} />
					<p className="growth-stage-card__label">
						当前阶段：{growthStageLabel(stage)}
					</p>
				</div>

				<div className="growth-summary-card">
					<div className="metric-grid">
						<BabyCoinMetric
							id="spendable-babycoin"
							label="可用 BabyCoin"
							note="可用于购买和转账，消费后会减少。"
							value={growth.balance}
						/>
						<BabyCoinMetric
							id="lifetime-babycoin"
							label="累计成长奖励"
							note="决定星宝阶段，只增不减。"
							value={growth.lifetimeEarned}
							warm
						/>
					</div>

					<div
						className="progress-track"
						role="progressbar"
						aria-label="BabyCoin 首轮成长进度"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={progress.percent}
					>
						<span style={{ width: `${progress.percent}%` }} />
					</div>
					<p className="helper-copy">
						只有完成成长活动获得的 BABY
						会增加累计奖励和星宝阶段；转账、测试铸币与购买不会增加。
					</p>
					<p className="disclaimer-banner">
						消费或转出 BABY 会减少可用余额，但不会降低已经解锁的成长阶段。
					</p>
				</div>
			</div>

			<section className="activity-grid" aria-label="BabyCoin 成长活动">
				{GROWTH_ACTIVITIES.map((activity) => {
					const availability = growth.availabilityByActivity?.[activity.id];
					const isActive = activeActivity === activity.id;
					const canRecord =
						growth.phase !== "awaiting-signature" &&
						growth.phase !== "confirming" &&
						availability?.available === true;
					return (
						<article
							className={
								availability?.available
									? "activity-card activity-card--available"
									: "activity-card activity-card--cooldown"
							}
							key={activity.id}
						>
							<div className="activity-card__topline">
								<span className="activity-card__reward">
									+{activity.reward} BABY
								</span>
							</div>
							<h3>{activity.title}</h3>
							<p className="activity-card__description">
								{activity.description}
							</p>
							<p className="activity-card__status">
								{isActive && growth.isPending
									? growth.message
									: activityStatus(activity.id, growth)}
							</p>
							<div className="activity-card__actions">
								<button
									type="button"
									className="button button--primary"
									disabled={!canRecord}
									onClick={() => {
										setActiveActivity(activity.id);
										void growth.recordActivity(activity.id);
									}}
								>
									记录并领取
								</button>
							</div>
						</article>
					);
				})}
			</section>

			{growth.walletState === "wrong-network" ? (
				<button
					type="button"
					className="button button--secondary"
					onClick={() => void growth.switchToSepolia()}
				>
					切换到 Sepolia
				</button>
			) : null}

			{growth.message && !growth.isPending ? (
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
							重试读取
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
					查看 BabyCoin 活动交易
				</a>
			) : null}
		</section>
	);
}
