import { FastifyPluginAsync } from 'fastify';
import { query, queryOne } from '../../lib/db';
import { config } from '../../lib/config';
import { NotFoundError, ForbiddenError } from '../../lib/errors';

function xmlEscape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const baseUrl = config.frontendUrl.includes('3000')
  ? config.frontendUrl.replace('3000', '4000')
  : config.frontendUrl;

export const rssRoutes: FastifyPluginAsync = async app => {
  // 11c — RSS feed authenticated by rss_key in URL
  app.get<{ Params: { rss_key: string } }>('/rss/:rss_key', async (req, reply) => {
    const enabled = await queryOne<{ value: string }>(
      "SELECT value FROM site_settings WHERE `key` = 'rss_enabled' LIMIT 1",
    );
    if (enabled?.value !== 'true') throw new ForbiddenError('RSS is disabled');

    const user = await queryOne<{ id: number; passkey: string }>(
      'SELECT id, passkey FROM users WHERE rss_key = ? AND is_deleted = FALSE AND is_banned = FALSE LIMIT 1',
      [req.params.rss_key],
    );
    if (!user) throw new NotFoundError('Invalid RSS key');

    const q = req.query as Record<string, string>;
    const conditions: string[] = ["t.status = 'approved'"];
    const params: (string | number)[] = [];

    if (q.category) { conditions.push('c.slug = ?'); params.push(q.category); }
    if (q.freeleech === '1') { conditions.push('t.is_freeleech = TRUE'); }

    const where = conditions.join(' AND ');
    const torrents = await query<{
      id: number; name: string; description: string | null;
      size: number; is_freeleech: boolean; created_at: string; category_name: string;
    }>(
      `SELECT t.id, t.name, t.description, t.size, t.is_freeleech, t.created_at, c.label AS category_name
       FROM torrents t JOIN categories c ON c.id = t.category_id WHERE ${where}
       ORDER BY t.created_at DESC LIMIT 50`,
      params,
    );

    const items = torrents.map(t => {
      const dlUrl = `${baseUrl}/dl/${user.passkey}/${t.id}`;
      const detailUrl = `${config.frontendUrl}/torrent/${t.id}`;
      const pubDate = new Date(t.created_at).toUTCString();
      const description = t.is_freeleech
        ? `[Freeleech] ${t.description ?? ''}`
        : (t.description ?? '');
      return `    <item>
      <title>${xmlEscape(t.name)}</title>
      <link>${xmlEscape(detailUrl)}</link>
      <guid isPermaLink="false">${detailUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${xmlEscape(t.category_name)}</category>
      <description>${xmlEscape(description)}</description>
      <enclosure url="${xmlEscape(dlUrl)}" length="${t.size}" type="application/x-bittorrent"/>
    </item>`;
    }).join('\n');

    reply.header('Content-Type', 'application/rss+xml; charset=utf-8');
    return reply.send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>NGTT - New Torrents</title>
    <link>${xmlEscape(config.frontendUrl)}</link>
    <description>NGTT new torrent feed</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`);
  });
};
