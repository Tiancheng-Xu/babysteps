import type { ProviderActivity } from "../features/provider/useProviderTaskCreation";
import { useProviderTaskCreation } from "../features/provider/useProviderTaskCreation";

const EXPLORER_TX_BASE = "https://sepolia.etherscan.io/tx/";

export function ProviderConsolePage() {
	const provider = useProviderTaskCreation();
	const fieldsEnabled = provider.phase === "ready" && provider.hasProviderRole;
	const buttonLabel = provider.isPending
		? provider.phase === "awaiting-signature"
			? "请确认创建"
			: "创建确认中"
		: provider.canSubmit
			? "创建并请求 VRF"
			: provider.isConfigured
				? "填写有效元数据后创建"
				: "等待市场合约部署";

	return (
		<section className="product-page" aria-labelledby="provider-heading">
			<header className="product-page__hero product-page__hero--provider">
				<div>
					<p className="product-page__eyebrow">链上角色控制</p>
					<h1 id="provider-heading">机构与育婴师控制台</h1>
					<p>
						只有管理员已授予 PROVIDER_ROLE
						的测试钱包可以创建成长任务，价格不能由发布者挑选或重抽。
					</p>
				</div>
				<span className="provider-role-badge">
					{provider.hasProviderRole ? "PROVIDER_ROLE 已授权" : "PROVIDER_ROLE"}
				</span>
			</header>

			<div className="provider-layout">
				<form
					className="provider-form-card"
					aria-labelledby="create-task-heading"
					onSubmit={(event) => {
						event.preventDefault();
						void provider.createTask();
					}}
				>
					<h2 id="create-task-heading">创建成长任务</h2>
					<label htmlFor="provider-task-kind">任务类型</label>
					<select
						id="provider-task-kind"
						disabled={!fieldsEnabled}
						value={provider.activity}
						onChange={(event) =>
							provider.setActivity(event.target.value as ProviderActivity)
						}
					>
						<option value="meal">喂养陪伴</option>
						<option value="walk">户外陪伴</option>
						<option value="read">亲子共读</option>
					</select>
					<label htmlFor="provider-task-uri">公开元数据 URI</label>
					<input
						id="provider-task-uri"
						type="url"
						placeholder="ipfs://…"
						disabled={!fieldsEnabled}
						value={provider.metadataUri}
						onChange={(event) => provider.setMetadataUri(event.target.value)}
					/>
					<button
						type="submit"
						className="button button--web3"
						disabled={!provider.canSubmit || provider.isPending}
					>
						{buttonLabel}
					</button>
					{provider.walletState === "wrong-network" ? (
						<button
							type="button"
							className="button button--secondary"
							onClick={() => void provider.switchToSepolia()}
						>
							切换到 Sepolia
						</button>
					) : null}
					{provider.message ? (
						<div
							className={
								provider.phase === "error"
									? "transaction-panel transaction-panel--error"
									: "transaction-panel"
							}
							role={provider.phase === "error" ? "alert" : "status"}
						>
							{provider.message}
						</div>
					) : null}
					{provider.transactionHash ? (
						<a
							className="explorer-link"
							href={`${EXPLORER_TX_BASE}${provider.transactionHash}`}
							target="_blank"
							rel="noreferrer"
						>
							查看任务创建交易
						</a>
					) : null}
				</form>

				<section
					className="provider-lifecycle"
					aria-labelledby="lifecycle-heading"
				>
					<h2 id="lifecycle-heading">任务生命周期</h2>
					<ol>
						<li>
							<strong>1</strong>
							<span>Provider 提交任务元数据</span>
						</li>
						<li>
							<strong>2</strong>
							<span>等待 VRF 返回两个随机数</span>
						</li>
						<li>
							<strong>3</strong>
							<span>价格和开放时长锁定</span>
						</li>
						<li>
							<strong>4</strong>
							<span>家长 approve 后购买</span>
						</li>
					</ol>
				</section>
			</div>
		</section>
	);
}
