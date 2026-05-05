CREATE TABLE subtitles (
  id                   INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id           INT          NOT NULL,
  uploaded_by          INT          NULL,
  language             VARCHAR(10)  NOT NULL,
  language_label       VARCHAR(50)  NOT NULL,
  format               ENUM('srt','ass','ssa','vtt','sub','idx','sup') NOT NULL,
  filename             VARCHAR(255) NOT NULL,
  file_path            VARCHAR(500) NOT NULL,
  file_size            INT          NOT NULL,
  is_approved          BOOLEAN      DEFAULT TRUE,
  approved_by          INT          NULL,
  download_count       INT          DEFAULT 0,
  is_machine_translated BOOLEAN     DEFAULT FALSE,
  source               ENUM('manual','opensubtitles_sync') DEFAULT 'manual',
  synced_by            INT          NULL,
  os_subtitle_id       VARCHAR(50)  NULL,
  notes                TEXT         NULL,
  created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (torrent_id)  REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (synced_by)   REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_torrent  (torrent_id),
  INDEX idx_language (language)
);

CREATE TABLE subtitle_votes (
  subtitle_id INT NOT NULL,
  user_id     INT NOT NULL,
  vote        ENUM('up','down') NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (subtitle_id, user_id),
  FOREIGN KEY (subtitle_id) REFERENCES subtitles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE
);
