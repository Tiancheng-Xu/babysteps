import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidencePage } from "./EvidencePage";

describe("EvidencePage", () => {
	it("shows the verified AWS performance closed loop and exact cleanup proof", () => {
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
		expect(screen.getByText("ECS 官方服务角色")).toBeTruthy();
		expect(
			screen.getByText(/账户级复用、零长期密钥、角色本身不收费/u),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "真实云端验证与恢复时间线" }),
		).toBeTruthy();
		expect(screen.getByText(/31760380214/u)).toBeTruthy();
		expect(screen.getByText(/31761586956/u)).toBeTruthy();
		expect(screen.getAllByText(/31765573258/u).length).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/sampleCount=1，p50=p75=p95=321/u).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/九类项目运行资源均为 0/u).length,
		).toBeGreaterThan(0);
		expect(screen.getByText("AWS 闭环已验证")).toBeTruthy();
		expect(screen.queryByText("AWS 云端待验证")).toBeNull();
	});

	it("shows the verified StarBuddy Sepolia draw without claiming a live fusion", () => {
		render(<EvidencePage />);

		expect(screen.getAllByText("StarBuddy Sepolia 已验证")).toHaveLength(2);
		expect(screen.getAllByText(/SBT #1 · 星耀 · 闪耀星宝/u)).toHaveLength(2);
		expect(screen.getAllByText(/真实融合等待自然积累三张匹配卡/u)).toHaveLength(
			2,
		);
		expect(screen.queryByText("Sepolia 待部署")).toBeNull();
	});
});
