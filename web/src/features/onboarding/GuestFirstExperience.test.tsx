import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { GuestFirstExperience } from "./GuestFirstExperience";

describe("GuestFirstExperience", () => {
	afterEach(() => {
		cleanup();
		localStorage.clear();
	});

	it("lets a visitor complete the first task without login or wallet", () => {
		render(
			<MemoryRouter>
				<GuestFirstExperience />
			</MemoryRouter>,
		);

		fireEvent.change(screen.getByLabelText("宝宝阶段"), {
			target: { value: "newborn" },
		});
		fireEvent.change(screen.getByLabelText("体验地区"), {
			target: { value: "china" },
		});
		fireEvent.change(screen.getByLabelText("城市"), {
			target: { value: "ningbo" },
		});
		fireEvent.click(screen.getByRole("button", { name: "开始 3 分钟陪伴" }));

		expect(screen.getByRole("heading", { name: "听见你的声音" })).toBeTruthy();
		expect(screen.getByText(/无需登录，也无需连接钱包/u)).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "完成本次陪伴" }));
		expect(screen.getByRole("status").textContent).toContain("已完成");
		expect(
			screen.getByRole("link", { name: "登录后长期保存" }).getAttribute("href"),
		).toBe("/profile");
	});

	it("restores a completed local trial after remount", () => {
		localStorage.setItem(
			"babysteps.guest-journey.v1",
			JSON.stringify({
				version: 1,
				stage: "toddler",
				market: "japan",
				city: "tokyo",
				taskId: "toddler-treasure",
				status: "completed",
				startedAt: "2026-09-14T14:00:00.000Z",
			}),
		);

		render(
			<MemoryRouter>
				<GuestFirstExperience />
			</MemoryRouter>,
		);

		expect(screen.getByRole("heading", { name: "寻找家的颜色" })).toBeTruthy();
		expect(screen.getByRole("status").textContent).toContain("已完成");
	});
});
