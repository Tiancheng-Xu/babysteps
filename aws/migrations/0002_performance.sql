CREATE SCHEMA IF NOT EXISTS babysteps_performance;

CREATE TABLE IF NOT EXISTS babysteps_performance.events (
  event_id UUID PRIMARY KEY,
  timestamp_ms BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('metric', 'resource', 'error', 'custom', 'web3')),
  name VARCHAR(64) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('ms', 'score', 'count')),
  category VARCHAR(32),
  outcome VARCHAR(16),
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
  category VARCHAR(32) NOT NULL DEFAULT '',
  outcome VARCHAR(16) NOT NULL DEFAULT '',
  route VARCHAR(160) NOT NULL,
  environment VARCHAR(32) NOT NULL,
  version VARCHAR(64) NOT NULL,
  timestamps_ms BIGINT[] NOT NULL,
  values DOUBLE PRECISION[] NOT NULL,
  sample_count INTEGER NOT NULL CHECK (sample_count > 0),
  error_count INTEGER NOT NULL CHECK (error_count >= 0),
  PRIMARY KEY (
    bucket_start_ms, type, name, unit, category, outcome, route, environment, version
  )
);

ALTER TABLE babysteps_performance.events
  ADD COLUMN IF NOT EXISTS category VARCHAR(32),
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(16);

ALTER TABLE babysteps_performance.events
  DROP CONSTRAINT IF EXISTS performance_events_category_allowed,
  DROP CONSTRAINT IF EXISTS performance_events_outcome_allowed,
  ADD CONSTRAINT performance_events_category_allowed CHECK (
    category IS NULL OR category IN (
      'fetch', 'xhr', 'script', 'stylesheet', 'image', 'font', 'type_error',
      'network', 'timeout', 'user_rejected', 'unknown'
    )
  ),
  ADD CONSTRAINT performance_events_outcome_allowed CHECK (
    outcome IS NULL OR outcome IN ('success', 'failure', 'unavailable')
  );

ALTER TABLE babysteps_performance.hourly_aggregates
  ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(16) NOT NULL DEFAULT '';

ALTER TABLE babysteps_performance.hourly_aggregates
  DROP CONSTRAINT IF EXISTS performance_aggregates_category_allowed,
  DROP CONSTRAINT IF EXISTS performance_aggregates_outcome_allowed,
  ADD CONSTRAINT performance_aggregates_category_allowed CHECK (
    category IN (
      '', 'fetch', 'xhr', 'script', 'stylesheet', 'image', 'font', 'type_error',
      'network', 'timeout', 'user_rejected', 'unknown'
    )
  ),
  ADD CONSTRAINT performance_aggregates_outcome_allowed CHECK (
    outcome IN ('', 'success', 'failure', 'unavailable')
  ),
  DROP CONSTRAINT IF EXISTS hourly_aggregates_pkey,
  ADD CONSTRAINT hourly_aggregates_pkey PRIMARY KEY (
    bucket_start_ms, type, name, unit, category, outcome, route, environment, version
  );

CREATE INDEX IF NOT EXISTS performance_aggregates_window_metric
  ON babysteps_performance.hourly_aggregates (bucket_start_ms DESC, name);
