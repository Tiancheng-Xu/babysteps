import { useState } from "react";
import { publicAppConfig } from "../../contracts/web3Contracts";
import {
	type CompletionApi,
	createCompletionApi,
	type TaskContent,
} from "./completionApi";

const CERTIFICATE_URI =
	"https://babysteps.baby2b.online/metadata/sepolia-demo-certificate.json";

export function TaskLearningPanel({
	taskKey,
	api = publicAppConfig.apiUrl
		? createCompletionApi(publicAppConfig.apiUrl)
		: undefined,
}: {
	taskKey: string;
	api?: CompletionApi;
}) {
	const [content, setContent] = useState<TaskContent>();
	const [evidence, setEvidence] = useState("");
	const [message, setMessage] = useState<string>();
	const [busy, setBusy] = useState(false);

	const unlock = async () => {
		if (!api || busy) return;
		setBusy(true);
		setMessage(undefined);
		try {
			setContent(await api.getContent(taskKey));
		} catch (error) {
			setMessage((error as Error).message);
		} finally {
			setBusy(false);
		}
	};

	const submit = async () => {
		if (!api || busy || evidence.trim().length < 2) return;
		setBusy(true);
		setMessage(undefined);
		try {
			const result = await api.submit(taskKey, {
				evidence: evidence.trim(),
				certificateUri: CERTIFICATE_URI,
			});
			setMessage(`证据哈希已生成：${result.evidenceHash.slice(0, 10)}…`);
		} catch (error) {
			setMessage((error as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="task-learning-panel" aria-label="已购任务学习内容">
			{content ? (
				<>
					<p>{content.completionInstructions}</p>
					<a href={content.videoUrl} target="_blank" rel="noreferrer">
						打开任务视频
					</a>
					<label htmlFor={`completion-evidence-${content.purchaseId}`}>
						完成说明
					</label>
					<textarea
						id={`completion-evidence-${content.purchaseId}`}
						maxLength={280}
						value={evidence}
						onChange={(event) => setEvidence(event.target.value)}
						placeholder="仅说明完成情况，不填写儿童个人信息"
					/>
					<button
						type="button"
						className="button button--secondary"
						disabled={busy || evidence.trim().length < 2}
						onClick={() => void submit()}
					>
						提交任务完成审核
					</button>
				</>
			) : (
				<button
					type="button"
					className="button button--secondary"
					disabled={!api || busy}
					onClick={() => void unlock()}
				>
					{busy ? "正在验证购买" : "解锁学习内容"}
				</button>
			)}
			{message ? <p role="status">{message}</p> : null}
		</section>
	);
}
