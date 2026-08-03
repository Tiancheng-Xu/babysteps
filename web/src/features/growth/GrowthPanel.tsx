import { StarBuddy } from "../../components/StarBuddy";
import {
	firstJourneyProgress,
	GROWTH_ACTIVITIES,
	type GrowthStageName,
} from "./growthModel";
import { useGrowth } from "./useGrowth";

const EXPLORER_TX_BASE = "https://sepolia.etherscan.io/tx/";

export function GrowthPanel() {
	const growth = useGrowth();
	const visibleStage: GrowthStageName = growth.stage ?? "egg";
	const progress = firstJourneyProgress(growth.points ?? 0n);
	const hasChainState =
		growth.points !== undefined && growth.stage !== undefined;
	const isError =
		growth.phase === "read-error" || growth.phase === "write-error";

	return (
		<section className="card growth-panel" aria-labelledby="growth-heading">
			<div className="section-heading">
				<div>
					<p className="eyebrow">步骤 2 · 虚拟伙伴养成</p>
					<h2 id="growth-heading">陪伴变成星宝的成长能量</h2>
				</div>
				<span className="reset-pill">北京时间 00:00 更新</span>
			</div>

			<div className="growth-summary">
				<StarBuddy stage={visibleStage} />
				<div className="growth-meter">
					<p className="points-total">
						{hasChainState
							? `累计养成值：${growth.points?.toString()}`
							: "连接后读取累计养成值"}
					</p>
					<p className="progress-copy">
						{progress.complete
							? "首轮养成已完成"
							: `首轮进度 ${progress.current} / 15`}
					</p>
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
				</div>
			</div>

			<section className="activity-grid" aria-label="今日陪伴活动">
				{GROWTH_ACTIVITIES.map((activity) => {
					const recorded = growth.todayByActivity?.[activity.id] === true;
					const disabled =
						growth.walletState !== "ready" || growth.isPending || recorded;
					return (
						<article
							className={
								recorded ? "activity-card activity-card--done" : "activity-card"
							}
							key={activity.id}
						>
							<div className="activity-card__icon" aria-hidden="true">
								{activity.id === "meal"
									? "🥣"
									: activity.id === "walk"
										? "🌿"
										: "📖"}
							</div>
							<h3>{activity.title}</h3>
							<p>{activity.description}</p>
							<strong>+{activity.reward} 成长星</strong>
							<button
								type="button"
								className="button button--activity"
								disabled={disabled}
								aria-label={
									recorded
										? `${activity.title}今天已记录`
										: `记录${activity.title}，获得 ${activity.reward} 枚成长星`
								}
								onClick={() => void growth.recordActivity(activity.id)}
							>
								{recorded ? "今天已记录" : "记录这次陪伴"}
							</button>
						</article>
					);
				})}
			</section>

			{growth.message ? (
				<div
					className={
						isError
							? "transaction-state transaction-state--error"
							: "transaction-state"
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
