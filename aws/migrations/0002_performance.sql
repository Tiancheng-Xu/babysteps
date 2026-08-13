CREATE SCHEMA IF NOT EXISTS babysteps_performance;

CREATE TABLE IF NOT EXISTS babysteps_performance.events (
  event_id UUID PRIMARY KEY,
  timestamp_ms BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('metric', 'resource', 'error', 'custom', 'web3')),
  name VARCHAR(64) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('ms', 'score', 'count')),
  route VARCHAR(160) NOT NULL,
  environment VARCHAR(32) NOT NULL,
  version VARCHAR(64) NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS performance_events_window_metric
  ON babysteps_performance.events (timestamp_ms DESC, name);
CREATE INDEX IF NOT EXISTS performance_events_route_window
  ON babysteps_performance.events (route, timestamp_ms DESC);

CREATE TABLE IF NOT EXISTS babysteps_performance.hourly_aggregates (
  bucket_start_ms BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('metric', 'resource', 'error', 'custom', 'web3')),
  name VARCHAR(64) NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('ms', 'score', 'count')),
  route VARCHAR(160) NOT NULL,
  environment VARCHAR(32) NOT NULL,
  version VARCHAR(64) NOT NULL,
  timestamps_ms BIGINT[] NOT NULL,
  values DOUBLE PRECISION[] NOT NULL,
  sample_count INTEGER NOT NULL CHECK (sample_count > 0),
  error_count INTEGER NOT NULL CHECK (error_count >= 0),
  PRIMARY KEY (bucket_start_ms, type, name, unit, route, environment, version)
);

CREATE INDEX IF NOT EXISTS performance_aggregates_window_metric
  ON babysteps_performance.hourly_aggregates (bucket_start_ms DESC, name);
