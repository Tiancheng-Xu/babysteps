import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidencePage } from "./EvidencePage";

describe("EvidencePage", () => {
	it("explains the AWS identity foundation without claiming the runtime is complete", () => {
		render(<EvidencePage />);

		expect(
			screen.getByRole("heading", {
				name: "OIDC 身份底座与最小权限生命周期",
			}),
		).toBeTruthy();
		expect(screen.getByText("Environment 与共享变量")).toBeTruthy();
		expect(screen.getByText("创建期二阶段权限")).toBeTruthy();
		expect(screen.getByText("线上验证")).toBeTruthy();
		expect(screen.getByText("生命周期与清理边界")).toBeTruthy();
		expect(
			screen.getByText(/不代表性能 Stack 已部署或业务验收完成/u),
		).toBeTruthy();
		expect(screen.getByText("AWS 云端待验证")).toBeTruthy();
	});
});
