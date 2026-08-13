import type { SqlQueryable } from "../repositories/postgresCompletionJobs";
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
	) {}

	async insert(event: StoredPerformanceEvent): Promise<void> {
		await this.database.query(
			`WITH inserted AS (
			 INSERT INTO babysteps_performance.events
			(event_id, timestamp_ms, type, name, value, unit, route, environment, version)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (event_id) DO NOTHING
			RETURNING timestamp_ms, type, name, value, unit, route, environment, version
			)
			INSERT INTO babysteps_performance.hourly_aggregates
			(bucket_start_ms, type, name, unit, route, environment, version,
			 timestamps_ms, values, sample_count, error_count)
			SELECT (timestamp_ms / 3600000) * 3600000, type, name, unit, route,
			 environment, version, ARRAY[timestamp_ms]::BIGINT[],
			 ARRAY[value]::DOUBLE PRECISION[], 1,
			 CASE WHEN type = 'error' THEN 1 ELSE 0 END
			FROM inserted
			ON CONFLICT (bucket_start_ms, type, name, unit, route, environment, version)
			DO UPDATE SET
			 timestamps_ms = babysteps_performance.hourly_aggregates.timestamps_ms || EXCLUDED.timestamps_ms,
			 values = babysteps_performance.hourly_aggregates.values || EXCLUDED.values,
			 sample_count = babysteps_performance.hourly_aggregates.sample_count + 1,
			 error_count = babysteps_performance.hourly_aggregates.error_count + EXCLUDED.error_count`,
			[
				event.eventId,
				event.timestamp,
				event.type,
				event.name,
				event.value,
				event.unit,
				event.route,
				event.environment,
				event.version,
			],
		);
	}

	async query(filters: PerformanceFilters): Promise<StoredPerformanceEvent[]> {
		const windowStart = this.now() - windowMilliseconds[filters.window];
		const values: unknown[] = [Math.floor(windowStart / 3_600_000) * 3_600_000];
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
			`SELECT bucket_start_ms AS "bucketStart", type, name, unit, route,
			 environment, version, timestamps_ms AS timestamps, values
			 FROM babysteps_performance.hourly_aggregates
			 WHERE ${clauses.join(" AND ")}
			 ORDER BY bucket_start_ms ASC`,
			values,
		);
		const rows = result.rows as Array<{
			bucketStart: number | string;
			type: StoredPerformanceEvent["type"];
			name: string;
			unit: StoredPerformanceEvent["unit"];
			route: string;
			environment: string;
			version: string;
			timestamps: Array<number | string>;
			values: number[];
		}>;
		const events = rows.flatMap((row, rowIndex) =>
			row.values.flatMap((value, valueIndex) => {
				const timestamp = Number(row.timestamps[valueIndex]);
				if (timestamp < windowStart) return [];
				return [
					{
						eventId: `${row.bucketStart}-${rowIndex}-${valueIndex}`,
						timestamp,
						type: row.type,
						name: row.name,
						value: Number(value),
						unit: row.unit,
						route: row.route,
						environment: row.environment,
						version: row.version,
					},
				];
			}),
		);
		if (events.length > 10_000) {
			throw new Error("STATISTICS_WINDOW_TOO_LARGE");
		}
		return events;
	}
}
