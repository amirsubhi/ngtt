CREATE TABLE torrent_requests (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  user_id          INT           NOT NULL,
  title            VARCHAR(500)  NOT NULL,
  description      TEXT          NULL,
  category_id      INT           NULL,
  bounty_flux      DECIMAL(10,2) DEFAULT 0,
  is_filled        BOOLEAN       DEFAULT FALSE,
  filled_by        INT           NULL,
  filled_torrent_id INT          NULL,
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)           REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id)       REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (filled_by)         REFERENCES users(id)      ON DELETE SET NULL,
  FOREIGN KEY (filled_torrent_id) REFERENCES torrents(id)   ON DELETE SET NULL,
  INDEX idx_user   (user_id),
  INDEX idx_filled (is_filled)
);
