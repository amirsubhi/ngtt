-- 020_categories_v2.sql
-- Expand the existing categories table and add subcat to torrents.
-- RENAME COLUMN requires MySQL 8.0+ (confirmed for this project).

ALTER TABLE categories
  RENAME COLUMN name         TO label,
  RENAME COLUMN display_order TO sort_order,
  RENAME COLUMN is_active    TO enabled;

ALTER TABLE categories
  ADD COLUMN color            VARCHAR(16)  NOT NULL DEFAULT '#6c63ff'     AFTER icon,
  ADD COLUMN upload_min_group ENUM('user','power','staff')                 NOT NULL DEFAULT 'power' AFTER enabled,
  ADD COLUMN browse_min_group ENUM('all','user','power','staff')           NOT NULL DEFAULT 'all'   AFTER upload_min_group,
  ADD COLUMN subcats          JSON         NOT NULL DEFAULT (JSON_ARRAY()) AFTER browse_min_group,
  ADD COLUMN created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER subcats;

-- Backfill colors and permissions for the seeded rows
UPDATE categories SET color = '#ef4444', upload_min_group = 'user',  subcats = JSON_ARRAY('Action','Drama','Sci-Fi','Horror','Comedy','Documentary','Animation') WHERE slug = 'movies';
UPDATE categories SET color = '#3b82f6', upload_min_group = 'user',  subcats = JSON_ARRAY('Drama','Comedy','Reality','Anime','Mini-Series','Documentary')       WHERE slug = 'tv';
UPDATE categories SET color = '#a855f7', upload_min_group = 'power', subcats = JSON_ARRAY('FLAC','MP3','Classical','Jazz','Electronic','Hip-Hop','Rock')         WHERE slug = 'music';
UPDATE categories SET color = '#22c55e', upload_min_group = 'power', subcats = JSON_ARRAY('PC','PS5','Xbox','Switch','Retro')                                    WHERE slug = 'games';
UPDATE categories SET color = '#f59e0b', upload_min_group = 'staff', subcats = JSON_ARRAY('Windows','macOS','Linux','Mobile','Portable')                         WHERE slug = 'software';
UPDATE categories SET color = '#64748b', upload_min_group = 'power', subcats = JSON_ARRAY('eBooks','Audiobooks','Magazines','Comics')                            WHERE slug = 'books';
UPDATE categories SET color = '#ec4899', upload_min_group = 'user',  subcats = JSON_ARRAY('Subbed','Dubbed','Movie','OVA','Series')                              WHERE slug = 'anime';
UPDATE categories SET color = '#64748b', upload_min_group = 'power', subcats = JSON_ARRAY('Misc')                                                                WHERE slug = 'other';

-- Add subcat column to torrents
ALTER TABLE torrents
  ADD COLUMN subcat VARCHAR(64) NULL AFTER category_id;
