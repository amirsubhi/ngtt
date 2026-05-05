CREATE TABLE messages (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  sender_id           INT          NOT NULL,
  receiver_id         INT          NOT NULL,
  subject             VARCHAR(255) NOT NULL,
  body                TEXT         NOT NULL,
  is_read             BOOLEAN      DEFAULT FALSE,
  deleted_by_sender   BOOLEAN      DEFAULT FALSE,
  deleted_by_receiver BOOLEAN      DEFAULT FALSE,
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_receiver (receiver_id),
  INDEX idx_sender   (sender_id)
);
