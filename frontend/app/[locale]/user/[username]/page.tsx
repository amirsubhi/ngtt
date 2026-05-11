'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Breadcrumb } from '@/components/Breadcrumb';

interface ProfileData {
  id: number;
  username: string;
  group_name: string;
  group_color: string;
  uploaded: number;
  downloaded: number;
  ratio: number | null;
  flux?: number;
  avatar_url: string | null;
  about_me: string | null;
  created_at: string;
  last_seen_at: string | null;
  upload_count: number;
  thank_count_received: number;
  active_hnr_count: number;
  snatch_count: number;
  private?: boolean;
}

interface StatsData {
  uploads: { id: number; name: string; created_at: string; download_count: number }[];
  snatches: { torrent_id: number; name: string; completed_at: string }[];
  bookmarks: { torrent_id: number; name: string; created_at: string }[];
}

interface HnrRow {
  id: number;
  torrent_id: number;
  torrent_name: string;
  downloaded_at: string;
  seed_deadline_at: string;
  seeded_time_mins: number;
  status: 'active' | 'resolved' | 'pardoned' | 'expired';
}

interface WarningRow {
  id: number;
  reason: string;
  warned_by_username: string;
  created_at: string;
  expires_at: string | null;
}

function formatBytes(bytes: number): string {
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const HNR_ICON: Record<string, string> = { active: '⚠️', resolved: '✅', pardoned: '🟢', expired: '❌' };

type Tab = 'uploads' | 'snatches' | 'bookmarks' | 'hnr';

export default function UserProfilePage({ params }: { params: { username: string } }) {
  const t = useTranslations('user.profile');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [hnrList, setHnrList] = useState<HnrRow[]>([]);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [tab, setTab] = useState<Tab>('uploads');
  const [error, setError] = useState('');
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    if (!token) return;
    api.get<ProfileData>(`/api/users/${params.username}`, token)
      .then(setProfile)
      .catch(() => setError('User not found'));
  }, [params.username]);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    if (!token || !profile || profile.private) return;
    api.get<StatsData>(`/api/users/${params.username}/stats`, token)
      .then(setStats)
      .catch(() => {});
  }, [profile, params.username]);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    if (!token || !profile) return;
    // Check if self by decoding stored username
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.username === params.username) {
        setIsSelf(true);
        api.get<{ hnr: HnrRow[] }>('/api/users/me/hnr', token)
          .then(d => setHnrList(d.hnr))
          .catch(() => {});
        api.get<{ warnings: WarningRow[] }>('/api/users/me/warnings', token)
          .then(d => setWarnings(d.warnings))
          .catch(() => {});
      }
    } catch { /* non-standard token */ }
  }, [profile, params.username]);

  if (error) return <div className="flex min-h-screen items-center justify-center opacity-60">{error}</div>;
  if (!profile) return <div className="flex min-h-screen items-center justify-center opacity-40">Loading…</div>;

  if (profile.private) {
    return (
      <div className="container mx-auto px-4 py-12 text-center space-y-4">
        {profile.avatar_url && <img src={profile.avatar_url} alt={profile.username} className="w-24 h-24 rounded-full mx-auto object-cover" />}
        <h1 className="text-2xl font-bold">{profile.username}</h1>
        <span className="text-sm px-2 py-0.5 rounded" style={{ backgroundColor: `${profile.group_color}20`, color: profile.group_color }}>{profile.group_name}</span>
        <p className="opacity-50 text-sm">{t('private')}</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'uploads', label: t('tab_uploads') },
    { key: 'snatches', label: t('tab_snatches') },
    { key: 'bookmarks', label: t('tab_bookmarks') },
    ...(isSelf ? [{ key: 'hnr' as Tab, label: t('tab_hnr') }] : []),
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
      <Breadcrumb crumbs={[{ label: 'Members', href: '/members' }, { label: profile.username }]} />
      {/* Header */}
      <div className="flex gap-6 items-start">
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt={profile.username} className="w-24 h-24 rounded-full object-cover flex-shrink-0" />
          : <div className="w-24 h-24 rounded-full bg-current/10 flex-shrink-0 flex items-center justify-center text-3xl font-bold opacity-30">{profile.username[0].toUpperCase()}</div>
        }
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{profile.username}</h1>
            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: `${profile.group_color}20`, color: profile.group_color }}>{profile.group_name}</span>
          </div>
          {profile.about_me && <p className="text-sm opacity-70">{profile.about_me}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><div className="opacity-50 text-xs">{t('uploaded')}</div><div>{formatBytes(profile.uploaded)}</div></div>
            <div><div className="opacity-50 text-xs">{t('downloaded')}</div><div>{formatBytes(profile.downloaded)}</div></div>
            <div><div className="opacity-50 text-xs">{t('ratio')}</div><div className={profile.ratio !== null && profile.ratio < 0.5 ? 'text-red-500' : ''}>{profile.ratio !== null ? profile.ratio.toFixed(2) : '∞'}</div></div>
            <div><div className="opacity-50 text-xs">{t('uploads')}</div><div>{profile.upload_count}</div></div>
            <div><div className="opacity-50 text-xs">{t('thanks_received')}</div><div>{profile.thank_count_received}</div></div>
            {profile.active_hnr_count > 0 && <div><div className="opacity-50 text-xs">{t('active_hnr')}</div><div className="text-red-500">{profile.active_hnr_count}</div></div>}
            <div><div className="opacity-50 text-xs">{t('joined')}</div><div>{new Date(profile.created_at).toLocaleDateString()}</div></div>
            {profile.last_seen_at && <div><div className="opacity-50 text-xs">{t('last_seen')}</div><div>{new Date(profile.last_seen_at).toLocaleDateString()}</div></div>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-current/10 flex gap-1">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === key ? 'border-[var(--color-accent)]' : 'border-transparent opacity-50 hover:opacity-70'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'uploads' && (
        <div className="space-y-2">
          {(stats?.uploads ?? []).map(u => (
            <div key={u.id} className="flex justify-between text-sm py-1 border-b border-current/5">
              <Link href={`/torrent/${u.id}`} className="hover:underline">{u.name}</Link>
              <span className="opacity-40 ml-4 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {!stats?.uploads.length && <p className="opacity-40 text-sm">No uploads.</p>}
        </div>
      )}

      {tab === 'snatches' && (
        <div className="space-y-2">
          {(stats?.snatches ?? []).map(s => (
            <div key={s.torrent_id} className="flex justify-between text-sm py-1 border-b border-current/5">
              <Link href={`/torrent/${s.torrent_id}`} className="hover:underline">{s.name}</Link>
              <span className="opacity-40 ml-4 whitespace-nowrap">{new Date(s.completed_at).toLocaleDateString()}</span>
            </div>
          ))}
          {!stats?.snatches.length && <p className="opacity-40 text-sm">No snatches visible.</p>}
        </div>
      )}

      {tab === 'bookmarks' && (
        <div className="space-y-2">
          {(stats?.bookmarks ?? []).map(b => (
            <div key={b.torrent_id} className="flex justify-between text-sm py-1 border-b border-current/5">
              <Link href={`/torrent/${b.torrent_id}`} className="hover:underline">{b.name}</Link>
              <span className="opacity-40 ml-4 whitespace-nowrap">{new Date(b.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {!stats?.bookmarks.length && <p className="opacity-40 text-sm">No bookmarks.</p>}
        </div>
      )}

      {tab === 'hnr' && (
        <div className="space-y-2">
          {hnrList.map(hnr => (
            <div key={hnr.id} className="flex items-start justify-between py-2 border-b border-current/5 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span>{HNR_ICON[hnr.status]}</span>
                  <Link href={`/torrent/${hnr.torrent_id}`} className="text-sm hover:underline truncate">{hnr.torrent_name}</Link>
                </div>
                <div className="text-xs opacity-50 mt-0.5">
                  {t('hnr_seeded')}: {hnr.seeded_time_mins}m · {t('hnr_deadline')}: {new Date(hnr.seed_deadline_at).toLocaleDateString()}
                </div>
              </div>
              <span className={`text-xs capitalize whitespace-nowrap ${hnr.status === 'expired' ? 'text-red-500' : hnr.status === 'resolved' ? 'text-green-500' : 'opacity-60'}`}>
                {hnr.status}
              </span>
            </div>
          ))}
          {hnrList.length === 0 && <p className="opacity-40 text-sm">{t('hnr_empty')}</p>}
        </div>
      )}

      {/* Warnings — only visible to self */}
      {isSelf && warnings.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-red-400">Active Warnings</h3>
          {warnings.map(w => (
            <div key={w.id} className="rounded border border-red-500/20 bg-red-500/5 px-4 py-3 space-y-1">
              <p className="text-sm">{w.reason}</p>
              <p className="text-xs opacity-50">
                by {w.warned_by_username} · {new Date(w.created_at).toLocaleDateString()}
                {w.expires_at && ` · expires ${new Date(w.expires_at).toLocaleDateString()}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
