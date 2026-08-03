import { usePointTransfer } from "./usePointTransfer";

const EXPLORER_TX_BASE = "https://sepolia.etherscan.io/tx/";

export function PointTransferPanel() {
	const transfer = usePointTransfer();
	const isError =
		transfer.phase === "read-error" || transfer.phase === "write-error";
	const showValidation =
		Boolean(transfer.recipient || transfer.amount) &&
		Boolean(transfer.validationMessage);

	return (
		<section className="story-card transfer-panel" aria-labelledby="transfer-heading">
			<div className="story-card__header">
				<div>
					<h2 id="transfer-heading">步骤 3 · 测试钱包赠送</h2>
					<h3 className="story-card__title">把成长星送给另一个测试钱包</h3>
				</div>
				<span className="status-pill status-pill--web3">仅限 Sepolia</span>
			</div>

			<div className="transfer-shell">
				<div className="transfer-summary" aria-live="polite">
					<div className="metric-tile metric-tile--warm">
						<p className="metric-tile__label">可赠送成长星</p>
						<p className="metric-tile__value">
							{transfer.balance?.toString() ?? "读取中"}
						</p>
					</div>
					<p className="helper-copy">
						累计养成值只来自当前钱包记录的活动；收到的成长星不会增加星宝阶段；赠送也不会让星宝退化。
					</p>
					<p className="privacy-warning" id="transfer-public-warning">
						接收地址、数量和交易会长期公开；测试链转账无法撤回，请逐字核对地址。
					</p>
				</div>

				<form
					className="transfer-form-card"
					onSubmit={(event) => {
						event.preventDefault();
						void transfer.transfer();
					}}
				>
					<div className="field-group">
						<label className="field-label" htmlFor="transfer-recipient">
							Sepolia 收款钱包地址
						</label>
						<input
							id="transfer-recipient"
							type="text"
							autoComplete="off"
							spellCheck={false}
							placeholder="0x…"
							value={transfer.recipient}
							aria-describedby="transfer-public-warning transfer-validation"
							aria-invalid={showValidation || undefined}
							onChange={(event) => transfer.setRecipient(event.target.value)}
						/>
					</div>
					<div className="field-group">
						<label className="field-label" htmlFor="transfer-amount">
							赠送数量
						</label>
						<input
							id="transfer-amount"
							type="text"
							inputMode="numeric"
							autoComplete="off"
							placeholder="整数"
							value={transfer.amount}
							aria-describedby="transfer-public-warning transfer-validation"
							aria-invalid={showValidation || undefined}
							onChange={(event) => transfer.setAmount(event.target.value)}
						/>
					</div>
					<button
						type="submit"
						className="button button--primary transfer-form__submit"
						disabled={!transfer.canTransfer || transfer.isPending}
					>
						确认赠送成长星
					</button>
				</form>
			</div>

			{showValidation ? (
				<p
					className="transaction-panel transaction-panel--error"
					id="transfer-validation"
					role="alert"
				>
					{transfer.validationMessage}
				</p>
			) : (
				<span id="transfer-validation" className="visually-hidden">
					输入有效地址和不超过余额的正整数
				</span>
			)}

			{transfer.message ? (
				<div
					className={
						isError
							? "transaction-panel transaction-panel--error"
							: "transaction-panel"
					}
					role={isError ? "alert" : "status"}
					aria-live="polite"
				>
					<p>{transfer.message}</p>
					{transfer.phase === "read-error" ? (
						<button
							type="button"
							className="button button--secondary"
							onClick={() => void transfer.retryRead()}
						>
							重试读取可赠送余额
						</button>
					) : null}
					{transfer.walletState === "wrong-network" ? (
						<button
							type="button"
							className="button button--secondary"
							onClick={() => void transfer.switchToSepolia()}
						>
							切换到 Sepolia
						</button>
					) : null}
				</div>
			) : null}

			{transfer.transactionHash ? (
				<a
					className="explorer-link"
					href={`${EXPLORER_TX_BASE}${transfer.transactionHash}`}
					target="_blank"
					rel="noreferrer"
				>
					查看赠送交易
				</a>
			) : null}
		</section>
	);
}
