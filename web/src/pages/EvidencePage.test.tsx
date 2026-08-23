import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EvidencePage } from "./EvidencePage";

afterEach(cleanup);

describe("EvidencePage", () => {
	it("explains the verified local edge rendering and honest cloud boundary", () => {
		render(<EvidencePage />);

		expect(
			screen.getByRole("heading", { name: "边缘渲染与故障降级" }),
		).toBeTruthy();
		expect(screen.getByText(/边缘 SSR → 精确水合 → 纯 CSR 降级/u)).toBeTruthy();
		expect(screen.getByText("生产部署已验证 · 2026-08-14")).toBeTruthy();
		expect(screen.getByText("生产发布闭环")).toBeTruthy();
		expect(screen.getByText(/31789478284/u)).toBeTruthy();
		expect(screen.getByText(/共享 main 0c9185f/u)).toBeTruthy();
		expect(
			screen.getAllByText(/BabySteps 远端 Gate 与 Preview 已验证/u).length,
		).toBeGreaterThan(0);
		expect(screen.getAllByText(/31791893461/u).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/AWS 增量成本 \$0/u).length).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/钱包与身份只在客户端激活/u).length,
		).toBeGreaterThan(0);
	});

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
		expect(screen.getAllByText(/32626397427/u).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/commit acd4898f61fc/u).length).toBeGreaterThan(
			0,
		);
		expect(
			screen.getAllByText(/sampleCount=1，p50=p75=p95=321/u).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/Schema 与精确项目 Stack/u).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/项目 ECS Cluster 为 0/u).length,
		).toBeGreaterThan(0);
		expect(screen.getByRole("link", { name: "查看机器可读证据" })).toBeTruthy();
		expect(screen.getByText("AWS 闭环已验证")).toBeTruthy();
		expect(screen.queryByText("AWS 云端待验证")).toBeNull();
	});

	it("shows the verified StarBuddy Sepolia draw without claiming a live fusion", () => {
		render(<EvidencePage />);

		expect(
			screen.getAllByText("StarBuddy Sepolia 已验证").length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/SBT #1 · 星耀 · 闪耀星宝/u).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/真实融合等待自然积累三张匹配卡/u).length,
		).toBeGreaterThan(0);
		expect(screen.queryByText("Sepolia 待部署")).toBeNull();
	});

	it("separates completed assignment requirements from optional production rechecks", () => {
		render(<EvidencePage />);

		expect(
			screen.getByText("核心交付已验证 · 生产增强待复核"),
		).toBeTruthy();
		expect(
			screen.getByText(/Sepolia Provider → Owner → VRF 已有真实交易/u),
		).toBeTruthy();
		expect(screen.getByText(/链上 \+ D1 ID 绑定与评论已闭环/u)).toBeTruthy();
		expect(
			screen.getByText(/真实 confirmCompletion 与锁定 SBT #1/u),
		).toBeTruthy();
		expect(
			screen.queryByText("UI 已发布；生产 Provider/Owner 新交易待验证"),
		).toBeNull();
		expect(screen.queryByText("本地闭环通过 · 云端待发布")).toBeNull();
	});
});
