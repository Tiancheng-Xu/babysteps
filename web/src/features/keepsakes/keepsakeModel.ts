import type { GrowthStageName } from "../growth/growthModel";

export type KeepsakeCard = {
	tokenId: bigint;
	series: number;
	rarity: number;
	locked: boolean;
};

export const SERIES_RULES = [
	{ series: 0, label: "蛋蛋星宝", stage: "egg" },
	{ series: 1, label: "萌芽星宝", stage: "sprout" },
	{ series: 2, label: "探索星宝", stage: "explorer" },
	{ series: 3, label: "闪耀星宝", stage: "star" },
] as const satisfies ReadonlyArray<{
	series: number;
	label: string;
	stage: GrowthStageName;
}>;

export const RARITY_RULES = [
	{ rarity: 0, label: "普通", drawChance: "70%", fusionChance: "100%" },
	{ rarity: 1, label: "稀有", drawChance: "22%", fusionChance: "70%" },
	{ rarity: 2, label: "星耀", drawChance: "7%", fusionChance: "40%" },
	{ rarity: 3, label: "典藏", drawChance: "1%", fusionChance: "不可融合" },
] as const;

export function seriesRule(series: number) {
	return SERIES_RULES.find((rule) => rule.series === series) ?? SERIES_RULES[0];
}

export function rarityRule(rarity: number) {
	return RARITY_RULES.find((rule) => rule.rarity === rarity) ?? RARITY_RULES[0];
}

export function keepsakeName(series: number, rarity: number) {
	return `${rarityRule(rarity).label} · ${seriesRule(series).label}`;
}

export type FusionValidation =
	| { ok: true; message: string }
	| { ok: false; message: string };

export function validateFusionSelection(
	cards: ReadonlyArray<KeepsakeCard>,
): FusionValidation {
	if (cards.length !== 3) {
		return { ok: false, message: "请选择 3 张同系列、同稀有度纪念卡。" };
	}
	if (cards.some((card) => card.locked)) {
		return { ok: false, message: "等待随机数的卡片暂时不能再次融合。" };
	}
	const [first] = cards;
	if (!first) {
		return { ok: false, message: "请选择 3 张同系列、同稀有度纪念卡。" };
	}
	if (
		cards.some(
			(card) => card.series !== first.series || card.rarity !== first.rarity,
		)
	) {
		return { ok: false, message: "3 张卡必须属于同一系列和稀有度。" };
	}
	if (first.rarity === 3) {
		return { ok: false, message: "典藏卡已是最高等级，不能继续融合。" };
	}
	return {
		ok: true,
		message: `可融合为${keepsakeName(first.series, first.rarity + 1)}`,
	};
}
