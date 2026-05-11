-- Add effective_uploaded_delta to announce_stats so audit queries can reconcile
-- against users.uploaded (which is incremented by the effective value, not the raw delta).
ALTER TABLE announce_stats
  ADD COLUMN effective_uploaded_delta BIGINT NOT NULL DEFAULT 0
  AFTER uploaded_delta;
