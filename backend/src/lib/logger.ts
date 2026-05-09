import pino from 'pino';

function redactUrl(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  // Strip passkeys (/announce/:passkey, /dl/:passkey, /rss/:passkey) and API keys (?apikey=...)
  return val
    .replace(/(\/announce\/|\/dl\/|\/rss\/)[a-f0-9]{32,}/g, '$1[REDACTED]')
    .replace(/apikey=[^&\s]+/g, 'apikey=[REDACTED]');
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
  serializers: {
    req(req: { method?: string; url?: string }) {
      return { method: req.method, url: redactUrl(req.url) };
    },
  },
});
