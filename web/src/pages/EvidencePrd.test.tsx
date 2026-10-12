import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ServerRouteShell } from "../app/ServerRouteShell";
import { routeForPath } from "../routing/routeDefinitions";
import { EvidencePage } from "./EvidencePage";

afterEach(cleanup);
describe("Evidence PRD navigation", () => {
	it("links the evidence page to BabySteps' full public PRD", () => {
		render(<EvidencePage />);
		expect(
			screen
				.getByRole("link", { name: "查看完整项目 PRD" })
				.getAttribute("href"),
		).toBe("/evidence/prd.html");
	});
	it("exposes the PRD link in the initial Evidence server response", () => {
		const route = routeForPath("/evidence/");
		if (!route) throw new Error("Evidence route must exist");
		render(<ServerRouteShell route={route} />);
		expect(
			screen
				.getByRole("link", { name: "查看完整项目 PRD" })
				.getAttribute("href"),
		).toBe("/evidence/prd.html");
	});
});
