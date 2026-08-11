export type ChallengeRow = {
	id: string;
	wallet: string;
	action: string;
	nonce_hash: string;
	message: string;
	expires_at: number;
	used_at: number | null;
	created_at: number;
};

export type SessionRow = {
	id: string;
	wallet: string;
	token_hash: string;
	expires_at: number;
	revoked_at: number | null;
	created_at: number;
};

export class AuthRepository {
	constructor(private readonly database: D1Database) {}

	async createChallenge(row: ChallengeRow): Promise<void> {
		await this.database
			.prepare(
				`INSERT INTO auth_challenges
				(id, wallet, action, nonce_hash, message, expires_at, used_at, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				row.id,
				row.wallet,
				row.action,
				row.nonce_hash,
				row.message,
				row.expires_at,
				row.used_at,
				row.created_at,
			)
			.run();
	}

	findChallenge(id: string): Promise<ChallengeRow | null> {
		return this.database
			.prepare("SELECT * FROM auth_challenges WHERE id = ?")
			.bind(id)
			.first<ChallengeRow>();
	}

	async consumeChallenge(id: string, now: number): Promise<boolean> {
		const result = await this.database
			.prepare(
				"UPDATE auth_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?",
			)
			.bind(now, id, now)
			.run();

		return result.meta.changes === 1;
	}

	async createSession(row: SessionRow): Promise<void> {
		await this.database
			.prepare(
				`INSERT INTO sessions
				(id, wallet, token_hash, expires_at, revoked_at, created_at)
				VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				row.id,
				row.wallet,
				row.token_hash,
				row.expires_at,
				row.revoked_at,
				row.created_at,
			)
			.run();
	}

	findLiveSession(tokenHash: string, now: number): Promise<SessionRow | null> {
		return this.database
			.prepare(
				"SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?",
			)
			.bind(tokenHash, now)
			.first<SessionRow>();
	}

	async revokeSession(id: string, now: number): Promise<void> {
		await this.database
			.prepare(
				"UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
			)
			.bind(now, id)
			.run();
	}
}
