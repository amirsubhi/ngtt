CREATE TABLE announce_stats (
  id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id          INT          NOT NULL,
  torrent_id       INT          NOT NULL,
  uploaded_delta   BIGINT       DEFAULT 0,
  downloaded_delta BIGINT       DEFAULT 0,
  is_freeleech     BOOLEAN      DEFAULT FALSE,
  event            VARCHAR(20)  NULL,
  peer_id          VARCHAR(40)  NULL,
  ip_address       VARCHAR(45)  NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user    (user_id),
  INDEX idx_torrent (torrent_id),
  INDEX idx_created (created_at)
);

CREATE TABLE banned_clients (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  peer_id_prefix VARCHAR(8)   NOT NULL UNIQUE,
  client_name    VARCHAR(100) NOT NULL,
  reason         TEXT         NULL,
  added_by       INT          NULL,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE cheat_signals (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id      INT          NOT NULL,
  torrent_id   INT          NOT NULL,
  signal_type  ENUM('speed_spike','ratio_anomaly','ip_mismatch','missing_peers') NOT NULL,
  evidence     JSON         NOT NULL,
  peer_id      VARCHAR(40)  NULL,
  ip_address   VARCHAR(45)  NULL,
  reviewed     BOOLEAN      DEFAULT FALSE,
  reviewed_by  INT          NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id)  REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_user     (user_id),
  INDEX idx_reviewed (reviewed),
  INDEX idx_created  (created_at)
);
