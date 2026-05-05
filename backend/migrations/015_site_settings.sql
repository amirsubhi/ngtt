CREATE TABLE site_settings (
  `key`       VARCHAR(100) PRIMARY KEY,
  value       TEXT         NOT NULL,
  type        ENUM('bool','int','string','json') DEFAULT 'string',
  `group`     VARCHAR(50)  DEFAULT 'general',
  label       VARCHAR(255) NOT NULL,
  description TEXT         NULL,
  updated_by  INT          NULL,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO site_settings (`key`,value,type,`group`,label) VALUES
-- SITE
('site_name',            'NGTT',                      'string','general',      'Site Name'),
('site_description',     'Next-Gen Torrent Tracker',  'string','general',      'Site Description'),
('maintenance_mode',     'false',                     'bool',  'general',      'Maintenance Mode'),
('default_theme',        'void',                      'string','general',      'Default Theme'),
('default_locale',       'en',                        'string','general',      'Default Language'),

-- REGISTRATION
('registration_open',    'true',  'bool','registration','Open Registration'),
('invite_system_enabled','true',  'bool','registration','Invite System'),
('email_domain_blacklist','["mailinator.com","10minutemail.com","tempmail.com","guerrillamail.com"]',
                                  'json','registration','Blocked Email Domains'),

-- CAPTCHA
('captcha_provider',              'turnstile','string','security','Captcha Provider'),
('captcha_on_register',           'true',     'bool',  'security','Captcha on Register'),
('captcha_on_login',              'false',    'bool',  'security','Captcha on Login'),
('captcha_on_login_after_fails',  'true',     'bool',  'security','Captcha After Failed Logins'),
('captcha_fail_threshold',        '3',        'int',   'security','Show Captcha After X Fails'),
('turnstile_site_key',            '',         'string','security','Turnstile Site Key'),
('turnstile_secret_key',          '',         'string','security','Turnstile Secret Key'),

-- SECURITY
('max_login_attempts',        '5',    'int', 'security','Max Login Attempts'),
('lockout_minutes',           '15',   'int', 'security','Lockout Duration (mins)'),
('client_whitelist_enabled',  'true', 'bool','security','Client Whitelist'),
('cheat_detection_enabled',   'true', 'bool','security','Cheat Detection'),
('two_factor_available',      'true', 'bool','security','2FA Available'),
('two_factor_required_staff', 'true', 'bool','security','2FA Required for Staff'),

-- TRACKER
('announce_interval',     '1800','int','tracker','Announce Interval (secs)'),
('min_announce_interval', '900', 'int','tracker','Min Announce Interval'),
('ratio_grace_days',      '30',  'int','tracker','Ratio Grace Period (days)'),
('hnr_enabled',           'true','bool','tracker','H&R System'),
('hnr_grace_hours',       '72',  'int','tracker','H&R Grace Period (hours)'),
('hnr_min_ratio',         '1.0', 'string','tracker','H&R Minimum Ratio'),
('hnr_warn_threshold',    '3',   'int','tracker','H&R Warn After X'),
('hnr_ban_threshold',     '5',   'int','tracker','H&R Ban After X'),
('magnet_links_enabled',  'true','bool','tracker','Magnet Links'),
('magnet_show_warning',   'true','bool','tracker','Magnet Passkey Warning'),

-- FEATURES
('forum_enabled',              'true', 'bool','features','Forum'),
('shoutbox_enabled',           'true', 'bool','features','Shoutbox'),
('shoutbox_announce_uploads',  'true', 'bool','features','Shoutbox Upload Announce'),
('requests_enabled',           'true', 'bool','features','Torrent Requests'),
('subtitles_enabled',          'true', 'bool','features','Subtitles'),
('subtitle_moderation',        'false','bool','features','Subtitle Moderation'),
('subtitle_max_size_mb',       '2',    'int', 'features','Max Subtitle Size (MB)'),
('pm_enabled',                 'true', 'bool','features','Private Messages'),
('api_enabled',                'true', 'bool','features','Public API / Torznab'),
('rss_enabled',                'true', 'bool','features','RSS Feeds'),
('helpdesk_enabled',           'true', 'bool','features','Helpdesk Tickets'),
('dmca_enabled',               'true', 'bool','features','DMCA Form'),
('reseed_enabled',             'true', 'bool','features','Reseed Requests'),
('nfo_enabled',                'true', 'bool','features','NFO Upload/Viewer'),

-- ECONOMY
('flux_enabled',         'true','bool',  'economy','Flux System'),
('flux_per_torrent_hour','1.0', 'string','economy','Flux per Seeded Torrent/Hour'),
('flux_per_upload',      '50',  'int',   'economy','Flux for Approved Upload'),
('flux_per_thank',       '5',   'int',   'economy','Flux per Thank Received'),
('flux_per_subtitle',    '20',  'int',   'economy','Flux for Approved Subtitle'),
('flux_birthday_reward', '100', 'int',   'economy','Birthday Flux Reward'),
('global_freeleech',     'false','bool', 'economy','Global Freeleech'),

-- COMMUNITY
('welcome_pm_enabled',   'true',              'bool',  'community','Welcome PM'),
('welcome_pm_subject',   'Welcome to NGTT!',  'string','community','Welcome PM Subject'),
('welcome_pm_body',      'Welcome! Please read the rules.',
                                              'string','community','Welcome PM Body'),
('birthdays_enabled',    'true',              'bool',  'community','Birthday Rewards'),
('shoutbox_max_messages','200',               'int',   'community','Shoutbox History'),

-- INACTIVITY
('inactivity_warn_days',  '150', 'int', 'pruning','Inactivity Warning Days'),
('inactivity_prune_days', '180', 'int', 'pruning','Inactivity Disable Days'),
('inactivity_delete_days','210', 'int', 'pruning','Inactivity Delete Days'),
('prune_exempt_classes',  '["vip","uploader","moderator","admin"]',
                                 'json','pruning','Prune Exempt Groups');
