INSERT INTO site_settings (`key`, value, type, `group`, label, description) VALUES
('site_logo_url',        '', 'string', 'branding', 'Site Logo URL',      'Uploaded PNG/JPG/WebP, max 200 KB — set via admin upload'),
('site_favicon_url',     '', 'string', 'branding', 'Favicon URL',        'Uploaded PNG/JPG/WebP, max 50 KB — set via admin upload'),
('login_message',        '', 'string', 'branding', 'Login Page Message', 'Short message shown below the login form'),
('announcement_enabled', 'false', 'bool',   'branding', 'Announcement Bar',  'Show announcement bar on every page including login'),
('announcement_text',    '', 'string', 'branding', 'Announcement Text',  'Plain text displayed in the bar'),
('announcement_level',   'info', 'string', 'branding', 'Announcement Style', 'One of: info, warning, danger'),
('footer_text',          '', 'string', 'branding', 'Footer Text',        'Custom text in the site footer');
