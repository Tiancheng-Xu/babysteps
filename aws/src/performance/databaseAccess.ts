import type { SqlQueryable } from "../repositories/postgresCompletionJobs";

type ProjectDatabaseCredentials = { username: string; password: string };

async function formattedStatement(
	database: SqlQueryable,
	template: string,
	values: readonly unknown[],
): Promise<string> {
	const result = await database.query(
		`SELECT format('${template}', ${values.map((_, index) => `$${index + 1}::text`).join(", ")}) AS statement`,
		values,
	);
	const statement = result.rows[0]?.statement;
	if (typeof statement !== "string") throw new Error("DATABASE_FORMAT_FAILED");
	return statement;
}

export async function initializePerformanceDatabase(
	database: SqlQueryable,
	credentials: ProjectDatabaseCredentials,
	migration = "",
) {
	const existing = await database.query(
		"SELECT 1 FROM pg_roles WHERE rolname = $1",
		[credentials.username],
	);
	if (existing.rowCount === 0) {
		await database.query(
			await formattedStatement(database, "CREATE ROLE %I LOGIN PASSWORD %L", [
				credentials.username,
				credentials.password,
			]),
		);
	}
	if (migration) await database.query(migration);
	for (const template of [
		"GRANT USAGE ON SCHEMA babysteps_performance TO %I",
		"GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA babysteps_performance TO %I",
	]) {
		await database.query(
			await formattedStatement(database, template, [credentials.username]),
		);
	}
}

export async function cleanupPerformanceDatabase(
	database: SqlQueryable,
	username: string,
) {
	await database.query("DROP SCHEMA IF EXISTS babysteps_performance CASCADE");
	await database.query(
		await formattedStatement(database, "DROP ROLE IF EXISTS %I", [username]),
	);
}
