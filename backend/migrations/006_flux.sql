CREATE TABLE flux_transactions (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT           NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  type        ENUM('earn','spend') NOT NULL,
  source      VARCHAR(100)  NOT NULL,
  description VARCHAR(255)  NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user    (user_id),
  INDEX idx_created (created_at)
);

CREATE TABLE flux_store_items (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  description   TEXT         NULL,
  cost          DECIMAL(10,2) NOT NULL,
  type          ENUM('invite_token','freeleech_token','upload_credit','username_change') NOT NULL,
  value         INT          DEFAULT 1,
  is_active     BOOLEAN      DEFAULT TRUE,
  display_order INT          DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO flux_store_items (name, description, cost, type, value, display_order) VALUES
  ('Invite Token',    '1 invite to send to a friend',        500,  'invite_token',    1,          1),
  ('Freeleech Token', 'Personal 24h freeleech on 1 torrent', 200,  'freeleech_token', 1,          2),
  ('Upload Credit',   'Add 5GB to your upload stats',        300,  'upload_credit',   5368709120, 3),
  ('Username Change', 'Change your username once',           500,  'username_change', 1,          4);

CREATE TABLE personal_freeleech (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT       NOT NULL,
  torrent_id INT       NULL,
  expires_at TIMESTAMP NOT NULL,
  used       BOOLEAN   DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE SET NULL,
  INDEX idx_user    (user_id),
  INDEX idx_expires (expires_at)
);
