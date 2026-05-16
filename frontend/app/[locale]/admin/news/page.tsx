'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface NewsItem {
  id: number;
  title: string;
  slug: string;
  is_pinned: boolean;
  published_at: string;
  author: string;
}

export default function AdminNewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function token() { return localStorage.getItem('access_token') ?? ''; }

  function load() {
    api.get<{ news: NewsItem[] }>('/api/news?page=1', token())
      .then(d => setItems(d.news))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return; }
    setSaving(true);
    try {
      await api.post('/api/news', { title, body, is_pinned: pinned }, token());
      setTitle(''); setBody(''); setPinned(false);
      load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to post news.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: number) {
    if (!confirm('Delete this news article?')) return;
    try {
      await api.delete(`/api/news/${id}`, token());
      setItems(prev => prev.filter(n => n.id !== id));
    } catch { /* no-op */ }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>News</h1>

      {/* Create form */}
      <form onSubmit={submit} className="space-y-4 rounded border border-current/10 p-5"
        style={{ backgroundColor: 'var(--bg-surface)' }}>
        <h2 className="text-sm font-semibold opacity-70">Post new article</h2>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-current/40"
          style={{ color: 'var(--text-primary)' }}
        />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Body (Markdown supported)"
          rows={6}
          className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-current/40 font-mono resize-y"
          style={{ color: 'var(--text-primary)' }}
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
          Pin this article (appears first)
        </label>
        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          {saving ? 'Posting…' : 'Publish'}
        </button>
      </form>

      {/* Article list */}
      <div className="rounded border border-current/10 overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <div className="px-4 py-3 border-b border-current/10 text-xs font-semibold opacity-50 uppercase tracking-widest">
          Published articles
        </div>
        {loading && <p className="p-4 text-sm opacity-40">Loading…</p>}
        {!loading && items.length === 0 && <p className="p-4 text-sm opacity-40">No articles yet.</p>}
        {items.map(n => (
          <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b border-current/5 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {n.is_pinned && <span className="me-1.5 text-[10px] opacity-60">📌</span>}
                {n.title}
              </p>
              <p className="text-xs mt-0.5 opacity-40">
                {n.author} · {new Date(n.published_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => deleteItem(n.id)}
              className="shrink-0 text-xs px-2 py-1 rounded border border-current/20 hover:border-red-500/40 hover:text-red-400 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
