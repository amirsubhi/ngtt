import 'dotenv/config';

function require(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  nodeEnv:   optional('NODE_ENV', 'development'),
  port:      parseInt(optional('PORT', '4000'), 10),
  frontendUrl: require('FRONTEND_URL'),

  databaseUrl: require('DATABASE_URL'),
  redisUrl:    require('REDIS_URL'),

  jwtAccessSecret:  require('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: require('JWT_REFRESH_SECRET'),
  jwtAccessExpires:  optional('JWT_ACCESS_EXPIRES', '15m'),
  jwtRefreshExpires: optional('JWT_REFRESH_EXPIRES', '7d'),

  uploadPath: require('UPLOAD_PATH'),
  uploadUrl:  require('UPLOAD_URL'),

  smtpHost: require('SMTP_HOST'),
  smtpPort: parseInt(optional('SMTP_PORT', '587'), 10),
  smtpUser: require('SMTP_USER'),
  smtpPass: require('SMTP_PASS'),
  smtpFrom: require('SMTP_FROM'),

  encryptionKey: require('ENCRYPTION_KEY'),

  turnstileSecret: optional('TURNSTILE_SECRET_KEY', ''),
  tmdbApiKey:      optional('TMDB_API_KEY', ''),
  musicbrainzUa:   optional('MUSICBRAINZ_UA', 'NGTT/1.0'),

  announceInterval:    parseInt(optional('ANNOUNCE_INTERVAL', '1800'), 10),
  minAnnounceInterval: parseInt(optional('MIN_ANNOUNCE_INTERVAL', '900'), 10),
};
