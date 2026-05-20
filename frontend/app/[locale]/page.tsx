import Link from 'next/link';
import { cookies } from 'next/headers';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

interface Birthday {
  username: string;
}

interface TopTorrent {
  id: number;
  name: string;
  slug: string;
  size: number;
  download_count: number;
  category: string;
}

interface HomeData {
  stats: Stats;
  news: NewsItem[];
  birthdays: Birthday[];
  topTorrents?: TopTorrent[];
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

async function fetchHomeData(): Promise<HomeData> {
  try {
    const res = await fetch(`${BACKEND}/api/home`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('not ok');
    return await res.json() as HomeData;
  } catch {
    return { stats: { torrent_count: 0, user_count: 0, total_uploaded: 0, total_downloaded: 0 }, news: [], birthdays: [], topTorrents: [] };
  }
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const authed = cookieStore.has('refresh_token');
  const data = await fetchHomeData();
  const { stats, news, birthdays, topTorrents = [] } = data;

  return (
    <div>
      {/* Birthdays */}
      {birthdays.length > 0 && (
        <div className="mx-auto max-w-5xl px-4 pt-6">
          <div className="rounded border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm flex flex-wrap gap-2 items-center">
            <span className="font-medium">Happy birthday to:</span>
            {birthdays.map(b => (
              <Link key={b.username} href={`/${locale}/user/${b.username}`}
                className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                {b.username}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Hero — unauthenticated only */}
      {!authed && (
        <section className="border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="mx-auto max-w-5xl px-4 py-16 lg:py-24">
            <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-20">
              <div className="flex-1">
                <h1 className="text-6xl font-bold tracking-tight leading-none lg:text-7xl"
                  style={{ color: 'var(--text-primary)' }}>
                  NGTT
                </h1>
                <p className="mt-4 max-w-xs text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  A private community built for quality, speed and longevity.
                </p>
                <div className="mt-10 max-w-sm space-y-3">
                  {[
                    'Quality-gated. Every upload reviewed before reaching the index.',
                    'Community-seeded. Active members keep files available.',
                    'Ratio-enforced. Give back what you take.',
                  ].map(f => (
                    <p key={f} className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f}</p>
                  ))}
                </div>
                <div className="mt-10 flex items-center gap-5">
                  <Link href={`/${locale}/login`}
                    className="rounded px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}>
                    Sign in
                  </Link>
                  <Link href={`/${locale}/register`} className="text-sm transition-opacity hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}>
                    Request access &rarr;
                  </Link>
                </div>
              </div>

              <div className="shrink-0 lg:w-52 lg:pt-1">
                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                  {[
                    { label: 'Torrents', value: formatNum(stats.torrent_count) },
                    { label: 'Members', value: formatNum(stats.user_count) },
                    { label: 'Uploaded', value: formatBytes(stats.total_uploaded) },
                    { label: 'Downloaded', value: formatBytes(stats.total_downloaded) },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="text-2xl font-semibold tabular-nums leading-none"
                        style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                      <div className="mt-1.5 text-xs" style={{ color: 'var(--text-subtle)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-10">

        {/* Stats grid — authenticated only */}
        {authed && (
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

        {/* News */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest opacity-60">News</h2>
          <div className="rounded border border-current/10 divide-y divide-current/5 overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)' }}>
            {news.length === 0 && (
              <p className="p-4 text-sm opacity-40">No news yet.</p>
            )}
            {news.map(n => (
              <div key={n.id} className="px-4 py-3">
                <Link href={`/${locale}/news/${n.slug}`}
                  className="font-medium text-sm hover:underline block"
                  style={{ color: 'var(--text-primary)' }}>
                  {n.title}
                </Link>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {n.author} · {new Date(n.published_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
          {authed && (
            <Link href={`/${locale}/browse`} className="text-xs opacity-50 hover:opacity-80">
              Browse torrents &rarr;
            </Link>
          )}
        </div>

        {/* Top Torrents — authenticated only */}
        {authed && topTorrents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest opacity-60">Top Torrents</h2>
            <div className="rounded border border-current/10 divide-y divide-current/5 overflow-hidden"
              style={{ backgroundColor: 'var(--bg-surface)' }}>
              {topTorrents.map((t, i) => (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-xs tabular-nums w-5 shrink-0 text-right opacity-30">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/${locale}/torrents/${t.slug}`}
                      className="font-medium text-sm hover:underline block truncate"
                      style={{ color: 'var(--text-primary)' }}>
                      {t.name}
                    </Link>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {t.category} · {formatBytes(t.size)} · {formatNum(t.download_count)} downloads
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
