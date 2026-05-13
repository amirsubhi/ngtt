'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';
import { SkeletonRow, Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  slug: string;
  label: string;
  icon: string;
  color: string;
  subcats: string[];
}

interface TorrentRow {
  id: number;
  name: string;
  slug: string;
  categoryId: number;
  categoryIcon: string;
  categoryColor: string;
  categoryLabel: string;
  subcat: string | null;
  size: number;
  seeders: number;
  leechers: number;
  snatched: number;
  uploadedAt: string;
  uploaderName: string;
  freeleech: boolean;
  hdr: boolean;
  internal: boolean;
  resolution: string | null;
  source: string | null;
  codec: string | null;
}

interface BrowseResponse {
  data: TorrentRow[];
  total: number;
  page: number;
  pages: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESOLUTIONS = ['2160p', '1080p', '720p', 'SD'];
const SOURCES = ['BluRay REMUX', 'BluRay', 'WEB-DL', 'WEB', 'HDTV'];
const SORT_OPTIONS = [
  { value: 'seeders',  label: 'Seeders ↓' },
  { value: 'newest',   label: 'Newest' },
  { value: 'size',     label: 'Size ↓' },
  { value: 'name',     label: 'Name A–Z' },
  { value: 'snatched', label: 'Most snatched' },
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function buildParams(overrides: Record<string, string | string[] | undefined>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) v.forEach(x => p.append(k, x));
    else p.set(k, v);
  }
  return p;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const locale       = useLocale();

  const q        = searchParams.get('q') ?? '';
  const catId    = searchParams.get('catId') ?? '';
  const sort     = searchParams.get('sort') ?? 'seeders';
  const page     = Number(searchParams.get('page') ?? '1');
  const fl       = searchParams.get('fl') === 'true';
  const hdr      = searchParams.get('hdr') === 'true';
  const internal = searchParams.get('internal') === 'true';
  const res      = searchParams.getAll('res');
  const src      = searchParams.getAll('src');
  const yr       = searchParams.getAll('yr');
  const viewMode = searchParams.get('view') ?? 'table';

