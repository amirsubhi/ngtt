'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Stats {
  torrent_count: number;
  user_count: number;
  total_uploaded: number;
  total_downloaded: number;
}

interface NewsItem {
  id: number;
  title: string;
  slug: string;
  published_at: string;
  author: string;
}

interface Torrent {
  id: number;
  name: string;
  category_name: string | null;
  size: number;
  seeders: number;
  leechers: number;
  is_freeleech: boolean;
  uploader: string;
}

interface Birthday {
  username: string;
}

interface HomeData {
  stats: Stats;
  news: NewsItem[];
  newest_torrents: Torrent[];
  birthdays: Birthday[];
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    setAuthed(!!token);
    api.get<HomeData>('/api/home', token).then(setData).catch(() => {});
  }, []);

  const stats = data?.stats;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-10">

      {/* Birthdays */}
      {data && data.birthdays.length > 0 && (
        <div className="rounded border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm flex flex-wrap gap-2 items-center">
          <span className="font-medium">🎂 Happy birthday to:</span>
          {data.birthdays.map(b => (
            <Link key={b.username} href={`/user/${b.username}`}
              className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
              {b.username}
            </Link>
          ))}
        </div>
      )}

      {/* Login prompt for unauthenticated visitors */}
      {!authed && (
        <div className="rounded border border-current/10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ backgroundColor: 'var(--bg-surface)' }}>
          <div>
            <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
              NGTT — Next-Gen Torrent Tracker
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              A private community built for quality, speed and longevity.
            </p>
          </div>
          <Link href="/login"
            className="shrink-0 rounded px-5 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}>
            Sign in
          </Link>
        </div>
      )}

      {/* Site stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Torrents', value: formatNum(stats.torrent_count) },
            { label: 'Members', value: formatNum(stats.user_count) },
            { label: 'Uploaded', value: formatBytes(stats.total_uploaded) },
            { label: 'Downloaded', value: formatBytes(stats.total_downloaded) },
          ].map(s => (
            <div key={s.label} className="rounded border border-current/10 p-4 text-center"
              style={{ backgroundColor: 'var(--bg-surface)' }}>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Newest torrents */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider opacity-50">Latest Uploads</h2>
          <div className="rounded border border-current/10 divide-y divide-current/5 overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)' }}>
            {data && data.newest_torrents.length === 0 && (
              <p className="p-4 text-sm opacity-40">No torrents yet.</p>
            )}
            {data?.newest_torrents.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/torrent/${t.id}`}
                    className="text-sm font-medium truncate block hover:underline"
                    style={{ color: 'var(--text-primary)' }}>
                    {t.name}
                    {t.is_freeleech && (
                      <span className="ms-2 text-xs px-1.5 py-0.5 rounded font-semibold"
                        style={{ backgroundColor: 'var(--success)', color: '#fff', fontSize: '10px' }}>
                        FL
                      </span>
                    )}
                  </Link>
                  <div className="text-xs mt-0.5 flex gap-2" style={{ color: 'var(--text-muted)' }}>
                    {t.category_name && <span>{t.category_name}</span>}
                    <span>{formatBytes(t.size)}</span>
                    <span>by {t.uploader}</span>
                  </div>
                </div>
                <div className="text-xs shrink-0 text-end" style={{ color: 'var(--text-muted)' }}>
                  <div style={{ color: 'var(--success)' }}>↑{t.seeders}</div>
                  <div style={{ color: 'var(--danger)' }}>↓{t.leechers}</div>
                </div>
              </div>
            ))}
          </div>
          {authed && (
            <Link href="/browse" className="text-xs opacity-50 hover:opacity-80">
              Browse all torrents →
            </Link>
          )}
        </div>

        {/* News */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider opacity-50">News</h2>
          <div className="space-y-3">
            {data && data.news.length === 0 && (
              <p className="text-sm opacity-40">No news yet.</p>
            )}
            {data?.news.map(n => (
              <div key={n.id} className="rounded border border-current/10 p-4"
                style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Link href={`/news/${n.slug}`}
                  className="font-medium text-sm hover:underline block"
                  style={{ color: 'var(--text-primary)' }}>
                  {n.title}
                </Link>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {n.author} · {new Date(n.published_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
