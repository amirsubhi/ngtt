'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Torrent {
  id: number;
  name: string;
  slug: string;
  category_name: string;
  size: number;
  seeders: number;
  leechers: number;
  is_freeleech: boolean;
  heat: string;
  created_at: string;
  uploader_username: string;
}

interface BrowseResponse {
  data: Torrent[];
  total: number;
  page: number;
  limit: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

const HEAT_COLORS: Record<string, string> = {
  dead: 'opacity-40',
  cold: 'text-blue-400',
  warm: 'text-green-400',
  hot: 'text-orange-400',
  burning: 'text-red-500 font-semibold',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function BrowsePage() {
  const t = useTranslations('torrent.browse');
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [freeleech, setFreeleech] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchTorrents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      if (categoryId) params.set('category_id', categoryId);
      if (freeleech) params.set('freeleech', 'true');

      const token = localStorage.getItem('access_token');
      const res = await api.get<BrowseResponse>(`/api/torrents?${params}`, token ?? undefined);
      setTorrents(res.data);
      setTotal(res.total);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, freeleech, page]);

  useEffect(() => {
    void fetchTorrents();
  }, [fetchTorrents]);

  useEffect(() => {
    api.get<Category[]>('/api/settings/categories').catch(() => []).then(cats => {
      if (Array.isArray(cats)) setCategories(cats);
    });
  }, []);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder={t('search_placeholder')}
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          className="rounded border border-current/20 bg-transparent px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-current/30"
        />
        <select
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setPage(1); }}
          className="rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">{t('filter_all')}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={freeleech} onChange={e => { setFreeleech(e.target.checked); setPage(1); }} />
          {t('filter_freeleech')}
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-current/10 text-left opacity-60">
              <th className="py-2 pr-4">{t('col_name')}</th>
              <th className="py-2 pr-4">{t('col_size')}</th>
              <th className="py-2 pr-2 text-center">{t('col_seeders')}</th>
              <th className="py-2 pr-4 text-center">{t('col_leechers')}</th>
              <th className="py-2">{t('col_added')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="py-8 text-center opacity-50">Loading…</td></tr>
            )}
            {!loading && torrents.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center opacity-50">{t('no_results')}</td></tr>
            )}
            {torrents.map(t => (
              <tr key={t.id} className="border-b border-current/5 hover:bg-current/5 transition-colors">
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    {t.is_freeleech && (
                      <span className="text-xs bg-green-500/20 text-green-500 px-1 rounded">FL</span>
                    )}
                    <Link href={`/torrent/${t.id}`} className="hover:underline line-clamp-1">
                      {t.name}
                    </Link>
                  </div>
                  <div className="text-xs opacity-40">{t.category_name}</div>
                </td>
                <td className="py-2 pr-4 whitespace-nowrap opacity-70">{formatBytes(t.size)}</td>
                <td className={`py-2 pr-2 text-center ${HEAT_COLORS[t.heat] ?? ''}`}>{t.seeders}</td>
                <td className="py-2 pr-4 text-center opacity-60">{t.leechers}</td>
                <td className="py-2 whitespace-nowrap opacity-50 text-xs">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 items-center justify-center">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border border-current/20 text-sm disabled:opacity-30"
          >
            ←
          </button>
          <span className="text-sm opacity-60">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border border-current/20 text-sm disabled:opacity-30"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
