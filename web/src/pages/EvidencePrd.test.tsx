import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { EvidencePage } from "./EvidencePage";

afterEach(cleanup);
it("links the evidence page to BabySteps' full public PRD", () => {
	render(<EvidencePage />);
	expect(
		screen.getByRole("link", { name: "查看完整项目 PRD" }).getAttribute("href"),
	).toBe("/evidence/prd.html");
});
