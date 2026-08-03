import { useState } from "react";

import { getNoteByteLength, NOTE_BYTE_LIMIT } from "../../lib/noteBytes";
import { useNotebook } from "./useNotebook";

const EXPLORER_TX_BASE = "https://sepolia.etherscan.io/tx/";

export function NotebookPanel() {
	const notebook = useNotebook();
	const [clearArmed, setClearArmed] = useState(false);
	const byteLength = getNoteByteLength(notebook.draft);
	const isPending =
		notebook.phase === "awaiting-signature" || notebook.phase === "confirming";
	const isError =
		notebook.phase === "read-error" || notebook.phase === "write-error";
	const saveDisabled =
		!notebook.canSave || byteLength > NOTE_BYTE_LIMIT || isPending;

	return (
		<section
			className="story-card notebook-panel"
			aria-labelledby="notebook-heading"
		>
			<div className="story-card__header">
				<div>
					<h2 id="notebook-heading">步骤 4 · 链上家庭便签</h2>
					<h3 className="story-card__title">公开链上便签</h3>
				</div>
				<span className="status-pill status-pill--warning">公开内容</span>
			</div>

			<div className="notebook-shell">
				<div>
					<div className="privacy-warning">
						<strong>写入前请确认：</strong>
						链上内容公开，清空只改变当前显示，历史交易仍然公开。不要在便签中写入儿童姓名、照片、生日、学校、位置、健康或疫苗信息。
					</div>

					<div className="chain-note">
						<span>当前链上便签</span>
						<p>
							{notebook.chainNote === undefined
								? "尚未读取"
								: notebook.chainNote || "当前为空"}
						</p>
					</div>
				</div>

				<div className="note-form-card">
					<label className="field-label" htmlFor="public-note">
						测试便签
					</label>
					<textarea
						id="public-note"
						value={notebook.draft}
						onChange={(event) => notebook.setDraft(event.target.value)}
						placeholder="今天完成了一次 Sepolia 测试"
						disabled={isPending}
						aria-describedby="note-byte-count"
					/>
					<p
						id="note-byte-count"
						className={
							byteLength > NOTE_BYTE_LIMIT
								? "byte-count byte-count--error"
								: "byte-count"
						}
					>
						{byteLength} / {NOTE_BYTE_LIMIT} 字节
					</p>

					<div className="button-row">
						<button
							type="button"
							className="button button--primary"
							disabled={saveDisabled}
							onClick={() => void notebook.save()}
						>
							保存当前便签
						</button>
						<button
							type="button"
							className="button button--danger"
							disabled={!notebook.canClear || isPending}
							onClick={() => setClearArmed(true)}
						>
							清空当前便签
						</button>
					</div>
				</div>
			</div>

			{clearArmed ? (
				<div
					className="transaction-panel transaction-panel--error"
					role="alert"
				>
					<p>历史交易仍公开，确认只清空当前显示？</p>
					<div className="button-row">
						<button
							type="button"
							className="button button--danger"
							onClick={() => {
								setClearArmed(false);
								void notebook.clear();
							}}
						>
							确认清空当前便签
						</button>
						<button
							type="button"
							className="button button--ghost"
							onClick={() => setClearArmed(false)}
						>
							取消
						</button>
					</div>
				</div>
			) : null}

			{notebook.message ? (
				<div
					className={
						isError
							? "transaction-panel transaction-panel--error"
							: "transaction-panel"
					}
					role={isError ? "alert" : "status"}
					aria-live="polite"
				>
					<p>{notebook.message}</p>
					{notebook.phase === "read-error" ? (
						<button
							type="button"
							className="button button--secondary"
							onClick={() => void notebook.retryRead()}
						>
							重试读取便签
						</button>
					) : null}
				</div>
			) : null}

			{notebook.transactionHash ? (
				<a
					className="explorer-link"
					href={`${EXPLORER_TX_BASE}${notebook.transactionHash}`}
					target="_blank"
					rel="noreferrer"
				>
					查看便签交易
				</a>
			) : null}
		</section>
	);
}
