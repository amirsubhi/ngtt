CREATE TABLE hit_and_runs (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  user_id          INT          NOT NULL,
  torrent_id       INT          NOT NULL,
  downloaded_at    TIMESTAMP    NOT NULL,
  seed_deadline_at TIMESTAMP    NOT NULL,
  seeded_time_mins INT          DEFAULT 0,
  status           ENUM('active','resolved','pardoned','expired') DEFAULT 'active',
  pardoned_by      INT          NULL,
  pardon_reason    TEXT         NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (pardoned_by)REFERENCES users(id)    ON DELETE SET NULL,
  UNIQUE KEY uq_hnr (user_id, torrent_id),
  INDEX idx_user     (user_id),
  INDEX idx_status   (status),
  INDEX idx_deadline (seed_deadline_at)
);
