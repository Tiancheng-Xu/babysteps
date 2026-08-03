import {
	type GrowthStageName,
	growthStageLabel,
} from "../features/growth/growthModel";

type StarBuddyProps = {
	stage: GrowthStageName;
};

export function StarBuddy({ stage }: StarBuddyProps) {
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
			<svg viewBox="0 0 260 240" aria-hidden="true" focusable="false">
				<defs>
					<linearGradient id="buddy-body" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="#fff3aa" />
						<stop offset="1" stopColor="#f7b95f" />
					</linearGradient>
					<filter
						id="buddy-shadow"
						x="-30%"
						y="-30%"
						width="160%"
						height="170%"
					>
						<feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.18" />
					</filter>
				</defs>

				<ellipse
					cx="130"
					cy="216"
					rx="78"
					ry="14"
					fill="#173b4d"
					opacity="0.12"
				/>
				<path
					d="M130 25l22 48 52 6-38 36 10 52-46-25-46 25 10-52-38-36 52-6z"
					fill="url(#buddy-body)"
					stroke="#ad6d2e"
					strokeWidth="5"
					strokeLinejoin="round"
					filter="url(#buddy-shadow)"
				/>

				{isAwake ? (
					<g className="star-buddy__face">
						<circle cx="108" cy="105" r="6" fill="#173b4d" />
						<circle cx="152" cy="105" r="6" fill="#173b4d" />
						<path
							d="M116 126q14 13 28 0"
							fill="none"
							stroke="#173b4d"
							strokeWidth="5"
							strokeLinecap="round"
						/>
						<circle cx="91" cy="123" r="9" fill="#f38e79" opacity="0.55" />
						<circle cx="169" cy="123" r="9" fill="#f38e79" opacity="0.55" />
					</g>
				) : (
					<g className="star-buddy__shell">
						<path
							d="M96 108q12-9 24 0M140 108q12-9 24 0"
							fill="none"
							stroke="#173b4d"
							strokeWidth="5"
							strokeLinecap="round"
						/>
						<path
							d="M102 158l18-13 18 13 20-13"
							fill="none"
							stroke="#fff7d5"
							strokeWidth="7"
							strokeLinecap="round"
						/>
					</g>
				)}

				{stage === "sprout" ? (
					<g className="star-buddy__sprout">
						<path
							d="M130 54v-21"
							stroke="#357a54"
							strokeWidth="6"
							strokeLinecap="round"
						/>
						<path
							d="M129 36q-27-4-28-23 25-2 29 17"
							fill="#68ad70"
							stroke="#357a54"
							strokeWidth="4"
						/>
						<path
							d="M131 35q25-8 31 9-21 9-31-3"
							fill="#8acb79"
							stroke="#357a54"
							strokeWidth="4"
						/>
					</g>
				) : null}

				{isExplorer ? (
					<g className="star-buddy__satchel">
						<path
							d="M89 142q39 45 81 10"
							fill="none"
							stroke="#3c6d82"
							strokeWidth="7"
							strokeLinecap="round"
						/>
						<rect
							x="146"
							y="153"
							width="41"
							height="34"
							rx="9"
							fill="#6aa0ac"
							stroke="#173b4d"
							strokeWidth="4"
						/>
					</g>
				) : null}

				{isStar ? (
					<g className="star-buddy__story">
						<path
							d="M89 62q42-32 83 0l-10 25q-32-17-64 0z"
							fill="#6f5ca8"
							stroke="#173b4d"
							strokeWidth="4"
						/>
						<circle cx="131" cy="57" r="8" fill="#fff3aa" />
						<path
							d="M81 190q25-12 49 4v31q-24-16-49-4zM179 190q-25-12-49 4v31q24-16 49-4z"
							fill="#fffdf2"
							stroke="#173b4d"
							strokeWidth="4"
						/>
					</g>
				) : null}
			</svg>
			<figcaption>{growthStageLabel(stage)}</figcaption>
		</figure>
	);
}
