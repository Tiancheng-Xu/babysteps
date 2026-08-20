import type { TaskKey } from "../domain/taskIdentity";

export type CompletionSubmissionRow = {
	id: string;
	task_key: TaskKey;
	purchase_id: string;
	buyer_wallet: string;
	evidence_text: string;
	evidence_hash: `0x${string}`;
	certificate_uri: string;
	created_at: number;
};

export class CompletionRepository {
	constructor(private readonly database: D1Database) {}

	findByPurchaseId(
		purchaseId: string,
	): Promise<CompletionSubmissionRow | null> {
		return this.database
			.prepare("SELECT * FROM completion_submissions WHERE purchase_id = ?")
			.bind(purchaseId)
			.first<CompletionSubmissionRow>();
	}

	list(): Promise<CompletionSubmissionRow[]> {
		return this.database
			.prepare("SELECT * FROM completion_submissions ORDER BY created_at DESC")
			.all<CompletionSubmissionRow>()
			.then(({ results }) => results);
	}

	async create(
		input: Omit<CompletionSubmissionRow, "id" | "created_at">,
		actorWallet: string,
		now: number,
	): Promise<CompletionSubmissionRow> {
		const row: CompletionSubmissionRow = {
			...input,
			id: crypto.randomUUID(),
			created_at: now,
		};
		await this.database.batch([
			this.database
				.prepare(
					`INSERT INTO completion_submissions
					(id, task_key, purchase_id, buyer_wallet, evidence_text, evidence_hash, certificate_uri, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					row.id,
					row.task_key,
					row.purchase_id,
					row.buyer_wallet,
					row.evidence_text,
					row.evidence_hash,
					row.certificate_uri,
					row.created_at,
				),
			this.database
				.prepare(
					`INSERT INTO audit_logs
					(id, actor_wallet, action, resource_type, resource_id, detail_json, created_at)
					VALUES (?, ?, 'completion.submitted', 'completion', ?, ?, ?)`,
				)
				.bind(
					crypto.randomUUID(),
					actorWallet,
					row.id,
					JSON.stringify({
						taskKey: row.task_key,
						purchaseId: row.purchase_id,
						evidenceHash: row.evidence_hash,
					}),
					now,
				),
		]);
		return row;
	}
}
