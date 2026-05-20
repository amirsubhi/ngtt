import { FastifyInstance } from 'fastify';
import { query, queryOne, execute } from '../../lib/db';
import { authenticate } from '../../middleware/auth';
import { NotFoundError } from '../../lib/errors';
import { getSwarmData } from '../../announce/peers';
import { redis } from '../../lib/redis';

const DETAIL_TTL = 60;

interface TorrentDetail {
  id: number;
  info_hash: string;
  name: string;
  slug: string;
  description: string;
  category_id: number;
  uploader_id: number;
  uploader_username: string;
  size: number;
  num_files: number;
  is_freeleech: boolean;
  is_featured: boolean;
  status: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  poster_url: string | null;
  release_year: number | null;
  nfo_content: string | null;
  magnet_enabled: boolean;
  download_count: number;
  thank_count: number;
  view_count: number;
  created_at: string;
}

interface MediaInfo {
  video_codec: string | null;
  resolution: string | null;
  hdr: string;
  frame_rate: string | null;
  audio_codec: string | null;
  audio_channels: string | null;
  container: string | null;
  source: string;
  duration_mins: number | null;
}

export async function detailRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/torrents/:id',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { id: rawId } = req.params as { id: string };
      const numId = parseInt(rawId, 10);
      const torrent = await queryOne<TorrentDetail>(
        `SELECT t.*, u.username AS uploader_username
         FROM torrents t JOIN users u ON u.id = t.uploader_id
         WHERE ${Number.isNaN(numId) ? 't.slug = ?' : 't.id = ?'}`,
        [Number.isNaN(numId) ? rawId : numId],
      );
      if (!torrent || torrent.status !== 'approved') throw new NotFoundError('Torrent not found');
      const id = torrent.id;

      // Increment view count (non-blocking)
      void execute('UPDATE torrents SET view_count = view_count + 1 WHERE id = ?', [id]);

      // Static data: files, mediainfo, screenshots, tags, subtitle count — cached per torrent
      const cacheKey = `torrent:detail:${id}`;
      interface StaticCache {
        files: { path: string; size: number }[];
        mediainfo: MediaInfo | null;
        screenshots: { id: number; url: string; display_order: number }[];
        tags: { id: number; name: string; slug: string; color: string }[];
        subtitle_count: number;
      }

      let staticData: StaticCache;
      const cached = await redis.get(cacheKey);
      if (cached) {
        staticData = JSON.parse(cached) as StaticCache;
      } else {
        const [files, mediainfo, screenshots, tags, subtitleCount] = await Promise.all([
          query<{ path: string; size: number }>('SELECT path, size FROM torrent_files WHERE torrent_id = ? ORDER BY path', [id]),
          queryOne<MediaInfo>('SELECT video_codec, resolution, hdr, frame_rate, audio_codec, audio_channels, container, source, duration_mins FROM torrent_mediainfo WHERE torrent_id = ?', [id]),
          query<{ id: number; url: string; display_order: number }>('SELECT id, url, display_order FROM torrent_screenshots WHERE torrent_id = ? ORDER BY display_order', [id]),
          query<{ id: number; name: string; slug: string; color: string }>('SELECT tg.id, tg.name, tg.slug, tg.color FROM tags tg JOIN torrent_tags tt ON tt.tag_id = tg.id WHERE tt.torrent_id = ?', [id]),
          queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM subtitles WHERE torrent_id = ?', [id]),
        ]);
        staticData = { files, mediainfo, screenshots, tags, subtitle_count: subtitleCount?.cnt ?? 0 };
        await redis.set(cacheKey, JSON.stringify(staticData), 'EX', DETAIL_TTL);
      }

      // Per-user and live data: always fresh
      const [swarm, bookmarked, thanked, reseedReq] = await Promise.all([
        getSwarmData(torrent.info_hash, 100),
        queryOne<{ user_id: number }>('SELECT user_id FROM torrent_bookmarks WHERE user_id = ? AND torrent_id = ? LIMIT 1', [req.user.id, id]),
        queryOne<{ user_id: number }>('SELECT user_id FROM torrent_thanks WHERE user_id = ? AND torrent_id = ? LIMIT 1', [req.user.id, id]),
        queryOne<{ id: number }>('SELECT id FROM reseed_requests WHERE torrent_id = ? AND requested_by = ? LIMIT 1', [id, req.user.id]),
      ]);

      const { peers, seeders, leechers } = swarm;

      return reply.send({
        ...torrent,
        ...staticData,
        peers: peers.map(p => ({ ip: p.ip, port: p.port, seeder: p.seeder })),
        seeders,
        leechers,
        bookmarked: !!bookmarked,
        thanked: !!thanked,
        reseed_requested: !!reseedReq,
      });
    },
  );
}
