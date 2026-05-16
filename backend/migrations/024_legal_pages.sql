-- Seed the legal/support pages that the footer links to.
-- INSERT IGNORE is idempotent — safe to re-run if rows already exist.
INSERT IGNORE INTO custom_pages (title, slug, body, show_in_nav, display_order, is_published) VALUES
  ('Terms of Service', 'terms',   'Terms of service content goes here.', FALSE, 10, TRUE),
  ('DMCA Policy',      'dmca',    'DMCA policy content goes here.',      FALSE, 11, TRUE),
  ('Support',          'support', 'Support content goes here.',          FALSE, 12, TRUE);
