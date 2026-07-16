CREATE TABLE runs (
  run_id TEXT PRIMARY KEY CHECK (length(run_id) BETWEEN 1 AND 256),
  stage_key TEXT NOT NULL CHECK (
    length(stage_key) = 64
    AND stage_key = lower(stage_key)
    AND stage_key NOT GLOB '*[^0-9a-f]*'
  ),
  stage_type TEXT NOT NULL CHECK (length(stage_type) BETWEEN 1 AND 128),
  status TEXT NOT NULL CHECK (status IN ('running', 'committed', 'failed', 'cancelled')),
  manifest_digest TEXT CHECK (
    manifest_digest IS NULL OR (
      length(manifest_digest) = 64
      AND manifest_digest = lower(manifest_digest)
      AND manifest_digest NOT GLOB '*[^0-9a-f]*'
    )
  ),
  manifest_size INTEGER CHECK (manifest_size IS NULL OR manifest_size >= 0),
  parent_run_id TEXT,
  created_at TEXT NOT NULL,
  terminal_at TEXT,
  CHECK (
    (status = 'running' AND manifest_digest IS NULL AND manifest_size IS NULL AND terminal_at IS NULL)
    OR (status = 'committed' AND manifest_digest IS NOT NULL AND manifest_size IS NOT NULL AND terminal_at IS NOT NULL)
    OR (status IN ('failed', 'cancelled') AND manifest_digest IS NULL AND manifest_size IS NULL AND terminal_at IS NOT NULL)
  ),
  FOREIGN KEY (manifest_digest, manifest_size) REFERENCES blobs (digest, size) ON DELETE RESTRICT,
  FOREIGN KEY (parent_run_id) REFERENCES runs (run_id) ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE run_events (
  run_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 1 AND 128),
  event_json TEXT NOT NULL CHECK (json_valid(event_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, sequence),
  FOREIGN KEY (run_id) REFERENCES runs (run_id) ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE stage_claims (
  stage_key TEXT PRIMARY KEY CHECK (
    length(stage_key) = 64
    AND stage_key = lower(stage_key)
    AND stage_key NOT GLOB '*[^0-9a-f]*'
  ),
  producer_run_id TEXT NOT NULL UNIQUE,
  claimed_at TEXT NOT NULL,
  FOREIGN KEY (producer_run_id) REFERENCES runs (run_id) ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE INDEX runs_stage_key_idx ON runs (stage_key, status);
CREATE INDEX runs_parent_idx ON runs (parent_run_id);

CREATE TRIGGER runs_terminal_immutable
BEFORE UPDATE ON runs
WHEN OLD.status <> 'running'
BEGIN
  SELECT RAISE(ABORT, 'terminal run records are immutable');
END;

CREATE TRIGGER runs_no_delete
BEFORE DELETE ON runs
BEGIN
  SELECT RAISE(ABORT, 'run records are immutable');
END;

CREATE TRIGGER run_events_no_update
BEFORE UPDATE ON run_events
BEGIN
  SELECT RAISE(ABORT, 'run events are append-only');
END;

CREATE TRIGGER run_events_no_delete
BEFORE DELETE ON run_events
BEGIN
  SELECT RAISE(ABORT, 'run events are append-only');
END;
