CREATE TABLE performance_rate_limits (
	quota_key TEXT NOT NULL,
	minute_bucket INTEGER NOT NULL,
	units INTEGER NOT NULL,
	PRIMARY KEY (quota_key, minute_bucket)
);
