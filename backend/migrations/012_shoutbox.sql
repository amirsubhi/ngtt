CREATE TABLE shoutbox_archive (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT          NOT NULL,
  username    VARCHAR(50)  NOT NULL,
  group_color VARCHAR(7)   DEFAULT '#6366f1',
  content     TEXT         NOT NULL,
  is_system   BOOLEAN      DEFAULT FALSE,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_created (created_at)
);
