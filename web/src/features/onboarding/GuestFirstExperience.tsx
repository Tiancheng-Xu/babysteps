import { useState } from "react";
import { Link } from "react-router-dom";

import {
	BABY_STAGE_OPTIONS,
	type BabyStage,
	CITY_OPTIONS,
	clearGuestJourney,
	guestTaskFor,
	loadGuestJourney,
	MARKET_OPTIONS,
	saveGuestJourney,
	type TrialCity,
	type TrialMarket,
} from "./guestJourney";

export function GuestFirstExperience() {
	const [journey, setJourney] = useState(loadGuestJourney);
	const [stage, setStage] = useState<BabyStage>(journey?.stage ?? "newborn");
	const [market, setMarket] = useState<TrialMarket>(journey?.market ?? "china");
	const [city, setCity] = useState<TrialCity>(journey?.city ?? "ningbo");
	const task = journey ? guestTaskFor(journey.stage) : undefined;

	function changeMarket(nextMarket: TrialMarket) {
		setMarket(nextMarket);
		setCity(CITY_OPTIONS[nextMarket][0].value);
	}

	function startJourney() {
		const nextJourney = {
			version: 1,
			stage,
			market,
			city,
			taskId: guestTaskFor(stage).id,
			status: "started",
			startedAt: new Date().toISOString(),
		} as const;
		saveGuestJourney(nextJourney);
		setJourney(nextJourney);
	}

	function completeJourney() {
		if (!journey) return;
		const nextJourney = { ...journey, status: "completed" } as const;
		saveGuestJourney(nextJourney);
		setJourney(nextJourney);
	}

	function restartJourney() {
		clearGuestJourney();
		setJourney(undefined);
	}

	return (
		<section
			className="guest-experience"
			aria-labelledby="guest-experience-heading"
		>
			<div className="guest-experience__intro">
				<p className="section-kicker">3 MINUTES · NO ACCOUNT REQUIRED</p>
				<h2 id="guest-experience-heading">先陪伴三分钟，再决定是否加入</h2>
				<p>
					无需登录，也无需连接钱包。只选择粗粒度阶段和城市，不填写宝宝姓名、生日或精确位置。
				</p>
			</div>

			{journey && task ? (
				<article className="guest-task-card">
					<div className="guest-task-card__heading">
						<span>为你推荐 · {task.durationMinutes} 分钟</span>
						<strong>
							{journey.status === "completed" ? "本地已完成" : "陪伴进行中"}
						</strong>
					</div>
					<h3>{task.title}</h3>
					<p>{task.description}</p>
					<ol>
						{task.steps.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>
					{journey.status === "completed" ? (
						<p className="guest-task-card__status" role="status">
							已完成，记录仅保存在当前浏览器。
						</p>
					) : (
						<button
							className="button button--primary"
							type="button"
							onClick={completeJourney}
						>
							完成本次陪伴
						</button>
					)}
					<div className="guest-task-card__actions">
						<Link className="button button--secondary" to="/profile">
							登录后长期保存
						</Link>
						<button
							className="button button--quiet"
							type="button"
							onClick={restartJourney}
						>
							重新选择
						</button>
					</div>
				</article>
			) : (
				<form
					className="guest-experience__form"
					onSubmit={(event) => {
						event.preventDefault();
						startJourney();
					}}
				>
					<label>
						<span>宝宝阶段</span>
						<select
							value={stage}
							onChange={(event) => setStage(event.target.value as BabyStage)}
						>
							{BABY_STAGE_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>体验地区</span>
						<select
							value={market}
							onChange={(event) =>
								changeMarket(event.target.value as TrialMarket)
							}
						>
							{MARKET_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>城市</span>
						<select
							value={city}
							onChange={(event) => setCity(event.target.value as TrialCity)}
						>
							{CITY_OPTIONS[market].map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<button className="button button--primary" type="submit">
						开始 3 分钟陪伴
					</button>
				</form>
			)}
		</section>
	);
}
