CREATE TABLE news (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  title        VARCHAR(255) NOT NULL,
  slug         VARCHAR(300) NOT NULL UNIQUE,
  body         TEXT         NOT NULL,
  author_id    INT          NOT NULL,
  is_pinned    BOOLEAN      DEFAULT FALSE,
  published_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_published (published_at)
);

CREATE TABLE custom_pages (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  title         VARCHAR(255) NOT NULL,
  slug          VARCHAR(300) NOT NULL UNIQUE,
  body          TEXT         NOT NULL,
  show_in_nav   BOOLEAN      DEFAULT FALSE,
  display_order INT          DEFAULT 0,
  is_published  BOOLEAN      DEFAULT TRUE,
  created_by    INT          NULL,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO custom_pages (title, slug, body, show_in_nav, display_order, is_published) VALUES
  ('Rules', 'rules', 'Site rules go here.', TRUE, 1, TRUE),
  ('FAQ',   'faq',   'FAQ content goes here.', TRUE, 2, TRUE);
