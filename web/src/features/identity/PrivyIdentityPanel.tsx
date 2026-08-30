import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useMemo, useState } from "react";
import { getAddress, isAddress } from "viem";

import { publicAppConfig } from "../../contracts/web3Contracts";
import { measurePerformance } from "../../performance/runtime";
import { createIdentityApi, type Profile } from "./identityApi";
import {
	deriveIdentitySummary,
	normalizeUsername,
	type PublicLinkedAccount,
} from "./identityModel";

function compactAddress(value: string | undefined): string {
	if (!value) return "未关联";
	return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function PrivyIdentityPanel() {
	const { ready, authenticated, login, logout, user } = usePrivy();
	const { ready: walletsReady, wallets } = useWallets();
	const { client: smartWalletClient } = useSmartWallets();
	const [profile, setProfile] = useState<Profile>();
	const [username, setUsername] = useState("");
	const [phase, setPhase] = useState<
		"idle" | "signing" | "saving" | "ready" | "error"
	>("idle");
	const [message, setMessage] = useState<string>();

	const identity = useMemo(() => {
		const accounts = (user?.linkedAccounts ?? []).map((account) => {
			const publicAccount = account as unknown as Record<string, unknown>;
			return {
				type: String(publicAccount.type ?? ""),
				address:
					typeof publicAccount.address === "string"
						? publicAccount.address
						: undefined,
				email:
					typeof publicAccount.email === "string"
						? publicAccount.email
						: undefined,
			} satisfies PublicLinkedAccount;
		});
		const summary = deriveIdentitySummary(accounts);
		return {
			...summary,
			smartWallet:
				summary.smartWallet ?? smartWalletClient?.account?.address?.toString(),
		};
	}, [smartWalletClient, user]);

	const api = useMemo(
		() =>
			publicAppConfig.apiUrl
				? createIdentityApi(publicAppConfig.apiUrl)
				: undefined,
		[],
	);

	async function establishSession() {
		if (!api) {
			setPhase("error");
			setMessage("尚未配置 BabySteps Worker API 地址。");
			return;
		}
		const signer = wallets.find((wallet) => wallet.linked) ?? wallets[0];
		if (!signer || !isAddress(signer.address)) {
			setPhase("error");
			setMessage("请先在 Privy 中关联一个可签名的 EVM 钱包。");
			return;
		}

		setPhase("signing");
		setMessage("请在钱包中签署一次无 Gas 登录消息。");
		try {
			await measurePerformance("web3.privy.login", () =>
				api.login(getAddress(signer.address), (value) => signer.sign(value)),
			);
			const nextProfile = await api.getProfile();
			setProfile(nextProfile);
			setUsername(nextProfile.username ?? "");
			setPhase("ready");
			setMessage("签名已由 Worker 校验，HttpOnly 会话已建立。");
		} catch (error) {
			setPhase("error");
			setMessage(error instanceof Error ? error.message : "身份验证失败。");
		}
	}

	async function saveProfile() {
		if (!api || !profile) return;
		setPhase("saving");
		try {
			const normalized = normalizeUsername(username);
			const nextProfile = await api.updateProfile(normalized);
			setProfile(nextProfile);
			setUsername(nextProfile.username ?? "");
			setPhase("ready");
			setMessage("用户名已保存到链下 D1，并写入审计日志。");
		} catch (error) {
			setPhase("error");
			setMessage(error instanceof Error ? error.message : "用户名保存失败。");
		}
	}

	async function signOut() {
		await api?.logout().catch(() => undefined);
		await logout();
		setProfile(undefined);
		setUsername("");
		setPhase("idle");
		setMessage(undefined);
	}

	if (!ready) return <p role="status">正在初始化 Privy 身份服务…</p>;

	return (
		<div className="identity-layout">
			<section className="identity-card" aria-labelledby="identity-login-title">
				<p className="section-kicker">PRIVY IDENTITY</p>
				<h2 id="identity-login-title">登录与钱包能力</h2>
				<p>
					Google、邮箱和外部钱包是三种登录入口；Smart Wallet
					是登录后的链上账户能力，不是第四种登录方式。
				</p>
				<div className="identity-status-grid">
					<div>
						<span>Google</span>
						<strong>{identity.hasGoogle ? "已关联" : "可选登录"}</strong>
					</div>
					<div>
						<span>邮箱</span>
						<strong>{identity.hasEmail ? "已关联" : "可选登录"}</strong>
					</div>
					<div>
						<span>外部钱包</span>
						<strong>{compactAddress(identity.externalWallet)}</strong>
					</div>
					<div>
						<span>Smart Wallet</span>
						<strong>{compactAddress(identity.smartWallet)}</strong>
					</div>
				</div>
				<p className="identity-note">
					Smart Wallet 默认惰性部署：只有真正发送用户操作时才上链。未启用
					Paymaster，不承诺代付 Gas。
				</p>
				<div className="button-row">
					{!authenticated ? (
						<button
							className="button"
							type="button"
							onClick={login}
							disabled={!ready}
						>
							使用 Privy 登录
						</button>
					) : (
						<>
							<button
								className="button"
								type="button"
								onClick={establishSession}
								disabled={!walletsReady || phase === "signing"}
							>
								{phase === "signing" ? "等待签名…" : "建立 BabySteps 签名会话"}
							</button>
							<button
								className="button button--secondary"
								type="button"
								onClick={signOut}
							>
								退出登录
							</button>
						</>
					)}
				</div>
				{message ? (
					<p
						className={`identity-message identity-message--${phase}`}
						role="status"
					>
						{message}
					</p>
				) : null}
			</section>

			<section
				className="identity-card"
				aria-labelledby="identity-profile-title"
			>
				<p className="section-kicker">CHAIN-OFFCHAIN BOUNDARY</p>
				<h2 id="identity-profile-title">个人资料</h2>
				<p>钱包签名证明账户控制权；用户名保存在 D1，不把个人资料写入公开链。</p>
				<label htmlFor="profile-username">用户名（2–32 个安全字符）</label>
				<input
					id="profile-username"
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					disabled={!profile || phase === "saving"}
					maxLength={32}
				/>
				<button
					className="button"
					type="button"
					onClick={saveProfile}
					disabled={!profile || phase === "saving"}
				>
					{phase === "saving" ? "保存中…" : "保存用户名"}
				</button>
				<p className="identity-note">
					{profile
						? `当前会话钱包：${compactAddress(profile.wallet)}`
						: "先完成 Privy 登录与钱包签名，才可修改用户名。"}
				</p>
			</section>
		</div>
	);
}
