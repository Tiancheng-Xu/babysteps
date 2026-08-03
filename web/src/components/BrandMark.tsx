export function BrandMark() {
	return (
		<div className="brand-mark" aria-hidden="true">
			<svg viewBox="0 0 84 84" focusable="false">
				<defs>
					<filter id="brand-glow" x="-30%" y="-30%" width="160%" height="160%">
						<feDropShadow dx="0" dy="10" stdDeviation="8" floodOpacity="0.16" />
					</filter>
				</defs>
				<path
					d="M42 8c7 12 15 15 26 16-8 7-10 14-8 24 0 2 4 11 8 20-10-3-18-2-26 7-8-9-16-10-26-7 4-9 8-18 8-20 2-10 0-17-8-24 11-1 19-4 26-16z"
					fill="#173B4D"
					filter="url(#brand-glow)"
					stroke="#173B4D"
					strokeLinejoin="round"
					strokeWidth="2.5"
				/>
				<path
					d="M41 58c2-10 1-18-4-26"
					fill="none"
					stroke="#FFF6D3"
					strokeLinecap="round"
					strokeWidth="5"
				/>
				<path
					d="M42 57c-1-9 3-17 11-25"
					fill="none"
					stroke="#FFF6D3"
					strokeLinecap="round"
					strokeWidth="5"
				/>
				<path
					d="M34 36c-9-7-15-7-21-4 2 8 8 13 19 13"
					fill="#FFF3BA"
					stroke="#FFF6D3"
					strokeLinejoin="round"
					strokeWidth="2"
				/>
				<path
					d="M48 34c8-9 15-10 22-8-1 10-8 16-20 17"
					fill="#FFF3BA"
					stroke="#FFF6D3"
					strokeLinejoin="round"
					strokeWidth="2"
				/>
			</svg>
		</div>
	);
}
