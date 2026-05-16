-- Composite indexes for browse sort without filesort.
-- Without these, ORDER BY created_at/download_count/size after WHERE status='approved'
-- causes a filesort of all approved rows on every browse request.
ALTER TABLE torrents
  ADD INDEX idx_browse_newest  (status, created_at DESC),
  ADD INDEX idx_browse_snatched (status, download_count DESC),
  ADD INDEX idx_browse_size     (status, size DESC);
