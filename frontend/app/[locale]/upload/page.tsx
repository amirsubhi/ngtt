'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';

interface Category { id: number; label: string; slug: string }

export default function UploadPage() {
  const t = useTranslations('torrent.upload');
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [nfo, setNfo] = useState('');
  const [tmdbId, setTmdbId] = useState('');
  const [imdbId, setImdbId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    fetch('/api/settings/categories', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then((cats: unknown) => { if (Array.isArray(cats)) setCategories(cats as Category[]); })
      .catch(() => {});
  }, []);

  // Pre-fill name from torrent filename
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name) {
      setName(f.name.replace(/\.torrent$/i, '').replace(/[._]/g, ' ').trim());
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) { setError('Please select a torrent file'); return; }
    if (!categoryId) { setError('Please select a category'); return; }

    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }

    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name);
      form.append('description', description);
      form.append('category_id', categoryId);
      if (tags) {
        tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => form.append('tags', tag));
      }
      if (nfo) form.append('nfo_content', nfo);
      if (tmdbId) form.append('tmdb_id', tmdbId);
      if (imdbId) form.append('imdb_id', imdbId);

      const res = await fetch('/api/torrents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? 'Upload failed');
      }

      const data = await res.json() as { id: number; status: string };
      setDone(true);
      if (data.status === 'approved') {
        setTimeout(() => router.push(`/torrent/${data.id}`), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium text-green-500">{t('success')}</p>
          <p className="text-sm opacity-60">Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-6">{t('title')}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium">{t('file_label')}</label>
          <input
            type="file"
            accept=".torrent,application/x-bittorrent"
            onChange={handleFileChange}
            required
            className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-1 file:text-white file:text-sm cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">{t('name')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required maxLength={500}
            className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">{t('category')}</label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            required
            className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">— Select —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">{t('description')}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4} maxLength={10000}
            className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">{t('tags')}</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="action, 1080p, x265"
            className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30"
          />
        </div>

        {/* Advanced section — metadata + NFO */}
        <div className="border border-current/10 rounded">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-current/5 rounded"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>Advanced (TMDB/IMDB IDs, NFO)</span>
            <span className="text-xs">{showAdvanced ? '▲' : '▼'}</span>
          </button>
          {showAdvanced && (
            <div className="px-4 pb-4 space-y-4 border-t border-current/10 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium">{t('tmdb_id')}</label>
                  <input
                    type="number"
                    value={tmdbId}
                    onChange={e => setTmdbId(e.target.value)}
                    className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium">{t('imdb_id')}</label>
                  <input
                    type="text"
                    value={imdbId}
                    onChange={e => setImdbId(e.target.value)}
                    placeholder="tt1234567"
                    className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{t('nfo')}</label>
                <textarea
                  value={nfo}
                  onChange={e => setNfo(e.target.value)}
                  rows={8} maxLength={500000}
                  className="w-full rounded border border-current/20 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none"
                  placeholder="Paste NFO content here…"
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? '…' : t('submit')}
        </button>
      </form>
    </div>
  );
}
