import { publicAppConfig } from "../contracts/web3Contracts";
import { PrivyIdentityPanel } from "../features/identity/PrivyIdentityPanel";

export function ProfilePage() {
	return (
		<section className="product-page identity-page">
			<header className="product-page__hero product-page__hero--identity">
				<div>
					<p className="section-kicker">PERSONAL CENTER</p>
					<h1>个人中心</h1>
					<p>登录只是入口；钱包签名建立可信会话，链下资料保持可修改。</p>
				</div>
				<div className="provider-role-badge">Privy + SIWE 风格签名校验</div>
			</header>

			{publicAppConfig.privyAppId ? (
				<PrivyIdentityPanel />
			) : (
				<section className="identity-card" aria-labelledby="privy-setup-title">
					<p className="section-kicker">CONFIGURATION REQUIRED</p>
					<h2 id="privy-setup-title">Privy 待配置</h2>
					<p>
						代码已限制为 Google、邮箱、外部钱包三种入口，并接入 Smart
						Wallet；请在公开环境变量中配置 VITE_PRIVY_APP_ID
						后完成真实登录验证。
					</p>
					<p className="identity-note">
						App ID 是公开标识，不是 API Secret；任何私钥或服务端密钥都不得放进
						Vite 环境变量。
					</p>
				</section>
			)}
		</section>
	);
}
