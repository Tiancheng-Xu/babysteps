export const GROWTH_ACTIVITIES = [
	{
		id: "meal",
		contractValue: 0,
		reward: 3,
		title: "一起用餐",
		description: "记录一次轻松的用餐陪伴",
	},
	{
		id: "walk",
		contractValue: 1,
		reward: 5,
		title: "户外陪伴",
		description: "记录一次散步或户外陪伴",
	},
	{
		id: "read",
		contractValue: 2,
		reward: 7,
		title: "亲子共读",
		description: "记录一次故事或阅读时间",
	},
] as const;

export type GrowthActivityId = (typeof GROWTH_ACTIVITIES)[number]["id"];
export type GrowthStageName = "egg" | "sprout" | "explorer" | "star";

const STAGE_BY_CODE: Record<number, GrowthStageName> = {
	0: "egg",
	1: "sprout",
	2: "explorer",
	3: "star",
};

const STAGE_LABELS: Record<GrowthStageName, string> = {
	egg: "星星蛋",
	sprout: "冒芽星宝",
	explorer: "探索星宝",
	star: "闪耀星宝",
};

export function growthStageFromCode(code: number): GrowthStageName {
	const stage = STAGE_BY_CODE[code];
	if (!stage) throw new Error(`Unknown growth stage code: ${code}`);
	return stage;
}

export function growthStageLabel(stage: GrowthStageName) {
	return STAGE_LABELS[stage];
}

export function firstJourneyProgress(points: bigint) {
	const current = points >= 15n ? 15 : Number(points);
	return {
		current,
		percent: (current / 15) * 100,
		complete: points >= 15n,
	};
}
