import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { AppRoutes } from "./routes";

describe("BabySteps browser routes", () => {
	afterEach(cleanup);

	it("renders a shareable keepsakes deep link and marks it current", () => {
		render(
			<MemoryRouter initialEntries={["/keepsakes"]}>
				<AppRoutes interactive={false} />
			</MemoryRouter>,
		);

		expect(screen.getByRole("heading", { name: "星宝纪念馆" })).toBeTruthy();
		const navigation = screen.getByRole("navigation", {
			name: "BabySteps 产品导航",
		});
		const keepsakes = within(navigation).getByRole("link", {
			name: "星宝纪念馆",
		});
		expect(keepsakes.getAttribute("href")).toBe("/keepsakes");
		expect(keepsakes.getAttribute("aria-current")).toBe("page");
	});

	it("navigates with real links and keeps browser history semantics", () => {
		render(
			<MemoryRouter initialEntries={["/"]}>
				<AppRoutes interactive={false} />
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("link", { name: "成长任务" }));
		expect(screen.getByRole("heading", { name: "成长任务市集" })).toBeTruthy();
		expect(globalThis.location.hash).toBe("");
	});

	it("renders a truthful not-found route instead of silently returning home", () => {
		render(
			<MemoryRouter initialEntries={["/missing-page"]}>
				<AppRoutes interactive={false} />
			</MemoryRouter>,
		);

		expect(screen.getByRole("heading", { name: "页面没有找到" })).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "返回首页" }).getAttribute("href"),
		).toBe("/");
	});
});
