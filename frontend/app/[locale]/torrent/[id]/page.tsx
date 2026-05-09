'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

interface TorrentFile { path: string; size: number }
interface Screenshot { id: number; url: string }
interface Tag { id: number; name: string; color: string }
interface Peer { ip: string; port: number; seeder: boolean }
interface MediaInfo { video_codec: string | null; resolution: string | null; hdr: string; audio_codec: string | null; container: string | null; source: string; duration_mins: number | null }

interface TorrentDetail {
  id: number; name: string; description: string;
  category_name: string; uploader_username: string;
  size: number; is_freeleech: boolean; nfo_content: string | null;
  magnet_enabled: boolean; download_count: number; thank_count: number;
  created_at: string; poster_url: string | null; release_year: number | null;
  seeders: number; leechers: number;
  files: TorrentFile[]; screenshots: Screenshot[];
  tags: Tag[]; peers: Peer[]; mediainfo: MediaInfo | null;
  bookmarked: boolean; thanked: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type Tab = 'files' | 'nfo' | 'screenshots' | 'peers';

export default function TorrentDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('torrent.detail');
  const [torrent, setTorrent] = useState<TorrentDetail | null>(null);
  const [tab, setTab] = useState<Tab>('files');
  const [error, setError] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [thanked, setThanked] = useState(false);
  const [thankLoading, setThankLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    api.get<TorrentDetail>(`/api/torrents/${params.id}`, token)
      .then(data => {
        setTorrent(data);
        setBookmarked(data.bookmarked);
        setThanked(data.thanked);
      })
      .catch(() => setError('Torrent not found'));
  }, [params.id]);

  async function handleThank() {
    const token = localStorage.getItem('access_token');
    if (!token || !torrent || thanked) return;
    setThankLoading(true);
    try {
      await api.post(`/api/torrents/${torrent.id}/thank`, {}, token);
      setThanked(true);
      setTorrent(prev => prev ? { ...prev, thank_count: prev.thank_count + 1 } : prev);
    } catch { /* ignore */ } finally {
      setThankLoading(false);
    }
  }

  async function handleBookmark() {
    const token = localStorage.getItem('access_token');
    if (!token || !torrent) return;
    try {
      const res = await api.post<{ bookmarked: boolean }>(`/api/torrents/${torrent.id}/bookmark`, {}, token);
      setBookmarked(res.bookmarked);
    } catch { /* ignore */ }
  }

  function handleDownload() {
    const token = localStorage.getItem('access_token');
    if (!token || !torrent) return;
    window.location.href = `/api/torrents/${torrent.id}/download`;
  }

  if (error) {
    return <div className="flex min-h-screen items-center justify-center opacity-60">{error}</div>;
  }
  if (!torrent) {
    return <div className="flex min-h-screen items-center justify-center opacity-40">Loading…</div>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'files', label: t('tab_files') },
    { key: 'nfo', label: t('tab_nfo') },
    { key: 'screenshots', label: t('tab_screenshots') },
    { key: 'peers', label: t('tab_peers') },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex gap-6">
        {torrent.poster_url && (
          <img src={torrent.poster_url} alt={torrent.name} className="w-36 rounded object-cover flex-shrink-0" />
        )}
        <div className="flex-1 space-y-2">
          <h1 className="text-2xl font-bold">{torrent.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm opacity-60">
            <span>{t('uploader')}: <Link href={`/user/${torrent.uploader_username}`} className="hover:underline">{torrent.uploader_username}</Link></span>
            <span>{t('added')}: {new Date(torrent.created_at).toLocaleDateString()}</span>
            <span>{formatBytes(torrent.size)}</span>
            {torrent.release_year && <span>{torrent.release_year}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {torrent.is_freeleech && (
              <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">{t('freeleech')}</span>
            )}
            {torrent.tags?.map(tag => (
              <span key={tag.id} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>{tag.name}</span>
            ))}
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-green-500">{t('seeders')}: {torrent.seeders}</span>
            <span className="opacity-60">{t('leechers')}: {torrent.leechers}</span>
          </div>
          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={handleDownload} className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              {t('download')}
            </button>
            <button
              onClick={handleThank}
              disabled={thanked || thankLoading}
              className="rounded border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-40"
            >
              {thanked ? t('thanked') : t('thank')} ({torrent.thank_count})
            </button>
            <button
              onClick={handleBookmark}
              className="rounded border border-current/20 px-4 py-2 text-sm hover:bg-current/5"
            >
              {bookmarked ? t('bookmarked') : t('bookmark')}
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      {torrent.description && (
        <p className="text-sm opacity-80 whitespace-pre-wrap">{torrent.description}</p>
      )}

      {/* Tabs */}
      <div className="border-b border-current/10 flex gap-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === key ? 'border-[var(--color-accent)] opacity-100' : 'border-transparent opacity-50 hover:opacity-70'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'files' && (
        <div className="space-y-1">
          {torrent.files.map((f, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b border-current/5">
              <span className="opacity-80 break-all">{f.path}</span>
              <span className="opacity-40 ml-4 whitespace-nowrap">{formatBytes(f.size)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'nfo' && (
        <pre className="font-mono text-xs bg-black/20 p-4 rounded overflow-x-auto whitespace-pre leading-tight">
          {torrent.nfo_content ?? 'No NFO available.'}
        </pre>
      )}

      {tab === 'screenshots' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {torrent.screenshots.map(s => (
            <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
              <img src={s.url} alt="Screenshot" className="rounded w-full object-cover aspect-video" />
            </a>
          ))}
          {torrent.screenshots.length === 0 && <p className="opacity-40 text-sm col-span-3">No screenshots.</p>}
        </div>
      )}

      {tab === 'peers' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left opacity-50 border-b border-current/10">
                <th className="py-1 pr-4">IP</th>
                <th className="py-1 pr-4">Port</th>
                <th className="py-1">Type</th>
              </tr>
            </thead>
            <tbody>
              {torrent.peers.map((p, i) => (
                <tr key={i} className="border-b border-current/5">
                  <td className="py-1 pr-4 font-mono opacity-70">{p.ip}</td>
                  <td className="py-1 pr-4 opacity-50">{p.port}</td>
                  <td className={`py-1 ${p.seeder ? 'text-green-400' : 'opacity-50'}`}>{p.seeder ? 'S' : 'L'}</td>
                </tr>
              ))}
              {torrent.peers.length === 0 && <tr><td colSpan={3} className="py-4 opacity-40">No active peers.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
