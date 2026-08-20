import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type { Address, Hash } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	clear: vi.fn(),
	connect: vi.fn(),
	disconnect: vi.fn(),
	recordActivity: vi.fn(),
	retryTransferRead: vi.fn(),
	retryBabyCoinRead: vi.fn(),
	retryGrowthRead: vi.fn(),
	retryNotebookRead: vi.fn(),
	save: vi.fn(),
	setDraft: vi.fn(),
	setTransferAmount: vi.fn(),
	setTransferRecipient: vi.fn(),
	switchGrowthToSepolia: vi.fn(),
	switchNotebookToSepolia: vi.fn(),
	switchWalletToSepolia: vi.fn(),
	useAccount: vi.fn(),
	useConnect: vi.fn(),
	useDisconnect: vi.fn(),
	useGrowth: vi.fn(),
	useBabyCoinGrowth: vi.fn(),
	useMarketplace: vi.fn(),
	useNotebook: vi.fn(),
	usePointTransfer: vi.fn(),
	useProviderTaskCreation: vi.fn(),
	useOwnerTaskReview: vi.fn(),
	useSwitchChain: vi.fn(),
	useUniswapSwap: vi.fn(),
	transfer: vi.fn(),
}));

vi.mock("./features/growth/useGrowth", () => ({
	useGrowth: mocks.useGrowth,
}));

vi.mock("./features/babycoin/useBabyCoinGrowth", () => ({
	useBabyCoinGrowth: mocks.useBabyCoinGrowth,
}));

vi.mock("./features/notebook/useNotebook", () => ({
	useNotebook: mocks.useNotebook,
}));

vi.mock("./features/marketplace/useMarketplace", () => ({
	useMarketplace: mocks.useMarketplace,
}));

vi.mock("./features/provider/useProviderTaskCreation", () => ({
	useProviderTaskCreation: mocks.useProviderTaskCreation,
}));

vi.mock("./features/provider/useOwnerTaskReview", () => ({
	useOwnerTaskReview: mocks.useOwnerTaskReview,
}));

vi.mock("./features/growth/usePointTransfer", () => ({
	usePointTransfer: mocks.usePointTransfer,
}));

vi.mock("./features/exchange/useUniswapSwap", () => ({
	useUniswapSwap: mocks.useUniswapSwap,
}));

vi.mock("wagmi", async (importOriginal) => {
	const actual = await importOriginal<typeof import("wagmi")>();
	return {
		...actual,
		useAccount: mocks.useAccount,
		useConnect: mocks.useConnect,
		useDisconnect: mocks.useDisconnect,
		useSwitchChain: mocks.useSwitchChain,
	};
});

import App from "./App";
import { CourseEvidenceFooter } from "./components/CourseEvidenceFooter";

const account = "0x1111111111111111111111111111111111111111" as Address;
const transactionHash = `0x${"c".repeat(64)}` as Hash;

let growthState: Record<string, unknown>;
let babyCoinGrowthState: Record<string, unknown>;
let notebookState: Record<string, unknown>;
let transferState: Record<string, unknown>;

