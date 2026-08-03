import {
	type GrowthStageName,
	growthStageLabel,
} from "../features/growth/growthModel";

type StarBuddyProps = {
	stage: GrowthStageName;
};

export function StarBuddy({ stage }: StarBuddyProps) {
	const isEggLike = stage === "egg" || stage === "sprout";
	const isAwake = stage !== "egg";
	const isExplorer = stage === "explorer" || stage === "star";
	const isStar = stage === "star";

	return (
		<figure
			className={`star-buddy star-buddy--${stage}`}
			data-stage={stage}
			role="img"
			aria-label={growthStageLabel(stage)}
		>
			<div className="star-buddy__halo" aria-hidden="true" />
			<svg viewBox="0 0 280 260" aria-hidden="true" focusable="false">
				<defs>
					<linearGradient id="buddy-body" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="#FFF7D1" />
						<stop offset="1" stopColor="#F3B769" />
					</linearGradient>
					<filter
						id="buddy-shadow"
						x="-35%"
						y="-35%"
						width="170%"
						height="180%"
					>
						<feDropShadow
							dx="0"
							dy="10"
							stdDeviation="10"
							floodOpacity="0.16"
						/>
					</filter>
				</defs>

				<ellipse
					cx="140"
					cy="236"
					rx="84"
					ry="16"
					fill="#173B4D"
					opacity="0.12"
				/>

				{isEggLike ? (
					<path
						d="M140 34c35 0 62 34 62 81 0 47-28 80-62 80s-62-33-62-80c0-47 27-81 62-81z"
						fill="url(#buddy-body)"
						filter="url(#buddy-shadow)"
						stroke="#173B4D"
						strokeWidth="4"
					/>
				) : (
					<path
						d="M140 27c12 25 24 33 52 37-19 16-26 33-20 58 2 9 8 22 14 36-23-7-38-3-46 12-8-15-23-19-46-12 6-14 12-27 14-36 6-25-1-42-20-58 28-4 40-12 52-37z"
						fill="url(#buddy-body)"
						filter="url(#buddy-shadow)"
						stroke="#173B4D"
						strokeLinejoin="round"
						strokeWidth="4"
					/>
				)}

				{isAwake ? (
					<g className="star-buddy__face">
						<circle cx="118" cy="112" r="6" fill="#173B4D" />
						<circle cx="162" cy="112" r="6" fill="#173B4D" />
						<path
							d="M125 132q15 12 30 0"
							fill="none"
							stroke="#173B4D"
							strokeLinecap="round"
							strokeWidth="5"
						/>
						<circle cx="99" cy="128" r="8" fill="#F38E79" opacity="0.4" />
						<circle cx="181" cy="128" r="8" fill="#F38E79" opacity="0.4" />
					</g>
				) : (
					<g className="star-buddy__face">
						<path
							d="M109 113q8-7 16 0M155 113q8-7 16 0"
							fill="none"
							stroke="#173B4D"
							strokeLinecap="round"
							strokeWidth="5"
						/>
						<path
							d="M118 146q22 10 44 0"
							fill="none"
							stroke="#FFF9E5"
							strokeLinecap="round"
							strokeWidth="7"
						/>
					</g>
				)}

				{stage === "sprout" ? (
					<g className="star-buddy__sprout">
						<path
							d="M140 50V28"
							fill="none"
							stroke="#3F7659"
							strokeLinecap="round"
							strokeWidth="6"
						/>
						<path
							d="M139 40q-22-6-24-23 21 0 24 15"
							fill="#8DC67A"
							stroke="#3F7659"
							strokeWidth="4"
						/>
						<path
							d="M141 39q21-10 28 6-19 11-28 1"
							fill="#A5D58C"
							stroke="#3F7659"
							strokeWidth="4"
						/>
					</g>
				) : null}

				{isExplorer ? (
					<g className="star-buddy__satchel">
						<path
							d="M101 148q42 42 80 6"
							fill="none"
							stroke="#4F7895"
							strokeLinecap="round"
							strokeWidth="7"
						/>
						<rect
							x="155"
							y="155"
							width="40"
							height="34"
							rx="10"
							fill="#DDEAD8"
							stroke="#173B4D"
							strokeWidth="4"
						/>
						<path
							d="M166 154q8-8 18 0"
							fill="none"
							stroke="#173B4D"
							strokeLinecap="round"
							strokeWidth="4"
						/>
					</g>
				) : null}

				{isStar ? (
					<g className="star-buddy__story">
						<path
							d="M96 74q44-30 88 0l-10 22q-35-16-68 0z"
							fill="#6F5CA8"
							stroke="#173B4D"
							strokeWidth="4"
						/>
						<circle cx="141" cy="70" r="7" fill="#FFF3AA" />
						<path
							d="M95 194q25-12 46 4v28q-21-15-46-4zM185 194q-25-12-46 4v28q21-15 46-4z"
							fill="#FFFDF7"
							stroke="#173B4D"
							strokeWidth="4"
						/>
					</g>
				) : null}
			</svg>
			<figcaption>{growthStageLabel(stage)}</figcaption>
		</figure>
	);
}
