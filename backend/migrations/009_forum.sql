CREATE TABLE forum_categories (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  description   TEXT         NULL,
  display_order INT          DEFAULT 0,
  is_staff_only BOOLEAN      DEFAULT FALSE,
  topic_count   INT          DEFAULT 0,
  post_count    INT          DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE forum_topics (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  category_id   INT          NOT NULL,
  user_id       INT          NOT NULL,
  title         VARCHAR(500) NOT NULL,
  slug          VARCHAR(600) NOT NULL UNIQUE,
  is_pinned     BOOLEAN      DEFAULT FALSE,
  is_locked     BOOLEAN      DEFAULT FALSE,
  views         INT          DEFAULT 0,
  reply_count   INT          DEFAULT 0,
  last_reply_at TIMESTAMP    NULL,
  last_reply_by INT          NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id)   REFERENCES forum_categories(id),
  FOREIGN KEY (user_id)       REFERENCES users(id),
  FOREIGN KEY (last_reply_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_category (category_id),
  INDEX idx_created  (created_at)
);

CREATE TABLE forum_posts (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  topic_id   INT          NOT NULL,
  user_id    INT          NOT NULL,
  body       TEXT         NOT NULL,
  edited_at  TIMESTAMP    NULL,
  edited_by  INT          NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id)  REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_topic   (topic_id),
  INDEX idx_created (created_at)
);
