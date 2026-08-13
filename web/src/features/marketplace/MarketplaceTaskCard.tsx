import { formatBabyCoinAmount } from "../babycoin/formatBabyCoinAmount";
import type { MarketplaceTask } from "./marketplaceModel";
import { useTaskPurchase } from "./useTaskPurchase";

const EXPLORER_TX_BASE = "https://sepolia.etherscan.io/tx/";

const TASK_STATE_LABELS = {
	"pending-review": "等待 Owner 审核",
	"pending-randomness": "等待 VRF",
	active: "开放购买",
	paused: "已暂停",
	expired: "已结束",
	rejected: "审核未通过",
} as const;

function shortAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function actionFor(
	task: MarketplaceTask,
	purchase: ReturnType<typeof useTaskPurchase>,
) {
	if (task.state !== "active") {
		return { label: "当前不可购买", disabled: true } as const;
	}
	if (purchase.walletState === "wrong-network") {
		return {
			label: "切换到 Sepolia",
			disabled: false,
			onClick: purchase.switchToSepolia,
		} as const;
	}
	if (
		purchase.walletState === "disconnected" ||
		purchase.walletState === "missing"
	) {
		return { label: "先在家长中心连接钱包", disabled: true } as const;
	}
	if (purchase.phase === "ready-to-approve") {
		return {
			label: `授权 ${task.priceLabel}`,
			disabled: false,
			onClick: purchase.approve,
		} as const;
	}
	if (purchase.phase === "ready-to-buy") {
		return {
			label: `支付 ${task.priceLabel}`,
			disabled: false,
			onClick: purchase.buy,
		} as const;
	}
	if (purchase.phase === "awaiting-approval-signature") {
		return { label: "请确认授权", disabled: true } as const;
	}
	if (purchase.phase === "confirming-approval") {
		return { label: "授权确认中", disabled: true } as const;
	}
	if (purchase.phase === "awaiting-purchase-signature") {
		return { label: "请确认购买", disabled: true } as const;
	}
	if (purchase.phase === "confirming-purchase") {
		return { label: "购买确认中", disabled: true } as const;
	}
	if (purchase.phase === "purchased" || purchase.phase === "success") {
		return { label: "此钱包已购买", disabled: true } as const;
	}
	if (purchase.phase === "loading") {
		return { label: "正在读取余额", disabled: true } as const;
	}
	return { label: "暂时无法购买", disabled: true } as const;
}

export function MarketplaceTaskCard({ task }: { task: MarketplaceTask }) {
	const purchase = useTaskPurchase(task);
	const formattedBalance = formatBabyCoinAmount(purchase.balance);
	const exactBalanceLabel = formattedBalance.exact
		? `完整链上数值 ${formattedBalance.exact} BABY`
		: undefined;
	const action = actionFor(task, purchase);
	const actionHandler = "onClick" in action ? action.onClick : undefined;
	const isError =
		purchase.phase === "read-error" || purchase.phase === "write-error";

	return (
		<article className="marketplace-task-card">
			<div className="marketplace-task-card__heading">
				<span>#{task.id.toString()}</span>
				<strong>{TASK_STATE_LABELS[task.state]}</strong>
			</div>
			<h2>{task.activityLabel}</h2>
			<p className="marketplace-task-card__price">
				{task.state === "pending-randomness" ? "等待随机价格" : task.priceLabel}
			</p>
			{purchase.balance !== undefined ? (
				<p
					className="marketplace-task-card__balance"
					title={exactBalanceLabel}
					aria-live="polite"
				>
					<span>余额</span>
					<strong>{formattedBalance.display}</strong>
					<span translate="no">BABY</span>
					{formattedBalance.isApproximate && exactBalanceLabel ? (
						<span className="visually-hidden">{exactBalanceLabel}</span>
					) : null}
				</p>
			) : null}
			<dl>
				<div>
					<dt>Provider</dt>
					<dd>{shortAddress(task.provider)}</dd>
				</div>
				<div>
					<dt>元数据</dt>
					<dd>{task.metadataUri}</dd>
				</div>
			</dl>
			<button
				type="button"
				className="button button--primary"
				disabled={action.disabled || purchase.isPending}
				onClick={() => {
					if (actionHandler) void actionHandler();
				}}
			>
				{action.label}
			</button>
			{purchase.message ? (
				<div
					className={
						isError
							? "transaction-panel transaction-panel--error"
							: "transaction-panel"
					}
					role={isError ? "alert" : "status"}
				>
					{purchase.message}
				</div>
			) : null}
			<div className="marketplace-task-card__transactions">
				{purchase.approvalHash ? (
					<a
						href={`${EXPLORER_TX_BASE}${purchase.approvalHash}`}
						target="_blank"
						rel="noreferrer"
					>
						查看授权交易
					</a>
				) : null}
				{purchase.purchaseHash ? (
					<a
						href={`${EXPLORER_TX_BASE}${purchase.purchaseHash}`}
						target="_blank"
						rel="noreferrer"
					>
						查看购买交易
					</a>
				) : null}
			</div>
		</article>
	);
}
