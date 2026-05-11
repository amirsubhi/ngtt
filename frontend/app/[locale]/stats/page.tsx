'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface Totals { total_torrents: number; total_users: number; total_size: number }
interface Uploader { username: string; uploaded: number; upload_count: number }
interface TopTorrent { id: number; name: string; slug: string; download_count: number; category_label: string; category_icon: string }
interface RatioHolder { username: string; uploaded: number; downloaded: number }
interface Stats { totals: Totals; topUploaders: Uploader[]; topSnatched: TopTorrent[]; topRatio: RatioHolder[] }

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    if (!token) { router.push('/login'); return; }
    api.get<Stats>('/api/stats', token)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const cardCls = 'rounded-lg border border-current/10 p-4';
  const thCls = 'text-left text-xs font-semibold uppercase tracking-wide pb-2 opacity-50';

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold">Site Statistics</h1>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        {loading ? Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cardCls + ' space-y-2'}>
            <Skeleton height="h-3" width="w-20" />
            <Skeleton height="h-8" width="w-32" />
          </div>
        )) : stats ? (
          <>
            <div className={cardCls + ' text-center'}>
              <p className="text-xs opacity-50 uppercase tracking-wide mb-1">Torrents</p>
              <p className="text-3xl font-bold">{stats.totals.total_torrents.toLocaleString()}</p>
            </div>
            <div className={cardCls + ' text-center'}>
              <p className="text-xs opacity-50 uppercase tracking-wide mb-1">Members</p>
              <p className="text-3xl font-bold">{stats.totals.total_users.toLocaleString()}</p>
            </div>
            <div className={cardCls + ' text-center'}>
              <p className="text-xs opacity-50 uppercase tracking-wide mb-1">Total Size</p>
              <p className="text-3xl font-bold">{formatBytes(Number(stats.totals.total_size))}</p>
            </div>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Uploaders */}
        <div className={cardCls}>
          <h2 className="font-semibold mb-4">Top Uploaders</h2>
          {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="h-4" />)}</div>
            : !stats?.topUploaders.length ? <EmptyState icon="📤" title="No data yet" />
            : (
              <table className="w-full text-sm">
                <thead><tr>
                  <th className={thCls}>#</th>
                  <th className={thCls}>User</th>
                  <th className={`${thCls} text-right`}>Uploaded</th>
                  <th className={`${thCls} text-right`}>Torrents</th>
                </tr></thead>
                <tbody>
                  {stats.topUploaders.map((u, i) => (
                    <tr key={u.username} className="border-t border-current/5">
                      <td className="py-1.5 pr-3 opacity-40 text-xs">{i + 1}</td>
                      <td className="py-1.5"><Link href={`/user/${u.username}`} className="hover:underline">{u.username}</Link></td>
                      <td className="py-1.5 text-right opacity-70 whitespace-nowrap">{formatBytes(u.uploaded)}</td>
                      <td className="py-1.5 text-right opacity-70">{u.upload_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {/* Top Ratio Holders */}
        <div className={cardCls}>
          <h2 className="font-semibold mb-4">Top Ratio</h2>
          {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="h-4" />)}</div>
            : !stats?.topRatio.length ? <EmptyState icon="⚖️" title="No data yet" />
            : (
              <table className="w-full text-sm">
                <thead><tr>
                  <th className={thCls}>#</th>
                  <th className={thCls}>User</th>
                  <th className={`${thCls} text-right`}>Ratio</th>
                  <th className={`${thCls} text-right`}>Up / Down</th>
                </tr></thead>
                <tbody>
                  {stats.topRatio.map((u, i) => {
                    const ratio = u.downloaded > 0 ? (u.uploaded / u.downloaded).toFixed(2) : '∞';
                    return (
                      <tr key={u.username} className="border-t border-current/5">
                        <td className="py-1.5 pr-3 opacity-40 text-xs">{i + 1}</td>
                        <td className="py-1.5"><Link href={`/user/${u.username}`} className="hover:underline">{u.username}</Link></td>
                        <td className="py-1.5 text-right font-medium text-green-400">{ratio}</td>
                        <td className="py-1.5 text-right opacity-60 text-xs whitespace-nowrap">{formatBytes(u.uploaded)} / {formatBytes(u.downloaded)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* Most Snatched */}
      <div className={cardCls}>
        <h2 className="font-semibold mb-4">Most Snatched Torrents</h2>
        {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="h-4" />)}</div>
          : !stats?.topSnatched.length ? <EmptyState icon="🔽" title="No downloads yet" />
          : (
            <table className="w-full text-sm">
              <thead><tr>
                <th className={thCls}>#</th>
                <th className={thCls}>Torrent</th>
                <th className={`${thCls} text-right`}>Snatches</th>
              </tr></thead>
              <tbody>
                {stats.topSnatched.map((t, i) => (
                  <tr key={t.id} className="border-t border-current/5">
                    <td className="py-1.5 pr-3 opacity-40 text-xs">{i + 1}</td>
                    <td className="py-1.5">
                      <span className="mr-2">{t.category_icon}</span>
                      <Link href={`/torrent/${t.slug}`} className="hover:underline">{t.name}</Link>
                    </td>
                    <td className="py-1.5 text-right font-medium">{t.download_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
