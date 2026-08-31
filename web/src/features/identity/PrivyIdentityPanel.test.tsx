import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const wallet = "0x1111111111111111111111111111111111111111" as Address;
const mocks = vi.hoisted(() => ({
	authenticated: false,
	login: vi.fn(),
	logout: vi.fn(),
	sign: vi.fn(),
	apiLogin: vi.fn(),
	getProfile: vi.fn(),
	updateProfile: vi.fn(),
	apiLogout: vi.fn(),
	measureBusinessPerformance: vi.fn(),
}));

vi.mock("@privy-io/react-auth", () => ({
	usePrivy: () => ({
		ready: true,
		authenticated: mocks.authenticated,
		login: mocks.login,
		logout: mocks.logout,
		user: { linkedAccounts: [] },
	}),
	useWallets: () => ({
		ready: true,
		wallets: [{ linked: true, address: wallet, sign: mocks.sign }],
	}),
}));

vi.mock("@privy-io/react-auth/smart-wallets", () => ({
	useSmartWallets: () => ({ client: undefined }),
}));

vi.mock("../../contracts/web3Contracts", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../../contracts/web3Contracts")>();
	return {
		...actual,
		publicAppConfig: {
			...actual.publicAppConfig,
			apiUrl: "https://api.example",
		},
	};
});

vi.mock("../../performance/runtime", () => ({
	measureBusinessPerformance: mocks.measureBusinessPerformance,
	measurePerformance: (_name: string, operation: () => Promise<unknown>) =>
		operation(),
}));

vi.mock("./identityApi", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./identityApi")>();
	return {
		...actual,
		createIdentityApi: () => ({
			login: mocks.apiLogin,
			getProfile: mocks.getProfile,
			updateProfile: mocks.updateProfile,
			logout: mocks.apiLogout,
		}),
	};
});

import { PrivyIdentityPanel } from "./PrivyIdentityPanel";

describe("PrivyIdentityPanel business operations", () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.authenticated = false;
		mocks.login.mockResolvedValue(undefined);
		mocks.measureBusinessPerformance.mockImplementation(
			(_name: string, operation: () => Promise<unknown>) => operation(),
		);
		mocks.apiLogin.mockResolvedValue(undefined);
		mocks.getProfile.mockResolvedValue({ wallet, username: "星宝" });
		mocks.updateProfile.mockResolvedValue({ wallet, username: "小星" });
	});

	it("measures the Privy login UI through its completed login promise", async () => {
		render(<PrivyIdentityPanel />);

		fireEvent.click(screen.getByRole("button", { name: "使用 Privy 登录" }));

		await waitFor(() =>
			expect(mocks.measureBusinessPerformance).toHaveBeenCalledWith(
				"business.identity.login",
				expect.any(Function),
			),
		);
		expect(mocks.login).toHaveBeenCalledOnce();
	});

	it("measures the signed Worker session and D1 profile readback", async () => {
		mocks.authenticated = true;
		render(<PrivyIdentityPanel />);

		fireEvent.click(
			screen.getByRole("button", { name: "建立 BabySteps 签名会话" }),
		);
		await screen.findByText("签名已由 Worker 校验，HttpOnly 会话已建立。");

		expect(mocks.measureBusinessPerformance).toHaveBeenCalledWith(
			"business.identity.session",
			expect.any(Function),
		);

		fireEvent.change(screen.getByLabelText("用户名（2–32 个安全字符）"), {
			target: { value: "小星" },
		});
		fireEvent.click(screen.getByRole("button", { name: "保存用户名" }));
		await screen.findByText("用户名已保存到链下 D1，并写入审计日志。");

		expect(mocks.measureBusinessPerformance).toHaveBeenCalledWith(
			"business.profile.write",
			expect.any(Function),
		);
		expect(mocks.updateProfile).toHaveBeenCalledWith("小星");
	});
});
