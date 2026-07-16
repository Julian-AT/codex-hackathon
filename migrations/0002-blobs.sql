CREATE TABLE blobs (
  digest TEXT PRIMARY KEY CHECK (
    length(digest) = 64
    AND digest = lower(digest)
    AND digest NOT GLOB '*[^0-9a-f]*'
  ),
  size INTEGER NOT NULL CHECK (size >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (digest, size)
) STRICT, WITHOUT ROWID;

CREATE TABLE blob_references (
  reference_id TEXT PRIMARY KEY CHECK (length(reference_id) BETWEEN 1 AND 256),
  kind TEXT NOT NULL CHECK (kind IN ('source', 'patch', 'trace', 'report', 'generated')),
  digest TEXT NOT NULL CHECK (
    length(digest) = 64
    AND digest = lower(digest)
    AND digest NOT GLOB '*[^0-9a-f]*'
  ),
  size INTEGER NOT NULL CHECK (size >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (digest, size) REFERENCES blobs (digest, size) ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE INDEX blob_references_digest_idx ON blob_references (digest);
