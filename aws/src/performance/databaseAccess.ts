import type { SqlQueryable } from "../repositories/postgresCompletionJobs";

type ProjectDatabaseCredentials = { username: string; password: string };

export function performanceSchemaName(runId: string) {
	if (!/^[0-9]+$/u.test(runId)) throw new Error("INVALID_RUN_ID");
	return `babysteps_performance_${runId}`;
}

export function quotePerformanceSchema(runId: string) {
	return `"${performanceSchemaName(runId)}"`;
}

export async function performanceSchemaExists(
	database: SqlQueryable,
	runId: string,
) {
	const result = await database.query(
		'SELECT to_regnamespace($1) AS "schemaOid"',
		[performanceSchemaName(runId)],
	);
	return result.rows[0]?.schemaOid != null;
}

async function existingEventCount(
	database: SqlQueryable,
	runId: string,
): Promise<number | undefined> {
	const schema = performanceSchemaName(runId);
	const existing = await database.query(
		'SELECT to_regclass($1) AS "eventsTable"',
		[`${schema}.events`],
	);
	if (existing.rows[0]?.eventsTable == null) return undefined;
	const count = await database.query(
		`SELECT COUNT(*) AS count FROM ${quotePerformanceSchema(runId)}."events"`,
	);
	return Number(count.rows[0]?.count ?? 0);
}

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
	runId: string,
	credentials: ProjectDatabaseCredentials,
	migration = "",
) {
	const schema = performanceSchemaName(runId);
	const quotedSchema = quotePerformanceSchema(runId);
	const rowsBeforeMigration = await existingEventCount(database, runId);
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
	if (migration) {
		await database.query(
			migration.replaceAll(/\bbabysteps_performance\b/gu, quotedSchema),
		);
	}
	if (rowsBeforeMigration !== undefined) {
		const rowsAfterMigration = await existingEventCount(database, runId);
		if (
			rowsAfterMigration === undefined ||
			rowsAfterMigration < rowsBeforeMigration
		) {
			throw new Error("MIGRATION_DATA_LOSS_DETECTED");
		}
	}
	for (const template of [
		"GRANT USAGE ON SCHEMA %I TO %I",
		"GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO %I",
		"ALTER ROLE %I SET search_path TO %I",
	]) {
		const values = template.startsWith("ALTER ROLE")
			? [credentials.username, schema]
			: [schema, credentials.username];
		await database.query(await formattedStatement(database, template, values));
	}
}

export async function cleanupPerformanceDatabase(
	database: SqlQueryable,
	runId: string,
	username: string,
) {
	await database.query(
		await formattedStatement(database, "DROP SCHEMA IF EXISTS %I CASCADE", [
			performanceSchemaName(runId),
		]),
	);
	await database.query(
		await formattedStatement(database, "DROP ROLE IF EXISTS %I", [username]),
	);
}
