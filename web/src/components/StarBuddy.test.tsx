import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StarBuddy } from "./StarBuddy";

describe("StarBuddy", () => {
	it.each([
		["egg", "星星蛋"],
		["sprout", "冒芽星宝"],
		["explorer", "探索星宝"],
		["star", "闪耀星宝"],
	] as const)(
		"renders the %s stage with an accessible name",
		(stage, label) => {
			render(<StarBuddy stage={stage} />);

			const buddy = screen.getByRole("img", { name: label });
			expect(buddy.getAttribute("data-stage")).toBe(stage);
			expect(buddy.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
				"true",
			);
		},
	);
});
