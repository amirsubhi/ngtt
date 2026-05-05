export interface User {
  id: number;
  username: string;
  email: string;
  passkey: string;
  rss_key: string;
  api_key: string | null;
  api_enabled: boolean;
  group_id: number;
  invited_by: number | null;
  invite_tokens: number;
  uploaded: number;
  downloaded: number;
  flux: number;
  is_banned: boolean;
  ban_reason: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  warned: boolean;
  warning_expires_at: string | null;
  email_verified: boolean;
  two_factor_enabled: boolean;
  birth_date: string | null;
  show_birthday: boolean;
  locale: string;
  theme: 'void' | 'pulse' | 'cipher' | 'nebula' | 'ember' | 'lumen' | 'sand';
  avatar_url: string | null;
  about_me: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string;
  usage_count: number;
  created_by: number | null;
  created_at: string;
}

export interface Torrent {
  id: number;
  info_hash: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: number;
  uploader_id: number;
  size: number;
  num_files: number;
  is_freeleech: boolean;
  is_featured: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'takedown' | 'dmca_pending';
  approved_by: number | null;
  approved_at: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  musicbrainz_id: string | null;
  poster_url: string | null;
  release_year: number | null;
  download_count: number;
  thank_count: number;
  view_count: number;
  magnet_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FluxTransaction {
  id: number;
  user_id: number;
  amount: number;
  type: 'earn' | 'spend';
  source: string;
  description: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ForumPost {
  id: number;
  topic_id: number;
  user_id: number;
  body: string;
  edited_at: string | null;
  edited_by: number | null;
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  subject: string;
  body: string;
  is_read: boolean;
  deleted_by_sender: boolean;
  deleted_by_receiver: boolean;
  created_at: string;
}

export interface Subtitle {
  id: number;
  torrent_id: number;
  uploaded_by: number | null;
  language: string;
  language_label: string;
  format: 'srt' | 'ass' | 'ssa' | 'vtt' | 'sub' | 'idx' | 'sup';
  filename: string;
  file_path: string;
  file_size: number;
  is_approved: boolean;
  download_count: number;
  is_machine_translated: boolean;
  source: 'manual' | 'opensubtitles_sync';
  os_subtitle_id: string | null;
  notes: string | null;
  created_at: string;
}