describe("BabySteps App", () => {
	afterEach(cleanup);

	beforeEach(() => {
		globalThis.history.replaceState({}, "", "/");
		vi.clearAllMocks();
		mocks.useAccount.mockReturnValue({
			address: account,
			chainId: 11155111,
			isConnected: true,
		});
		mocks.useConnect.mockReturnValue({
			connect: mocks.connect,
			connectors: [{ id: "metaMask", name: "MetaMask" }],
			isPending: false,
		});
		mocks.useDisconnect.mockReturnValue({ disconnect: mocks.disconnect });
		mocks.useSwitchChain.mockReturnValue({
			switchChainAsync: mocks.switchWalletToSepolia,
		});

		growthState = {
			walletState: "ready",
			points: 0n,
			stage: "egg",
			availabilityByActivity: {
				meal: { available: true, dailyLimitReached: false },
				walk: { available: true, dailyLimitReached: false },
				read: { available: true, dailyLimitReached: false },
			},
			phase: "idle",
			message: undefined,
			transactionHash: undefined,
			recordActivity: mocks.recordActivity,
			retryRead: mocks.retryGrowthRead,
			switchToSepolia: mocks.switchGrowthToSepolia,
			isPending: false,
		};
		babyCoinGrowthState = {
			isConfigured: true,
			walletState: "ready",
			balance: 10_650_166_471_630_484_868n,
			lifetimeEarned: 15n * 10n ** 18n,
			stage: "star",
			availabilityByActivity: {
				meal: { available: true, dailyLimitReached: false },
				walk: { available: false, dailyLimitReached: false },
				read: { available: false, dailyLimitReached: true },
			},
			phase: "ready",
			message: undefined,
			transactionHash: undefined,
			isPending: false,
			recordActivity: mocks.recordActivity,
			retryRead: mocks.retryBabyCoinRead,
			switchToSepolia: mocks.switchGrowthToSepolia,
		};
		notebookState = {
			walletState: "ready",
			chainNote: "公开测试内容",
			draft: "公开测试内容",
			setDraft: mocks.setDraft,
			save: mocks.save,
			clear: mocks.clear,
			retryRead: mocks.retryNotebookRead,
			switchToSepolia: mocks.switchNotebookToSepolia,
			transactionHash: undefined,
			phase: "idle",
			message: undefined,
			canSave: true,
			canClear: true,
		};
		transferState = {
			walletState: "ready",
			balance: 7n,
			recipient: "",
			setRecipient: mocks.setTransferRecipient,
			amount: "",
			setAmount: mocks.setTransferAmount,
			validationMessage: undefined,
			canTransfer: false,
			phase: "idle",
			message: undefined,
			transactionHash: undefined,
			transfer: mocks.transfer,
			retryRead: mocks.retryTransferRead,
			switchToSepolia: mocks.switchGrowthToSepolia,
			isPending: false,
		};
		mocks.useGrowth.mockImplementation(() => growthState);
		mocks.useBabyCoinGrowth.mockImplementation(() => babyCoinGrowthState);
		mocks.useMarketplace.mockReturnValue({
			isConfigured: false,
			tasks: [],
			phase: "unconfigured",
			message: undefined,
			isPending: false,
			retryRead: vi.fn(),
		});
		mocks.useProviderTaskCreation.mockReturnValue({
			isConfigured: false,
			walletState: "ready",
			activity: "walk",
			setActivity: vi.fn(),
			metadataUri: "",
			setMetadataUri: vi.fn(),
			metadataHash: "",
			setMetadataHash: vi.fn(),
			hasProviderRole: false,
			phase: "unavailable",
			message: undefined,
			canSubmit: false,
			isPending: false,
			transactionHash: undefined,
			createTask: vi.fn(),
			switchToSepolia: vi.fn(),
		});
		mocks.useOwnerTaskReview.mockReturnValue({
			taskId: "",
			setTaskId: vi.fn(),
			rejectionReason: "",
			setRejectionReason: vi.fn(),
			isOwner: false,
			phase: "unavailable",
			message: undefined,
			transactionHash: undefined,
			canApprove: false,
			canReject: false,
			isPending: false,
			approve: vi.fn(),
			reject: vi.fn(),
		});
		mocks.useNotebook.mockImplementation(() => notebookState);
		mocks.usePointTransfer.mockImplementation(() => transferState);
		mocks.useUniswapSwap.mockReturnValue({
			asset: "USDC",
			setAsset: vi.fn(),
			amount: "1",
			setAmount: vi.fn(),
			configured: true,
			walletState: "ready",
			quotedBaby: "10.6502",
			quotedBabyExact: "10.650166471630484868",
			quotedBabyIsApproximate: true,
			phase: "idle",
			message: undefined,
			transactionHash: undefined,
			quote: vi.fn(),
			execute: vi.fn(),
			canQuote: true,
			canExecute: false,
			switchToSepolia: vi.fn(),
		});
	});

	it("shows safety boundaries and caps a completed first journey", () => {
		growthState.points = 18n;
		growthState.stage = "star";
		render(<App />);

		expect(screen.getByText("Sepolia 产品原型 · 测试网")).toBeTruthy();
		expect(
			screen.getByText(
				"成长星无价格，只用于 Sepolia 测试网体验；可在测试钱包间赠送，不可兑换。",
			),
		).toBeTruthy();
		expect(screen.getByText(/请只用专用测试钱包/)).toBeTruthy();
		expect(screen.getByText(/成年照护者自报/)).toBeTruthy();
		expect(screen.getByText(/不要填写或上传儿童姓名/)).toBeTruthy();
		expect(screen.getByText("累计养成值")).toBeTruthy();
		expect(screen.getByText("18")).toBeTruthy();
		expect(screen.getByText("可赠送成长星")).toBeTruthy();
		expect(screen.getByText("7")).toBeTruthy();
		expect(screen.getByText(/收到的成长星不会增加星宝阶段/)).toBeTruthy();
		expect(screen.getByText("首轮养成已完成")).toBeTruthy();
		expect(screen.queryByText("18 / 15")).toBeNull();
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
			"100",
		);
	});

	it("keeps the single-page story flow and course proof area aligned with the PRD", () => {
		const { container } = render(<App />);

		expect(
			screen.getByRole("heading", { name: "BabySteps · 成长星球" }),
		).toBeTruthy();
		expect(
			screen.getByText(
				"记录一件小小的陪伴，让原创虚拟伙伴“星宝”在测试链上慢慢长大。",
			),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "步骤 1 · 连接测试钱包" }),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "步骤 2 · 虚拟伙伴养成" }),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "步骤 3 · 测试钱包赠送" }),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "步骤 4 · 链上家庭便签" }),
		).toBeTruthy();
		expect(screen.getByRole("heading", { name: "核心技术能力" })).toBeTruthy();
		expect(document.body.textContent).not.toMatch(/作业|课程|老师|验收/);
		expect(
			screen.getByText("React + wagmi 连接 MetaMask，并把合约作为数据后端。"),
		).toBeTruthy();
		expect(
			screen.getByText("交易哈希只代表广播；receipt 成功后才刷新链上状态。"),
		).toBeTruthy();
		expect(container.querySelector("nav")).toBeTruthy();
		expect(
			screen.getByRole("navigation", { name: "BabySteps 产品导航" }),
		).toBeTruthy();
		expect(screen.queryByText("数字传家宝")).toBeNull();
		expect(screen.queryByText("永久儿童寄语")).toBeNull();
		expect(screen.queryByText("孩子档案")).toBeNull();
		expect(screen.queryByText("发现星球")).toBeNull();
		expect(screen.queryByText("成长纪念")).toBeNull();
	});

	it("keeps portfolio, product, and evidence navigation reciprocal on every view", async () => {
		render(<App />);

		const footerNavigation = screen.getByRole("navigation", {
			name: "作品与工作证明导航",
		});
		const links = within(footerNavigation).getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual([
			"作品集首页",
			"项目主页",
			"工作证明",
		]);
		expect(links[0]?.getAttribute("href")).toBe("https://baby2b.online/");
		expect(links[1]?.getAttribute("href")).toBe(
			"https://babysteps.baby2b.online/",
		);
		expect(links[1]?.getAttribute("aria-current")).toBe("page");
		expect(links[2]?.getAttribute("href")).toBe(
			"https://evidence.baby2b.online/babysteps/",
		);
		expect(
			screen
				.getByRole("link", { name: "查看完整工作证明" })
				.getAttribute("href"),
		).toBe("https://evidence.baby2b.online/babysteps/");

		cleanup();
		render(<CourseEvidenceFooter currentView="evidence" />);
		expect(
			screen.getByRole("navigation", { name: "作品与工作证明导航" }),
		).toBeTruthy();
		expect(
			within(screen.getByRole("navigation", { name: "作品与工作证明导航" }))
				.getByRole("link", { name: "工作证明" })
				.getAttribute("aria-current"),
		).toBe("page");
	});

	it("navigates the canonical Chinese Stitch product views", async () => {
		render(<App />);

		const navigation = screen.getByRole("navigation", {
			name: "BabySteps 产品导航",
		});
		expect(
			within(navigation)
				.getByRole("link", { name: "首页" })
				.getAttribute("aria-current"),
		).toBe("page");

		fireEvent.click(within(navigation).getByRole("link", { name: "成长任务" }));
		expect(
			await screen.findByRole("heading", { name: "成长任务市集" }),
		).toBeTruthy();
		expect(screen.getByText("暂无已激活的成长任务")).toBeTruthy();

		fireEvent.click(within(navigation).getByRole("link", { name: "家长中心" }));
		expect(
			await screen.findByRole("heading", { name: "家长成长中心" }),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "链上成长与可用余额" }),
		).toBeTruthy();
		const spendableMetric = screen.getByRole("article", {
			name: "可用 BabyCoin",
		});
		expect(within(spendableMetric).getByText("10.6502")).toBeTruthy();
		expect(within(spendableMetric).getByText("BABY")).toBeTruthy();
		expect(
			within(spendableMetric).getByText(
				"完整链上数值 10.650166471630484868 BABY",
			),
		).toBeTruthy();
		expect(
			within(spendableMetric).getByText("可用于购买和转账，消费后会减少。"),
		).toBeTruthy();

		const lifetimeMetric = screen.getByRole("article", {
			name: "累计成长奖励",
		});
		expect(within(lifetimeMetric).getByText("15")).toBeTruthy();
		expect(within(lifetimeMetric).getByText("BABY")).toBeTruthy();
		expect(
			within(lifetimeMetric).getByText("决定星宝阶段，只增不减。"),
		).toBeTruthy();

		fireEvent.click(
			within(navigation).getByRole("link", { name: "Provider 控制台" }),
		);
		expect(
			await screen.findByRole("heading", { name: "机构与育婴师控制台" }),
		).toBeTruthy();

		fireEvent.click(within(navigation).getByRole("link", { name: "兑换" }));
		expect(
			await screen.findByRole("heading", { name: "BabyCoin 兑换" }),
		).toBeTruthy();
		expect(screen.getByText("不部署 MockUSDC")).toBeTruthy();
		expect(screen.getByText("10.6502")).toBeTruthy();
		expect(
			screen.getByText("完整链上报价 10.650166471630484868 BABY"),
		).toBeTruthy();

		expect(
			within(navigation)
				.getByRole("link", { name: "个人中心" })
				.getAttribute("href"),
		).toBe("/profile");
		expect(
			within(navigation)
				.getByRole("link", { name: "工作证据" })
				.getAttribute("href"),
		).toBe("/evidence");
	});

	it("keeps unavailable activities button-free and still lets an available card submit", () => {
		growthState.availabilityByActivity = {
			meal: { available: false, dailyLimitReached: false },
			walk: { available: true, dailyLimitReached: false },
			read: { available: false, dailyLimitReached: true },
		};
		render(<App />);

		expect(screen.getByText("星宝现在还不饿")).toBeTruthy();
		expect(screen.getByText("星宝今天已经很充实了")).toBeTruthy();
		expect(
			screen.queryByRole("button", {
				name: "记录喂养陪伴，获得 3 枚成长星",
			}),
		).toBeNull();

		const walkCard = screen
			.getByRole("heading", { name: "户外陪伴" })
			.closest("article");
		if (!walkCard) {
			throw new Error("Expected to find the walk activity card");
		}

		fireEvent.click(
			within(walkCard).getByRole("button", { name: "记录这次陪伴" }),
		);
		expect(mocks.recordActivity).toHaveBeenCalledWith("walk");
	});

	it("keeps signature and confirmation feedback visible while a record is pending", () => {
		growthState.phase = "awaiting-signature";
		growthState.isPending = true;
		growthState.message = "请在 MetaMask 中确认这次陪伴记录。";
		const { rerender } = render(<App />);

		expect(screen.getByText("请在 MetaMask 中确认这次陪伴记录。")).toBeTruthy();

		growthState.phase = "confirming";
		growthState.message = "交易已提交，正在等待链上确认";
		rerender(<App />);
		expect(screen.getByText("交易已提交，正在等待链上确认")).toBeTruthy();
	});

	it("links a confirmed growth transaction to Sepolia Etherscan", () => {
		growthState.phase = "success";
		growthState.transactionHash = transactionHash;
		growthState.message = "记录成功，获得 +7 枚成长星。";
		render(<App />);

		expect(
			screen.getByRole("link", { name: "查看链上交易" }).getAttribute("href"),
		).toBe(`https://sepolia.etherscan.io/tx/${transactionHash}`);
	});

	it("enforces the public notebook UTF-8 byte boundary", () => {
		notebookState.draft = "😀".repeat(71);
		notebookState.canSave = true;
		const { rerender } = render(<App />);

		expect(screen.getByText("284 / 280 字节")).toBeTruthy();
		expect(
			(
				screen.getByRole("button", {
					name: "保存当前便签",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);

		notebookState.draft = "😀".repeat(70);
		rerender(<App />);
		expect(screen.getByText("280 / 280 字节")).toBeTruthy();
		expect(
			(
				screen.getByRole("button", {
					name: "保存当前便签",
				}) as HTMLButtonElement
			).disabled,
		).toBe(false);
	});

	it("requires an explicit confirmation before clearing current note state", () => {
		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "清空当前便签" }));
		expect(mocks.clear).not.toHaveBeenCalled();
		expect(
			screen.getByText("历史交易仍公开，确认只清空当前显示？"),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "确认清空当前便签" }));
		expect(mocks.clear).toHaveBeenCalledOnce();
	});

	it("keeps the notebook visibly separate and warns against child data", () => {
		render(<App />);

		expect(screen.getByRole("heading", { name: "公开链上便签" })).toBeTruthy();
		expect(screen.getByText(/历史交易仍然公开/)).toBeTruthy();
		expect(
			screen.getByPlaceholderText("今天完成了一次 Sepolia 测试"),
		).toBeTruthy();
	});
});
