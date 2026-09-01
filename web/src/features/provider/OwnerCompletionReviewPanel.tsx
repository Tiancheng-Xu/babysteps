import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { publicAppConfig } from "../../contracts/web3Contracts";
import {
	type CompletionApi,
	type CompletionSubmission,
	createCompletionApi,
} from "../marketplace/completionApi";
import { useOwnerCompletionConfirmation } from "./useOwnerCompletionConfirmation";

type ReviewRecord = CompletionSubmission & {
	taskKey: string;
	purchaseId: string;
	buyerWallet: string;
	evidence: string;
	certificateUri: string;
	evidenceHash: `0x${string}`;
};

let nextCompletionReviewScope = 0;

function isReviewRecord(value: CompletionSubmission): value is ReviewRecord {
	return (
		typeof value.taskKey === "string" &&
		typeof value.purchaseId === "string" &&
		typeof value.buyerWallet === "string" &&
		typeof value.evidence === "string" &&
		typeof value.certificateUri === "string" &&
		/^0x[0-9a-fA-F]{64}$/u.test(value.evidenceHash)
	);
}

function shortValue(value: string) {
	return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function CompletionReviewCard({ record }: { record: ReviewRecord }) {
	const confirmation = useOwnerCompletionConfirmation({
		purchaseId: record.purchaseId,
		evidenceHash: record.evidenceHash,
		certificateUri: record.certificateUri,
	});

	return (
		<article className="marketplace-task-card">
			<div className="marketplace-task-card__heading">
				<span>购买 #{record.purchaseId}</span>
				<strong>{shortValue(record.buyerWallet)}</strong>
			</div>
			<p>{record.evidence}</p>
			<dl>
				<div>
					<dt>证据哈希</dt>
					<dd>{shortValue(record.evidenceHash)}</dd>
				</div>
				<div>
					<dt>任务键</dt>
					<dd>{shortValue(record.taskKey)}</dd>
				</div>
			</dl>
			<button
				type="button"
				className="button button--web3"
				disabled={!confirmation.canConfirm || confirmation.isPending}
				onClick={() => void confirmation.confirm()}
			>
				确认任务完成并铸造 SBT
			</button>
			{confirmation.message ? (
				<p role={confirmation.phase === "error" ? "alert" : "status"}>
					{confirmation.message}
				</p>
			) : null}
		</article>
	);
}

export function OwnerCompletionReviewPanel({
	api = publicAppConfig.apiUrl
		? createCompletionApi(publicAppConfig.apiUrl)
		: undefined,
}: {
	api?: CompletionApi;
}) {
	const queryClient = useQueryClient();
	const [queryKey] = useState(
		() =>
			["provider", "completion-reviews", ++nextCompletionReviewScope] as const,
	);
	const completionReviews = useQuery({
		queryKey,
		queryFn: async () => {
			if (!api) throw new Error("任务完成审核 API 未配置。");
			const response = await api.list();
			return response.completions.filter(isReviewRecord);
		},
		enabled: false,
		gcTime: 0,
		retry: false,
	});
	useEffect(
		() => () => {
			void queryClient.cancelQueries({ queryKey, exact: true });
			queryClient.removeQueries({ queryKey, exact: true });
		},
		[queryClient, queryKey],
	);
	const records =
		completionReviews.isSuccess && !completionReviews.isFetching
			? (completionReviews.data ?? [])
			: [];
	const message = completionReviews.error
		? completionReviews.error.message
		: completionReviews.isSuccess && records.length === 0
			? "当前没有待审核的任务完成申请。"
			: undefined;

	return (
		<section
			className="provider-form-card"
			aria-labelledby="completion-review-heading"
		>
			<h2 id="completion-review-heading">任务完成审核与成长证书</h2>
			<p>从 D1 读取申请，最终完成状态与 SBT 归属以 Sepolia 合约为准。</p>
			<button
				type="button"
				className="button button--secondary"
				disabled={!api || completionReviews.isFetching}
				onClick={() => void completionReviews.refetch()}
			>
				{completionReviews.isFetching ? "正在加载" : "加载任务完成申请"}
			</button>
			{message ? <p role="status">{message}</p> : null}
			<div className="marketplace-task-grid">
				{records.map((record) => (
					<CompletionReviewCard key={record.id} record={record} />
				))}
			</div>
		</section>
	);
}
