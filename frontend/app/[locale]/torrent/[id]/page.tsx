'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Breadcrumb } from '@/components/Breadcrumb';

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

interface SubtitleRow {
  id: number; language: string; language_label: string;
  format: string; filename: string; download_count: number;
  is_machine_translated: boolean; source: string;
  uploader_username: string | null; vote_score: number; created_at: string;
}

const SOURCE_BADGE: Record<string, string> = {
  manual: '👤',
  opensubtitles_sync: '[OS]',
};

const LANG_FLAGS: Record<string, string> = {
  en: '🇬🇧', zh: '🇨🇳', es: '🇪🇸', pt: '🇧🇷', ar: '🇸🇦',
  ms: '🇲🇾', fr: '🇫🇷', de: '🇩🇪', ja: '🇯🇵', ko: '🇰🇷',
  ru: '🇷🇺', it: '🇮🇹', pl: '🇵🇱', nl: '🇳🇱', tr: '🇹🇷',
  vi: '🇻🇳', th: '🇹🇭', id: '🇮🇩', hi: '🇮🇳', sv: '🇸🇪',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type Tab = 'files' | 'nfo' | 'screenshots' | 'peers' | 'subtitles';

function SubtitleUploadForm({ torrentId, token, onDone }: { torrentId: number; token: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('en');
  const [isMachine, setIsMachine] = useState(false);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const LANGUAGES = [
    ['en','English'],['zh','Chinese'],['es','Spanish'],['pt','Portuguese'],
    ['ar','Arabic'],['ms','Malay'],['fr','French'],['de','German'],
    ['ja','Japanese'],['ko','Korean'],['ru','Russian'],['it','Italian'],
    ['pl','Polish'],['nl','Dutch'],['tr','Turkish'],['vi','Vietnamese'],
    ['th','Thai'],['id','Indonesian'],['hi','Hindi'],['sv','Swedish'],
  ];

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('language', language);
      fd.append('is_machine_translated', String(isMachine));
      if (notes) fd.append('notes', notes);

      const res = await fetch(`/api/torrents/${torrentId}/subtitles`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        setError(err.message ?? 'Upload failed');
        return;
      }
      onDone();
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border border-current/10 rounded p-4 space-y-3 text-sm">
      <h3 className="font-medium">Upload Subtitle</h3>
      <div className="flex flex-wrap gap-3">
        <input type="file" accept=".srt,.ass,.ssa,.vtt,.sub,.idx,.sup"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="text-xs" />
        <select value={language} onChange={e => setLanguage(e.target.value)}
          className="rounded border border-current/20 bg-transparent px-2 py-1 text-xs">
          {LANGUAGES.map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <input type="checkbox" id="machine" checked={isMachine} onChange={e => setIsMachine(e.target.checked)} />
        <label htmlFor="machine">Machine translated</label>
      </div>
      <input type="text" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
        className="w-full rounded border border-current/20 bg-transparent px-2 py-1 text-xs" />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button onClick={handleUpload} disabled={!file || uploading}
        className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs text-white disabled:opacity-40">
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </div>
  );
}

function SubtitlesTab({ torrentId, token }: { torrentId: number; token: string }) {
  const [grouped, setGrouped] = useState<Record<string, SubtitleRow[]>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [hasOs, setHasOs] = useState(false);

  function loadSubtitles() {
    api.get<{ subtitles: Record<string, SubtitleRow[]> }>(`/api/torrents/${torrentId}/subtitles`, token)
      .then(d => setGrouped(d.subtitles))
      .catch(() => {});
  }

  useEffect(() => {
    loadSubtitles();
    // Check OS connection + auto-sync
    api.get<{ remaining_downloads: number | null }>('/api/users/me/integrations/opensubtitles/quota', token)
      .then(d => { setHasOs(true); setQuotaRemaining(d.remaining_downloads); })
      .catch(() => setHasOs(false));
  }, [torrentId, token]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await api.post<{ synced_count: number; remaining_downloads: number | null }>(
        `/api/torrents/${torrentId}/subtitles/sync`, {}, token,
      );
      setSyncMsg(`Synced ${res.synced_count} subtitle${res.synced_count !== 1 ? 's' : ''}.`);
      setQuotaRemaining(res.remaining_downloads);
      loadSubtitles();
    } catch (e) {
      setSyncMsg(e instanceof ApiError ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleVote(subId: number, vote: 'up' | 'down') {
    try {
      await api.post(`/api/subtitles/${subId}/vote`, { vote }, token);
      loadSubtitles();
    } catch { /* ignore */ }
  }

  async function handleReport(subId: number) {
    const reason = window.prompt('Reason for reporting this subtitle?');
    if (!reason) return;
    try {
      await api.post(`/api/subtitles/${subId}/report`, { reason }, token);
    } catch { /* ignore */ }
  }

  const languages = Object.keys(grouped);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setShowUpload(v => !v)}
            className="rounded border border-current/20 px-3 py-1.5 text-xs hover:bg-current/5">
            Upload Subtitle
          </button>
          {hasOs && (
            <button onClick={handleSync} disabled={syncing}
              className="rounded border border-current/20 px-3 py-1.5 text-xs hover:bg-current/5 disabled:opacity-40">
              {syncing ? 'Syncing…' : '🔄 Sync from OpenSubtitles'}
            </button>
          )}
        </div>
        {hasOs && quotaRemaining !== null && (
          <span className="text-xs opacity-50">OS quota: {quotaRemaining} downloads remaining</span>
        )}
      </div>

      {syncMsg && <p className="text-xs opacity-70">{syncMsg}</p>}

      {showUpload && (
        <SubtitleUploadForm torrentId={torrentId} token={token} onDone={() => { setShowUpload(false); loadSubtitles(); }} />
      )}

      {languages.length === 0 && (
        <p className="opacity-40 text-sm">No subtitles available.</p>
      )}

      {languages.map(lang => (
        <div key={lang} className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium opacity-70 border-b border-current/10 pb-1">
            <span>{LANG_FLAGS[lang] ?? '🌐'}</span>
            <span>{grouped[lang][0]?.language_label ?? lang.toUpperCase()}</span>
          </div>
          {grouped[lang].map(sub => (
            <div key={sub.id} className="flex items-center justify-between py-1 gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="opacity-50 font-mono uppercase">{sub.format}</span>
                <span className="opacity-50">{SOURCE_BADGE[sub.source] ?? ''}</span>
                {sub.is_machine_translated && <span className="opacity-50">🤖</span>}
                <span className="opacity-60 truncate">{sub.uploader_username ?? 'System'}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="opacity-40">{sub.download_count} dl</span>
                <button onClick={() => handleVote(sub.id, 'up')} className="opacity-60 hover:opacity-100">▲</button>
                <span className={sub.vote_score > 0 ? 'text-green-500' : sub.vote_score < 0 ? 'text-red-500' : 'opacity-40'}>
                  {sub.vote_score}
                </span>
                <button onClick={() => handleVote(sub.id, 'down')} className="opacity-60 hover:opacity-100">▼</button>
                <a href={`/api/subtitles/${sub.id}/download`}
                  className="rounded border border-current/20 px-2 py-0.5 hover:bg-current/5">
                  Download
                </a>
                <button onClick={() => handleReport(sub.id)} className="opacity-40 hover:opacity-70">⚑</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function TorrentDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('torrent.detail');
  const [torrent, setTorrent] = useState<TorrentDetail | null>(null);
  const [tab, setTab] = useState<Tab>('files');
  const [error, setError] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [thanked, setThanked] = useState(false);
  const [thankLoading, setThankLoading] = useState(false);
  const [token, setToken] = useState('');
  const autoSyncDone = useRef(false);

  useEffect(() => {
    const tok = localStorage.getItem('access_token') ?? '';
    setToken(tok);
    if (!tok) return;
    api.get<TorrentDetail>(`/api/torrents/${params.id}`, tok)
      .then(data => {
        setTorrent(data);
        setBookmarked(data.bookmarked);
        setThanked(data.thanked);
      })
      .catch(() => setError('Torrent not found'));
  }, [params.id]);

  // 9g — auto-sync if user has os_auto_sync enabled
  useEffect(() => {
    if (!torrent || !token || autoSyncDone.current) return;
    autoSyncDone.current = true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.os_auto_sync) {
        void fetch(`/api/torrents/${torrent.id}/subtitles/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      }
    } catch { /* non-standard token or no os_auto_sync claim */ }
  }, [torrent, token]);

  async function handleThank() {
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
    if (!token || !torrent) return;
    try {
      const res = await api.post<{ bookmarked: boolean }>(`/api/torrents/${torrent.id}/bookmark`, {}, token);
      setBookmarked(res.bookmarked);
    } catch { /* ignore */ }
  }

  function handleDownload() {
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
    { key: 'subtitles', label: t('tab_subtitles') },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <Breadcrumb crumbs={[
        { label: 'Browse', href: '/browse' },
        { label: torrent.category_name },
        { label: torrent.name },
      ]} />
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

      {tab === 'subtitles' && token && (
        <SubtitlesTab torrentId={torrent.id} token={token} />
      )}
    </div>
  );
}
