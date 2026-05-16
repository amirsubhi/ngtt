-- Expand two_factor_secret from VARCHAR(32) to VARCHAR(512).
-- AES-256-GCM encrypted TOTP secrets are 80 base64 chars (the old
-- column silently truncated them so every decrypt call failed).
-- Accounts that had 2FA enabled under the old schema have an
-- unrecoverable secret and are reset to unenrolled so they can re-enroll.

ALTER TABLE users MODIFY COLUMN two_factor_secret VARCHAR(512) NULL;

UPDATE users
  SET  two_factor_enabled = FALSE, two_factor_secret = NULL
WHERE  two_factor_enabled = TRUE
  AND  two_factor_secret  IS NOT NULL
  AND  CHAR_LENGTH(two_factor_secret) <= 32
