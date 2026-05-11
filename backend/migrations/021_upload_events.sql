CREATE TABLE IF NOT EXISTS upload_events (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  type       ENUM('double_upload', 'freeleech_global') NOT NULL DEFAULT 'double_upload',
  starts_at  DATETIME NOT NULL,
  ends_at    DATETIME NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_active (type, starts_at, ends_at)
) ENGINE=InnoDB;
