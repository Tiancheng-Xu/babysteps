import type { TaskKey } from "../domain/taskIdentity";

export type CommentRow = {
	id: string;
	task_key: TaskKey;
	wallet: string;
	content: string;
	hidden_at: number | null;
	hidden_by: string | null;
	created_at: number;
	updated_at: number;
	username?: string | null;
};

export class CommentRepository {
	constructor(private readonly database: D1Database) {}

	async listVisible(taskKey: TaskKey): Promise<CommentRow[]> {
		const result = await this.database
			.prepare(
				`SELECT c.*, p.username
				FROM comments c
				LEFT JOIN profiles p ON p.wallet = c.wallet
				WHERE c.task_key = ? AND c.hidden_at IS NULL
				ORDER BY c.created_at ASC, c.id ASC`,
			)
			.bind(taskKey)
			.all<CommentRow>();

		return result.results;
	}

	find(id: string): Promise<CommentRow | null> {
		return this.database
			.prepare("SELECT * FROM comments WHERE id = ?")
			.bind(id)
			.first<CommentRow>();
	}

	async create(
		taskKey: TaskKey,
		wallet: string,
		content: string,
		now: number,
	): Promise<CommentRow> {
		const id = crypto.randomUUID();
		await this.database.batch([
			this.database
				.prepare(
					`INSERT INTO comments
					(id, task_key, wallet, content, hidden_at, hidden_by, created_at, updated_at)
					VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
				)
				.bind(id, taskKey, wallet, content, now, now),
			this.auditStatement(wallet, "comment.created", id, { taskKey }, now),
		]);

		return {
			id,
			task_key: taskKey,
			wallet,
			content,
			hidden_at: null,
			hidden_by: null,
			created_at: now,
			updated_at: now,
		};
	}

	async update(
		row: CommentRow,
		content: string,
		now: number,
	): Promise<CommentRow> {
		await this.database.batch([
			this.database
				.prepare("UPDATE comments SET content = ?, updated_at = ? WHERE id = ?")
				.bind(content, now, row.id),
			this.auditStatement(row.wallet, "comment.updated", row.id, {}, now),
		]);

		return { ...row, content, updated_at: now };
	}

	async hide(
		row: CommentRow,
		ownerWallet: string,
		now: number,
	): Promise<CommentRow> {
		if (row.hidden_at !== null) return row;
		await this.database.batch([
			this.database
				.prepare(
					"UPDATE comments SET hidden_at = ?, hidden_by = ? WHERE id = ?",
				)
				.bind(now, ownerWallet, row.id),
			this.auditStatement(
				ownerWallet,
				"comment.hidden",
				row.id,
				{ taskKey: row.task_key },
				now,
			),
		]);

		return { ...row, hidden_at: now, hidden_by: ownerWallet };
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
				VALUES (?, ?, ?, 'comment', ?, ?, ?)`,
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
