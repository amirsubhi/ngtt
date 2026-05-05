CREATE TABLE user_warnings (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT          NOT NULL,
  issued_by  INT          NOT NULL,
  reason     TEXT         NOT NULL,
  type       ENUM('warning','shoutbox_ban','download_ban','upload_ban','temp_suspension','permanent_ban') DEFAULT 'warning',
  expires_at TIMESTAMP    NULL,
  is_active  BOOLEAN      DEFAULT TRUE,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by) REFERENCES users(id),
  INDEX idx_user   (user_id),
  INDEX idx_active (is_active)
);

CREATE TABLE audit_logs (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT          NULL,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50)  NULL,
  target_id   INT          NULL,
  metadata    JSON         NULL,
  ip_address  VARCHAR(45)  NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user    (user_id),
  INDEX idx_created (created_at)
);

CREATE TABLE reports (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  reporter_id INT          NOT NULL,
  target_type ENUM('torrent','post','user') NOT NULL,
  target_id   INT          NOT NULL,
  reason      TEXT         NOT NULL,
  status      ENUM('pending','resolved','dismissed') DEFAULT 'pending',
  resolved_by INT          NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status  (status),
  INDEX idx_created (created_at)
);

CREATE TABLE dmca_notices (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id     INT          NULL,
  claimant_name  VARCHAR(255) NOT NULL,
  claimant_email VARCHAR(255) NOT NULL,
  description    TEXT         NOT NULL,
  status         ENUM('pending','actioned','dismissed') DEFAULT 'pending',
  actioned_by    INT          NULL,
  actioned_at    TIMESTAMP    NULL,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (torrent_id)  REFERENCES torrents(id) ON DELETE SET NULL,
  FOREIGN KEY (actioned_by) REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_status (status)
);

CREATE TABLE helpdesk_tickets (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT          NOT NULL,
  subject    VARCHAR(255) NOT NULL,
  category   ENUM('ratio','hnr','account','bug','other') DEFAULT 'other',
  status     ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
  priority   ENUM('low','medium','high') DEFAULT 'low',
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user   (user_id),
  INDEX idx_status (status)
);

CREATE TABLE helpdesk_replies (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id  INT          NOT NULL,
  user_id    INT          NOT NULL,
  body       TEXT         NOT NULL,
  is_staff   BOOLEAN      DEFAULT FALSE,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  INDEX idx_ticket (ticket_id)
);
