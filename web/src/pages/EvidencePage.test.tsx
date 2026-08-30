import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EvidencePage } from "./EvidencePage";

afterEach(cleanup);

describe("EvidencePage", () => {
	it("publishes the exact implemented-feature journey boundary without claiming the pending live run", () => {
		render(<EvidencePage />);

		expect(
			screen.getByRole("heading", { name: "已实现功能真实全旅程" }),
		).toBeTruthy();
		expect(screen.getByText(/local-verified · 31 个 Journey/u)).toBeTruthy();
		expect(screen.getByText(/NAV-01 · WALLET-01/u)).toBeTruthy();
		expect(screen.getByText(/PERF-01 · EVIDENCE-01/u)).toBeTruthy();
		expect(screen.getByRole("heading", { name: "当前实现边界" })).toBeTruthy();
		expect(screen.getByText(/Agent Market 的仲裁和 Cocos/u)).toBeTruthy();
		expect(screen.getByRole("link", { name: "查看机器证据" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "查看实现记录" })).toBeTruthy();
		expect(screen.getByText(/最终录屏、Sepolia/u)).toBeTruthy();
	});

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

	it("shows the final verified AWS performance lifecycle with visible proof", () => {
		render(<EvidencePage />);
		expect(
			screen.getByRole("heading", { name: "全路由采样与覆盖语义" }),
		).toBeTruthy();
		expect(screen.getByText("本地已验证 · 云端样本待刷新")).toBeTruthy();
		expect(screen.getByText(/23 项强制观测/u)).toBeTruthy();
		expect(screen.getByText(/33304145710/u)).toBeTruthy();
		expect(screen.getByText(/9 条产品路由 × 4 个视口共 36 项/u)).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "查看覆盖语义与全路由检查记录" }),
		).toBeTruthy();

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
			screen.getByRole("heading", { name: "临时 AWS 验证与恢复时间线" }),
		).toBeTruthy();
		expect(screen.getByText(/31760380214/u)).toBeTruthy();
		expect(screen.getByText(/31761586956/u)).toBeTruthy();
		expect(screen.getAllByText(/33279132965/u).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/commit 1e703caeba2d/u).length).toBeGreaterThan(
			0,
		);
		expect(screen.getAllByText(/5 条真实页面路径/u).length).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/Schema 与精确项目 Stack/u).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/项目 ECS Cluster 为 0/u).length,
		).toBeGreaterThan(0);
		expect(screen.getByRole("link", { name: "查看机器可读证据" })).toBeTruthy();
		expect(screen.getByText("最终闭环已验证 · 取证后零残留")).toBeTruthy();
		expect(screen.queryByText(/新合同待云端复验/u)).toBeNull();
		expect(screen.getByText("真实 Run 截图 · 取证后已清理")).toBeTruthy();
		expect(
			screen.getAllByRole("img", {
				name: "最终 AWS 性能统计桌面端真实页面截图",
			}).length,
		).toBe(2);
		expect(
			screen.getAllByRole("img", {
				name: "最终 AWS 性能统计 390 像素手机端真实页面截图",
			}).length,
		).toBe(2);
		expect(screen.getByLabelText("最终 AWS 性能统计页面走读录屏")).toBeTruthy();
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

		expect(screen.getByText("核心交付已验证 · 生产增强待复核")).toBeTruthy();
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
