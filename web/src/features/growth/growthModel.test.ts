import { describe, expect, it } from "vitest";

import {
	firstJourneyProgress,
	GROWTH_ACTIVITIES,
	growthStageFromCode,
	growthStageLabel,
} from "./growthModel";

describe("growth model", () => {
	it("keeps the contract activity order and visible rewards aligned", () => {
		expect(
			GROWTH_ACTIVITIES.map(({ id, contractValue, reward }) => ({
				id,
				contractValue,
				reward,
			})),
		).toEqual([
			{ id: "meal", contractValue: 0, reward: 3 },
			{ id: "walk", contractValue: 1, reward: 5 },
			{ id: "read", contractValue: 2, reward: 7 },
		]);
	});

	it("maps contract stages and caps the first journey at 100 percent", () => {
		expect([0, 1, 2, 3].map(growthStageFromCode)).toEqual([
			"egg",
			"sprout",
			"explorer",
			"star",
		]);
		expect(firstJourneyProgress(18n)).toEqual({
			current: 15,
			percent: 100,
			complete: true,
		});
		expect(growthStageLabel("star")).toBe("闪耀星宝");
	});

	it("rejects an unknown contract stage instead of showing an egg", () => {
		expect(() => growthStageFromCode(4)).toThrow(
			"Unknown growth stage code: 4",
		);
	});
});
