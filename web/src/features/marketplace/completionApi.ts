import { measureBusinessPerformance } from "../../performance/runtime";

type Fetcher = typeof fetch;

type ErrorEnvelope = { error?: { message?: string } };

export type TaskContent = {
	taskKey: string;
	purchaseId: string;
	videoUrl: string;
	completionInstructions: string;
};

export type CompletionSubmission = {
	id: string;
	taskKey?: string;
	purchaseId?: string;
	buyerWallet?: string;
	evidence?: string;
	evidenceHash: string;
	certificateUri?: string;
	createdAt?: number;
};

export type CompletionInput = {
	evidence: string;
	certificateUri: string;
};

async function readJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as ErrorEnvelope;
		throw new Error(
			body.error?.message ?? `BabySteps API failed (${response.status}).`,
		);
	}
	return (await response.json()) as T;
}

export function createCompletionApi(apiUrl: string, fetcher: Fetcher = fetch) {
	const base = apiUrl.replace(/\/$/u, "");
	const taskPath = (taskKey: string, suffix: string) =>
		`${base}/api/tasks/${encodeURIComponent(taskKey)}/${suffix}`;

	return {
		getContent(taskKey: string): Promise<TaskContent> {
			return measureBusinessPerformance(
				"business.marketplace.content_unlock",
				() =>
					fetcher(taskPath(taskKey, "content"), {
						credentials: "include",
					}).then(readJson<TaskContent>),
			);
		},
		submit(
			taskKey: string,
			input: CompletionInput,
		): Promise<CompletionSubmission> {
			return measureBusinessPerformance(
				"business.marketplace.completion_submit",
				() =>
					fetcher(taskPath(taskKey, "completions"), {
						method: "POST",
						credentials: "include",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(input),
					}).then(readJson<CompletionSubmission>),
			);
		},
		list(): Promise<{ completions: CompletionSubmission[] }> {
			return fetcher(`${base}/api/completions`, {
				credentials: "include",
			}).then(readJson<{ completions: CompletionSubmission[] }>);
		},
	};
}

export type CompletionApi = ReturnType<typeof createCompletionApi>;
