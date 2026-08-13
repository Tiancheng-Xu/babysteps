import { describe, expect, it } from "vitest";

import {
	keepsakeName,
	RARITY_RULES,
	validateFusionSelection,
} from "./keepsakeModel";

const cards = [
	{ tokenId: 1n, series: 0, rarity: 0, locked: false },
	{ tokenId: 2n, series: 0, rarity: 0, locked: false },
	{ tokenId: 3n, series: 0, rarity: 0, locked: false },
] as const;

describe("keepsakeModel", () => {
	it("publishes the approved draw and fusion probabilities", () => {
		expect(RARITY_RULES).toEqual([
			{ rarity: 0, label: "普通", drawChance: "70%", fusionChance: "100%" },
			{ rarity: 1, label: "稀有", drawChance: "22%", fusionChance: "70%" },
			{ rarity: 2, label: "星耀", drawChance: "7%", fusionChance: "40%" },
			{ rarity: 3, label: "典藏", drawChance: "1%", fusionChance: "不可融合" },
		]);
	});

	it("requires exactly three unlocked cards with matching series and rarity", () => {
		expect(validateFusionSelection(cards)).toEqual({
			ok: true,
			message: "可融合为稀有 · 蛋蛋星宝",
		});
		expect(validateFusionSelection(cards.slice(0, 2))).toEqual({
			ok: false,
			message: "请选择 3 张同系列、同稀有度纪念卡。",
		});
		expect(
			validateFusionSelection([
				{ ...cards[0], locked: true },
				cards[1],
				cards[2],
			]),
		).toEqual({ ok: false, message: "等待随机数的卡片暂时不能再次融合。" });
		expect(
			validateFusionSelection([cards[0], cards[1], { ...cards[2], rarity: 1 }]),
		).toEqual({ ok: false, message: "3 张卡必须属于同一系列和稀有度。" });
		expect(
			validateFusionSelection(cards.map((card) => ({ ...card, rarity: 3 }))),
		).toEqual({ ok: false, message: "典藏卡已是最高等级，不能继续融合。" });
	});

	it("keeps the four StarBuddy series names stable", () => {
		expect(keepsakeName(0, 0)).toBe("普通 · 蛋蛋星宝");
		expect(keepsakeName(1, 1)).toBe("稀有 · 萌芽星宝");
		expect(keepsakeName(2, 2)).toBe("星耀 · 探索星宝");
		expect(keepsakeName(3, 3)).toBe("典藏 · 闪耀星宝");
	});
});
