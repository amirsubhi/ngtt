CREATE TABLE categories (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  icon          VARCHAR(50)  NULL,
  display_order INT          DEFAULT 0,
  is_active     BOOLEAN      DEFAULT TRUE
);

INSERT INTO categories (name, slug, icon, display_order) VALUES
  ('Movies',       'movies',       '🎬', 1),
  ('TV Shows',     'tv',           '📺', 2),
  ('Music',        'music',        '🎵', 3),
  ('Games',        'games',        '🎮', 4),
  ('Software',     'software',     '💿', 5),
  ('Books',        'books',        '📚', 6),
  ('Anime',        'anime',        '⛩️', 7),
  ('Other',        'other',        '📦', 8);

CREATE TABLE tags (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(50)  NOT NULL UNIQUE,
  slug          VARCHAR(50)  NOT NULL UNIQUE,
  color         VARCHAR(7)   DEFAULT '#6366f1',
  usage_count   INT          DEFAULT 0,
  created_by    INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE torrents (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  info_hash     VARCHAR(40)  NOT NULL UNIQUE,
  name          VARCHAR(500) NOT NULL,
  slug          VARCHAR(600) NOT NULL UNIQUE,
  description   TEXT         NULL,
  category_id   INT          NOT NULL,
  uploader_id   INT          NOT NULL,
  size          BIGINT       NOT NULL DEFAULT 0,
  num_files     INT          DEFAULT 1,
  is_freeleech  BOOLEAN      DEFAULT FALSE,
  is_featured   BOOLEAN      DEFAULT FALSE,
  featured_by   INT          NULL,
  status        ENUM('pending','approved','rejected','takedown','dmca_pending') DEFAULT 'pending',
  approved_by   INT          NULL,
  approved_at   TIMESTAMP    NULL,
  is_internal   BOOLEAN      DEFAULT FALSE,
  tmdb_id       INT          NULL,
  imdb_id       VARCHAR(12)  NULL,
  musicbrainz_id VARCHAR(36) NULL,
  poster_url    VARCHAR(500) NULL,
  release_year  INT          NULL,
  download_count INT         DEFAULT 0,
  thank_count   INT          DEFAULT 0,
  view_count    INT          DEFAULT 0,
  nfo_content   TEXT         NULL,
  magnet_enabled BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (featured_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_info_hash   (info_hash),
  INDEX idx_category    (category_id),
  INDEX idx_uploader    (uploader_id),
  INDEX idx_status      (status),
  INDEX idx_created     (created_at),
  INDEX idx_freeleech   (is_freeleech),
  FULLTEXT INDEX ft_name (name)
);

CREATE TABLE torrent_files (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id    INT          NOT NULL,
  path          VARCHAR(1000) NOT NULL,
  size          BIGINT       NOT NULL,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  INDEX idx_torrent (torrent_id)
);

CREATE TABLE torrent_mediainfo (
  torrent_id    INT PRIMARY KEY,
  video_codec   VARCHAR(50)  NULL,
  resolution    VARCHAR(20)  NULL,
  video_bitrate INT          NULL,
  hdr           ENUM('none','HDR10','HDR10+','DV','HLG') DEFAULT 'none',
  frame_rate    VARCHAR(10)  NULL,
  audio_codec   VARCHAR(50)  NULL,
  audio_channels VARCHAR(10) NULL,
  audio_langs   JSON         NULL,
  container     VARCHAR(20)  NULL,
  source        ENUM('BluRay','BluRay Remux','UHD BluRay','WEB-DL','WEBRip','HDTV','DVD','Other') DEFAULT 'Other',
  duration_mins INT          NULL,
  raw_output    TEXT         NULL,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE
);

CREATE TABLE torrent_screenshots (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id    INT          NOT NULL,
  uploaded_by   INT          NOT NULL,
  url           VARCHAR(500) NOT NULL,
  display_order INT          DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (torrent_id)  REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_torrent (torrent_id)
);

CREATE TABLE torrent_tags (
  torrent_id    INT NOT NULL,
  tag_id        INT NOT NULL,
  added_by      INT NULL,
  PRIMARY KEY (torrent_id, tag_id),
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)     REFERENCES tags(id)     ON DELETE CASCADE,
  FOREIGN KEY (added_by)   REFERENCES users(id)    ON DELETE SET NULL
);

CREATE TABLE torrent_bookmarks (
  user_id       INT NOT NULL,
  torrent_id    INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, torrent_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
);

CREATE TABLE torrent_thanks (
  user_id       INT NOT NULL,
  torrent_id    INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, torrent_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE
);

CREATE TABLE torrent_snatches (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT          NOT NULL,
  torrent_id    INT          NOT NULL,
  completed_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE,
  INDEX idx_user    (user_id),
  INDEX idx_torrent (torrent_id),
  UNIQUE KEY uq_snatch (user_id, torrent_id)
);

CREATE TABLE reseed_requests (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  torrent_id    INT          NOT NULL,
  requested_by  INT          NOT NULL,
  notified_at   TIMESTAMP    NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (torrent_id)   REFERENCES torrents(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id)    ON DELETE CASCADE,
  UNIQUE KEY uq_reseed (torrent_id, requested_by)
);
