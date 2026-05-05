CREATE TABLE invites (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  sender_id     INT          NOT NULL,
  receiver_email VARCHAR(255) NOT NULL,
  token         VARCHAR(32)  NOT NULL UNIQUE,
  used          BOOLEAN      DEFAULT FALSE,
  used_by       INT          NULL,
  expires_at    TIMESTAMP    NOT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by)   REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_token    (token),
  INDEX idx_sender   (sender_id)
);