  const [categories, setCategories] = useState<Category[]>([]);
  const [results, setResults]       = useState<TorrentRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [pages, setPages]           = useState(1);
  const [loading, setLoading]       = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; categoryIcon: string; categoryLabel: string }[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestIdx, setSuggestIdx]   = useState(-1);
  const [inputQ, setInputQ]           = useState(q);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>();

  const token = () => localStorage.getItem('access_token') ?? '';

  // Load category list once
  useEffect(() => {
    api.get<Category[]>('/api/categories', token()).then(setCategories).catch(() => {});
  }, []);

  // Fetch torrents whenever URL params change
  const fetchTorrents = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q)        p.set('q', q);
      if (catId)    p.set('catId', catId);
      if (sort)     p.set('sort', sort);
      p.set('page', String(page));
      if (fl)       p.set('fl', 'true');
      if (hdr)      p.set('hdr', 'true');
      if (internal) p.set('internal', 'true');
      res.forEach(r => p.append('res', r));
      src.forEach(s => p.append('src', s));
      yr.forEach(y  => p.append('yr', y));
      const data = await api.get<BrowseResponse>(`/api/torrents?${p}`, token());
      setResults(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTorrents(); }, [fetchTorrents]);

  // ── URL param helpers ──────────────────────────────────────────────────────

  function push(overrides: Record<string, string | string[] | undefined>) {
    const current: Record<string, string | string[] | undefined> = {};
    searchParams.forEach((v, k) => {
      const existing = current[k];
      if (existing !== undefined) current[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
      else current[k] = v;
    });
    const merged = { ...current, page: '1', ...overrides };
    const loc = locale === 'en' ? '' : `/${locale}`;
    router.push(`${loc}/browse?${buildParams(merged)}`);
  }

  function toggleMulti(key: string, value: string, current: string[]) {
    const next = current.includes(value) ? current.filter(x => x !== value) : [...current, value];
    push({ [key]: next.length > 0 ? next : undefined });
  }

  function clearAll() {
    const loc = locale === 'en' ? '' : `/${locale}`;
    router.push(`${loc}/browse`);
    setInputQ('');
  }

  // ── Search / autocomplete ──────────────────────────────────────────────────

  function onInputChange(v: string) {
    setInputQ(v);
    clearTimeout(suggestTimer.current);
    if (v.length < 2) { setSuggestions([]); setShowSuggest(false); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const rows = await api.get<{ name: string; categoryIcon: string; categoryLabel: string }[]>(
          `/api/torrents/suggest?q=${encodeURIComponent(v)}`,
          token()
        );
        setSuggestions(rows);
        setShowSuggest(rows.length > 0);
        setSuggestIdx(-1);
      } catch { /* ignore */ }
    }, 300);
  }

  function onSuggestKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { setSuggestIdx(i => Math.min(i + 1, suggestions.length - 1)); e.preventDefault(); }
    if (e.key === 'ArrowUp')   { setSuggestIdx(i => Math.max(i - 1, -1)); e.preventDefault(); }
    if (e.key === 'Escape')    { setShowSuggest(false); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const name = suggestIdx >= 0 ? suggestions[suggestIdx]?.name : inputQ;
      if (name) { setShowSuggest(false); push({ q: name }); }
    }
  }

  function selectSuggestion(name: string) {
    setInputQ(name);
    setShowSuggest(false);
    push({ q: name });
  }

  // ── Active pills ───────────────────────────────────────────────────────────

  const activePills: { label: string; clear: () => void }[] = [];
  if (q)        activePills.push({ label: `"${q}"`,    clear: () => push({ q: undefined }) });
  if (fl)       activePills.push({ label: 'Freeleech', clear: () => push({ fl: undefined }) });
  if (hdr)      activePills.push({ label: 'HDR',       clear: () => push({ hdr: undefined }) });
  if (internal) activePills.push({ label: 'Internal',  clear: () => push({ internal: undefined }) });
  res.forEach(r => activePills.push({ label: r,        clear: () => toggleMulti('res', r, res) }));
  src.forEach(s => activePills.push({ label: s,        clear: () => toggleMulti('src', s, src) }));
  yr.forEach(y  => activePills.push({ label: y,        clear: () => toggleMulti('yr', y, yr) }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-base)' }}>

      {/* Search bar */}
      <div className="px-6 pt-4 pb-2 relative z-20">
        <div className="relative max-w-2xl">
          <input
            className="w-full px-4 py-2 rounded border border-current/20 bg-transparent focus:outline-none focus:border-current/50 text-sm"
            placeholder="Search torrents…"
            value={inputQ}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={onSuggestKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
          />
          {showSuggest && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded border border-current/20 shadow-xl z-30 overflow-hidden"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={s.name}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-current/10 ${i === suggestIdx ? 'bg-current/10' : ''}`}
                  onMouseDown={() => selectSuggestion(s.name)}
                >
                  <span>{s.categoryIcon}</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-xs opacity-50">{s.categoryLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="px-6 pb-0 overflow-x-auto">
        <div className="flex items-center gap-1 border-b border-current/10 min-w-max">
          <button
            onClick={() => push({ catId: undefined })}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${!catId ? 'border-current' : 'border-transparent opacity-60 hover:opacity-100'}`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => push({ catId: String(c.id) })}
              style={{ borderColor: catId === String(c.id) ? c.color : 'transparent' }}
              className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors opacity-60 hover:opacity-100 data-[active=true]:opacity-100 flex items-center gap-1.5 whitespace-nowrap"
              data-active={catId === String(c.id)}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body: filter panel + results */}
      <div className="flex flex-1 overflow-hidden">

        {/* Filter sidebar */}
        <aside
          className="w-48 shrink-0 border-r border-current/10 p-4 space-y-5 overflow-y-auto text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={fl} onChange={() => push({ fl: fl ? undefined : 'true' })} className="accent-current" />
              Freeleech
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hdr} onChange={() => push({ hdr: hdr ? undefined : 'true' })} className="accent-current" />
              HDR
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={internal} onChange={() => push({ internal: internal ? undefined : 'true' })} className="accent-current" />
              Internal
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-2">Resolution</p>
            {RESOLUTIONS.map(r => (
              <label key={r} className="flex items-center gap-2 cursor-pointer py-0.5">
                <input type="checkbox" checked={res.includes(r)} onChange={() => toggleMulti('res', r, res)} className="accent-current" />
                {r}
              </label>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-2">Source</p>
            {SOURCES.map(s => (
              <label key={s} className="flex items-center gap-2 cursor-pointer py-0.5">
                <input type="checkbox" checked={src.includes(s)} onChange={() => toggleMulti('src', s, src)} className="accent-current" />
                {s}
              </label>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-2">Year</p>
            <div className="flex flex-wrap gap-1">
              {YEARS.map(y => (
                <button
                  key={y}
                  onClick={() => toggleMulti('yr', String(y), yr)}
                  className={`px-2 py-0.5 rounded text-xs border ${yr.includes(String(y)) ? 'border-current bg-current/10' : 'border-current/20'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {activePills.length > 0 && (
            <button onClick={clearAll} className="text-xs underline hover:no-underline">Clear all</button>
          )}
        </aside>

        {/* Results area */}
        <main className="flex-1 overflow-y-auto flex flex-col">

          {/* Results bar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-current/10 text-sm flex-wrap" style={{ color: 'var(--text-muted)' }}>
            <span>{loading ? '…' : `${total} results`}</span>

            {/* Active filter pills */}
            {activePills.map(p => (
              <button
                key={p.label}
                onClick={p.clear}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-current/20 hover:border-current/50"
              >
                {p.label} ×
              </button>
            ))}

            <div className="flex-1" />

            {/* Sort */}
            <select
              value={sort}
              onChange={e => push({ sort: e.target.value })}
              className="bg-transparent border border-current/20 rounded px-2 py-1 text-xs"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* View toggle */}
            <button onClick={() => push({ view: viewMode === 'table' ? 'card' : 'table' })} className="px-2 py-1 border border-current/20 rounded text-xs">
              {viewMode === 'table' ? '⊞' : '☰'}
            </button>
          </div>

          {/* Table view */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-current/10 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <th className="w-8 p-2 text-left">Cat</th>
                    {(['name', 'size', 'seeders', null, 'snatched', 'newest'] as const).map((sortKey, i) => {
                      const labels = ['Name', 'Size', 'Seeds', 'Leech', 'Snatched', 'Age'];
                      const aligns = ['text-left', 'text-right', 'text-right', 'text-right', 'text-right', 'text-right'];
                      const active = sortKey && sort === sortKey;
                      return sortKey ? (
                        <th key={i} className={`p-2 ${aligns[i]} cursor-pointer select-none whitespace-nowrap hover:opacity-100 ${active ? 'opacity-100' : 'opacity-60'}`}
                          onClick={() => push({ sort: sortKey })}>
                          {labels[i]}{active ? ' ↓' : ''}
                        </th>
                      ) : (
                        <th key={i} className={`p-2 ${aligns[i]} opacity-60`}>{labels[i]}</th>
                      );
                    })}
                    <th className="p-2 text-left opacity-60">Uploader</th>
                    <th className="p-2 text-center w-8 opacity-60">DL</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)}
                  {!loading && results.length === 0 && (
                    <tr><td colSpan={9}>
                      <EmptyState
                        icon="🔍"
                        title="No torrents found"
                        description="Try adjusting your filters or search query."
                        action={{ label: 'Clear filters', onClick: clearAll }}
                      />
                    </td></tr>
                  )}
                  {results.map(t => (
                    <tr key={t.id} className="border-b border-current/5 hover:bg-current/5">
                      <td className="p-2 text-center">
                        <span title={t.categoryLabel} style={{ color: t.categoryColor }}>{t.categoryIcon}</span>
                      </td>
                      <td className="p-2">
                        <Link href={`/torrent/${t.slug}`} className="hover:underline font-medium">
                          {t.name}
                        </Link>
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {t.freeleech && <span className="px-1 py-0 rounded text-[10px] bg-green-500/20 text-green-400 font-semibold">FREE</span>}
                          {t.hdr       && <span className="px-1 py-0 rounded text-[10px] bg-amber-500/20 text-amber-400 font-semibold">HDR</span>}
                          {t.internal  && <span className="px-1 py-0 rounded text-[10px] bg-purple-500/20 text-purple-400 font-semibold">INT</span>}
                          {t.resolution && <span className="px-1 py-0 rounded text-[10px] bg-blue-500/20 text-blue-400">{t.resolution}</span>}
                        </div>
                      </td>
                      <td className="p-2 text-right whitespace-nowrap opacity-70">{formatBytes(t.size)}</td>
                      <td className="p-2 text-right text-green-400">{t.seeders}</td>
                      <td className="p-2 text-right text-red-400">{t.leechers}</td>
                      <td className="p-2 text-right opacity-70">{t.snatched}</td>
                      <td className="p-2 text-right opacity-70 whitespace-nowrap">{relativeTime(t.uploadedAt)}</td>
                      <td className="p-2 opacity-70">
                        <Link href={`/user/${t.uploaderName}`} className="hover:underline">{t.uploaderName}</Link>
                      </td>
                      <td className="p-2 text-center">
                        <Link href={`/torrent/${t.slug}#download`} className="opacity-60 hover:opacity-100">↓</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Card view */}
          {viewMode === 'card' && (
            <div className="p-4 grid grid-cols-2 gap-4 flex-1">
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded border border-current/10 p-4 space-y-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <Skeleton height="h-3" width="w-24" />
                  <Skeleton height="h-4" width="w-full" />
                  <Skeleton height="h-3" width="w-3/4" />
                  <Skeleton height="h-3" width="w-1/2" />
                </div>
              ))}
              {!loading && results.length === 0 && (
                <div className="col-span-2">
                  <EmptyState icon="🔍" title="No torrents found" description="Try adjusting your filters." action={{ label: 'Clear filters', onClick: clearAll }} />
                </div>
              )}
              {results.map(t => (
                <Link
                  key={t.id}
                  href={`/torrent/${t.slug}`}
                  className="rounded border border-current/10 p-4 flex flex-col gap-2 hover:border-current/30 transition-colors"
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: t.categoryColor }}>{t.categoryIcon}</span>
                    <span className="text-xs opacity-50">{t.categoryLabel}</span>
                  </div>
                  <p className="font-medium text-sm line-clamp-2">{t.name}</p>
                  <div className="flex gap-1 flex-wrap">
                    {t.freeleech && <span className="px-1 rounded text-[10px] bg-green-500/20 text-green-400 font-semibold">FREE</span>}
                    {t.hdr       && <span className="px-1 rounded text-[10px] bg-amber-500/20 text-amber-400 font-semibold">HDR</span>}
                    {t.internal  && <span className="px-1 rounded text-[10px] bg-purple-500/20 text-purple-400 font-semibold">INT</span>}
                    {t.resolution && <span className="px-1 rounded text-[10px] bg-blue-500/20 text-blue-400">{t.resolution}</span>}
                  </div>
                  <div className="flex gap-3 text-xs opacity-60 mt-auto pt-2 border-t border-current/10">
                    <span className="text-green-400">▲ {t.seeders}</span>
                    <span>{formatBytes(t.size)}</span>
                    <span>{relativeTime(t.uploadedAt)}</span>
                    <span>{t.snatched} snatched</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-1 py-4 border-t border-current/10">
              <button
                disabled={page <= 1}
                onClick={() => push({ page: String(page - 1) })}
                className="px-3 py-1 rounded border border-current/20 text-sm disabled:opacity-30"
              >
                ←
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                let pg: number;
                if (pages <= 7) pg = i + 1;
                else if (page <= 4) pg = i + 1;
                else if (page >= pages - 3) pg = pages - 6 + i;
                else pg = page - 3 + i;
                return (
                  <button
                    key={pg}
                    onClick={() => push({ page: String(pg) })}
                    className={`px-3 py-1 rounded border text-sm ${pg === page ? 'border-current bg-current/10 font-semibold' : 'border-current/20 hover:border-current/40'}`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                disabled={page >= pages}
                onClick={() => push({ page: String(page + 1) })}
                className="px-3 py-1 rounded border border-current/20 text-sm disabled:opacity-30"
              >
                →
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
