import type { TaskKey } from "../domain/taskIdentity";
import type { TaskMetadata } from "../domain/taskMetadata";

export type TaskDraftRow = {
	id: string;
	provider_wallet: string;
	metadata_json: string;
	metadata_hash: `0x${string}`;
	created_at: number;
	updated_at: number;
};

export type PublishedTaskRow = {
	task_key: TaskKey;
	draft_id: string;
	chain_id: number;
	marketplace_address: `0x${string}`;
	task_id: string;
	transaction_hash: `0x${string}`;
	metadata_hash: `0x${string}`;
	created_at: number;
};

export class TaskRepository {
	constructor(private readonly database: D1Database) {}

	async createDraft(
		providerWallet: string,
		metadata: TaskMetadata,
		metadataJson: string,
		metadataHash: `0x${string}`,
		now: number,
	): Promise<TaskDraftRow> {
		const id = crypto.randomUUID();
		await this.database.batch([
			this.database
				.prepare(
					`INSERT INTO task_drafts
					(id, provider_wallet, metadata_json, metadata_hash, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?)`,
				)
				.bind(id, providerWallet, metadataJson, metadataHash, now, now),
			this.auditStatement(
				providerWallet,
				"task-draft.created",
				id,
				{ metadataHash, activityType: metadata.activityType },
				now,
			),
		]);

		return {
			id,
			provider_wallet: providerWallet,
			metadata_json: metadataJson,
			metadata_hash: metadataHash,
			created_at: now,
			updated_at: now,
		};
	}

	findDraft(id: string): Promise<TaskDraftRow | null> {
		return this.database
			.prepare("SELECT * FROM task_drafts WHERE id = ?")
			.bind(id)
			.first<TaskDraftRow>();
	}

	async updateDraft(
		row: TaskDraftRow,
		metadata: TaskMetadata,
		metadataJson: string,
		metadataHash: `0x${string}`,
		now: number,
	): Promise<TaskDraftRow> {
		await this.database.batch([
			this.database
				.prepare(
					"UPDATE task_drafts SET metadata_json = ?, metadata_hash = ?, updated_at = ? WHERE id = ?",
				)
				.bind(metadataJson, metadataHash, now, row.id),
			this.auditStatement(
				row.provider_wallet,
				"task-draft.updated",
				row.id,
				{ metadataHash, activityType: metadata.activityType },
				now,
			),
		]);

		return {
			...row,
			metadata_json: metadataJson,
			metadata_hash: metadataHash,
			updated_at: now,
		};
	}

	findPublishedByDraft(draftId: string): Promise<PublishedTaskRow | null> {
		return this.database
			.prepare("SELECT * FROM published_tasks WHERE draft_id = ?")
			.bind(draftId)
			.first<PublishedTaskRow>();
	}

	findPublished(taskKey: string): Promise<PublishedTaskRow | null> {
		return this.database
			.prepare("SELECT * FROM published_tasks WHERE task_key = ?")
			.bind(taskKey)
			.first<PublishedTaskRow>();
	}

	async bindTask(row: PublishedTaskRow, actorWallet: string): Promise<void> {
		await this.database.batch([
			this.database
				.prepare(
					`INSERT INTO published_tasks
					(task_key, draft_id, chain_id, marketplace_address, task_id, transaction_hash, metadata_hash, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					row.task_key,
					row.draft_id,
					row.chain_id,
					row.marketplace_address,
					row.task_id,
					row.transaction_hash,
					row.metadata_hash,
					row.created_at,
				),
			this.auditStatement(
				actorWallet,
				"task-draft.bound",
				row.draft_id,
				{
					taskKey: row.task_key,
					transactionHash: row.transaction_hash,
					metadataHash: row.metadata_hash,
				},
				row.created_at,
			),
		]);
	}

	private auditStatement(
		actorWallet: string,
		action: string,
		resourceId: string,
		detail: Record<string, unknown>,
		now: number,
	): D1PreparedStatement {
		return this.database
			.prepare(
				`INSERT INTO audit_logs
				(id, actor_wallet, action, resource_type, resource_id, detail_json, created_at)
				VALUES (?, ?, ?, 'task-draft', ?, ?, ?)`,
			)
			.bind(
				crypto.randomUUID(),
				actorWallet,
				action,
				resourceId,
				JSON.stringify(detail),
				now,
			);
	}
}
