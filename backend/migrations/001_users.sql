CREATE TABLE user_groups (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(50) NOT NULL,
  slug          VARCHAR(50) NOT NULL UNIQUE,
  color         VARCHAR(7)  DEFAULT '#6366f1',
  min_ratio     DECIMAL(5,2) DEFAULT 0,
  min_upload    BIGINT      DEFAULT 0,
  min_age_days  INT         DEFAULT 0,
  max_invites   INT         DEFAULT 0,
  can_upload    BOOLEAN     DEFAULT TRUE,
  can_download  BOOLEAN     DEFAULT TRUE,
  download_slots INT        DEFAULT -1,
  is_staff      BOOLEAN     DEFAULT FALSE,
  display_order INT         DEFAULT 0,
  created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO user_groups (name,slug,color,max_invites,is_staff)
VALUES
  ('Newbie',        'newbie',     '#94a3b8', 0,  FALSE),
  ('Member',        'member',     '#6366f1', 3,  FALSE),
  ('Power User',    'power-user', '#8b5cf6', 5,  FALSE),
  ('VIP',           'vip',        '#f59e0b', 10, FALSE),
  ('Uploader',      'uploader',   '#10b981', 5,  FALSE),
  ('Moderator',     'moderator',  '#f97316', 10, TRUE),
  ('Administrator', 'admin',      '#ef4444', -1, TRUE),
  ('Banned',        'banned',     '#374151', 0,  FALSE);

CREATE TABLE users (
  id                    INT PRIMARY KEY AUTO_INCREMENT,
  username              VARCHAR(50)  NOT NULL UNIQUE,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  password_hash         VARCHAR(255) NOT NULL,
  passkey               VARCHAR(32)  NOT NULL UNIQUE,
  rss_key               VARCHAR(32)  NOT NULL UNIQUE,
  api_key               VARCHAR(64)  UNIQUE,
  api_enabled           BOOLEAN      DEFAULT FALSE,
  group_id              INT          NOT NULL DEFAULT 1,
  invited_by            INT          NULL,
  invite_tokens         INT          DEFAULT 0,
  uploaded              BIGINT       DEFAULT 0,
  downloaded            BIGINT       DEFAULT 0,
  flux                  DECIMAL(10,2) DEFAULT 0,
  is_banned             BOOLEAN      DEFAULT FALSE,
  ban_reason            TEXT         NULL,
  is_deleted            BOOLEAN      DEFAULT FALSE,
  deleted_at            TIMESTAMP    NULL,
  warned                BOOLEAN      DEFAULT FALSE,
  warning_expires_at    TIMESTAMP    NULL,
  failed_login_count    INT          DEFAULT 0,
  locked_until          TIMESTAMP    NULL,
  email_verified        BOOLEAN      DEFAULT FALSE,
  email_verify_token    VARCHAR(64)  NULL,
  email_verify_expires  TIMESTAMP    NULL,
  password_reset_token  VARCHAR(64)  NULL,
  password_reset_expires TIMESTAMP  NULL,
  two_factor_enabled    BOOLEAN      DEFAULT FALSE,
  two_factor_secret     VARCHAR(32)  NULL,
  birth_date            DATE         NULL,
  show_birthday         BOOLEAN      DEFAULT TRUE,
  locale                VARCHAR(10)  DEFAULT 'en',
  theme                 ENUM('void','pulse','cipher','nebula','ember','lumen','sand') DEFAULT 'void',
  avatar_url            VARCHAR(500) NULL,
  about_me              TEXT         NULL,
  last_seen_at          TIMESTAMP    NULL,
  created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id)   REFERENCES user_groups(id),
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_passkey    (passkey),
  INDEX idx_email      (email),
  INDEX idx_group      (group_id),
  INDEX idx_last_seen  (last_seen_at)
);

CREATE TABLE user_preferences (
  user_id               INT PRIMARY KEY,
  browse_view           ENUM('table','card') DEFAULT 'table',
  torrents_per_page     INT          DEFAULT 50,
  profile_private       BOOLEAN      DEFAULT FALSE,
  show_online_status    BOOLEAN      DEFAULT TRUE,
  hide_download_history BOOLEAN      DEFAULT FALSE,
  notify_hnr_warning    BOOLEAN      DEFAULT TRUE,
  notify_ratio_low      BOOLEAN      DEFAULT TRUE,
  notify_request_filled BOOLEAN      DEFAULT TRUE,
  notify_forum_reply    BOOLEAN      DEFAULT TRUE,
  notify_pm_received    BOOLEAN      DEFAULT TRUE,
  notify_promotion      BOOLEAN      DEFAULT TRUE,
  notify_new_torrent    BOOLEAN      DEFAULT FALSE,
  email_hnr_warning     BOOLEAN      DEFAULT TRUE,
  email_pm_received     BOOLEAN      DEFAULT TRUE,
  email_staff_message   BOOLEAN      DEFAULT TRUE,
  forum_signature       TEXT         NULL,
  watched_categories    JSON         DEFAULT ('[]'),
  os_api_key_enc        TEXT         NULL,
  os_username           VARCHAR(100) NULL,
  os_enabled            BOOLEAN      DEFAULT FALSE,
  os_auto_sync          BOOLEAN      DEFAULT FALSE,
  os_preferred_langs    JSON         DEFAULT ('[]'),
  os_verified           BOOLEAN      DEFAULT FALSE,
  updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE username_history (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  old_username  VARCHAR(50)  NOT NULL,
  changed_by    INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id)
);

CREATE TABLE refresh_tokens (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  token_hash    VARCHAR(255) NOT NULL UNIQUE,
  expires_at    TIMESTAMP    NOT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token  (token_hash),
  INDEX idx_user   (user_id)
);

CREATE TABLE login_attempts (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  ip_address    VARCHAR(45)  NOT NULL,
  username_tried VARCHAR(50) NULL,
  attempted_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip  (ip_address),
  INDEX idx_at  (attempted_at)
);

CREATE TABLE ip_bans (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  ip_address    VARCHAR(50)  NOT NULL,
  reason        TEXT         NULL,
  banned_by     INT          NULL,
  expires_at    TIMESTAMP    NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_ip  (ip_address)
);
