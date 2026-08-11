export type ProfileRow = {
	wallet: string;
	username: string;
	created_at: number;
	updated_at: number;
};

export class ProfileRepository {
	constructor(private readonly database: D1Database) {}

	find(wallet: string): Promise<ProfileRow | null> {
		return this.database
			.prepare("SELECT * FROM profiles WHERE wallet = ?")
			.bind(wallet)
			.first<ProfileRow>();
	}

	async update(
		wallet: string,
		username: string,
		now: number,
	): Promise<ProfileRow> {
		const previous = await this.find(wallet);
		const auditId = crypto.randomUUID();
		await this.database.batch([
			this.database
				.prepare(
					`INSERT INTO profiles (wallet, username, created_at, updated_at)
					VALUES (?, ?, ?, ?)
					ON CONFLICT(wallet) DO UPDATE SET username = excluded.username, updated_at = excluded.updated_at`,
				)
				.bind(wallet, username, previous?.created_at ?? now, now),
			this.database
				.prepare(
					`INSERT INTO audit_logs
					(id, actor_wallet, action, resource_type, resource_id, detail_json, created_at)
					VALUES (?, ?, ?, 'profile', ?, ?, ?)`,
				)
				.bind(
					auditId,
					wallet,
					"profile.updated",
					wallet,
					JSON.stringify({
						oldUsername: previous?.username ?? null,
						newUsername: username,
					}),
					now,
				),
		]);

		return {
			wallet,
			username,
			created_at: previous?.created_at ?? now,
			updated_at: now,
		};
	}
}
