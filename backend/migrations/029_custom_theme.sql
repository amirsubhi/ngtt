INSERT IGNORE INTO site_settings (`key`, value, type, `group`, label, description)
VALUES (
  'custom_theme',
  'null',
  'json',
  'branding',
  'Custom Theme',
  'JSON color configuration for the custom theme slot. Managed via the Theme editor in admin.'
);
