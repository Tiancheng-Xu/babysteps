import type { SqlQueryable } from "../repositories/postgresCompletionJobs";
import { quotePerformanceSchema } from "./databaseAccess";
import type { StoredPerformanceEvent } from "./pipeline";

export type PerformanceFilters = {
	window: "1h" | "24h" | "7d";
	route?: string;
	metric?: string;
	environment?: string;
	version?: string;
};

const windowMilliseconds = {
	"1h": 3_600_000,
	"24h": 86_400_000,
	"7d": 604_800_000,
} as const;

export class PostgresPerformanceStore {
	constructor(
		private readonly database: SqlQueryable,
		private readonly now: () => number = Date.now,
		runId: string,
	) {
		this.schema = quotePerformanceSchema(runId);
	}

	private readonly schema: string;

	async insert(event: StoredPerformanceEvent) {
		const events = `${this.schema}."events"`;
		const aggregates = `${this.schema}."hourly_aggregates"`;
		const result = await this.database.query(
			`WITH inserted AS (
			 INSERT INTO ${events}
			(event_id, timestamp_ms, type, name, value, unit, category, outcome,
			 route, environment, version)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (event_id) DO NOTHING
			RETURNING timestamp_ms, type, name, value, unit, category, outcome,
			 route, environment, version
			)
			INSERT INTO ${aggregates}
			(bucket_start_ms, type, name, unit, category, outcome, route, environment, version,
			 timestamps_ms, values, sample_count, error_count)
			SELECT (timestamp_ms / 3600000) * 3600000, type, name, unit,
			 COALESCE(category, ''), COALESCE(outcome, ''), route, environment, version,
			 ARRAY[timestamp_ms]::BIGINT[],
			 ARRAY[value]::DOUBLE PRECISION[], 1,
			 CASE WHEN type = 'error' THEN 1 ELSE 0 END
			FROM inserted
			ON CONFLICT (bucket_start_ms, type, name, unit, category, outcome, route, environment, version)
			DO UPDATE SET
				 timestamps_ms = ${aggregates}.timestamps_ms || EXCLUDED.timestamps_ms,
				 values = ${aggregates}.values || EXCLUDED.values,
				 sample_count = ${aggregates}.sample_count + 1,
				 error_count = ${aggregates}.error_count + EXCLUDED.error_count
			RETURNING 1`,
			[
				event.eventId,
				event.timestamp,
				event.type,
				event.name,
				event.value,
				event.unit,
				event.category ?? null,
				event.outcome ?? null,
				event.route,
				event.environment,
				event.version,
			],
		);
		return result.rowCount === 0 ? "deduplicated" : "inserted";
	}

	async query(filters: PerformanceFilters): Promise<StoredPerformanceEvent[]> {
		const windowStart = this.now() - windowMilliseconds[filters.window];
		const values: unknown[] = [
			Math.floor(windowStart / 3_600_000) * 3_600_000,
			windowStart,
		];
		const clauses = ["bucket_start_ms >= $1"];
		for (const [column, value] of [
			["route", filters.route],
			["environment", filters.environment],
			["version", filters.version],
		] as const) {
			if (!value) continue;
			values.push(value);
			clauses.push(`${column} = $${values.length}`);
		}

		const result = await this.database.query(
			`WITH bounded_samples AS (
			 SELECT bucket_start_ms AS "bucketStart", type, name, unit,
			  NULLIF(category, '') AS category, NULLIF(outcome, '') AS outcome,
			  route, environment, version, sample.timestamp_ms AS timestamp,
			  sample.value
			 FROM ${this.schema}."hourly_aggregates"
			 CROSS JOIN LATERAL unnest(timestamps_ms, values)
			 AS sample(timestamp_ms, value)
			 WHERE ${clauses.join(" AND ")}
			 AND sample.timestamp_ms >= $2
			 LIMIT 10001
			), counted_samples AS (
			 SELECT *, COUNT(*) OVER () AS "totalCount"
			 FROM bounded_samples
			)
			SELECT * FROM counted_samples
			ORDER BY timestamp ASC
			LIMIT 10000`,
			values,
		);
		const rows = result.rows as Array<{
			bucketStart: number | string;
			type: StoredPerformanceEvent["type"];
			name: string;
			unit: StoredPerformanceEvent["unit"];
			category: StoredPerformanceEvent["category"] | null;
			outcome: StoredPerformanceEvent["outcome"] | null;
			route: string;
			environment: string;
			version: string;
			timestamp: number | string;
			value: number | string;
			totalCount: number | string;
		}>;
		if (Number(rows[0]?.totalCount ?? 0) > 10_000) {
			throw new Error("STATISTICS_WINDOW_TOO_LARGE");
		}
		return rows.map((row, rowIndex) => ({
			eventId: `${row.bucketStart}-${rowIndex}-${row.timestamp}`,
			timestamp: Number(row.timestamp),
			type: row.type,
			name: row.name,
			value: Number(row.value),
			unit: row.unit,
			...(row.category ? { category: row.category } : {}),
			...(row.outcome ? { outcome: row.outcome } : {}),
			route: row.route,
			environment: row.environment,
			version: row.version,
		}));
	}
}
