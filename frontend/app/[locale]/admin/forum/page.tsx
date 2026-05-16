'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_staff_only: boolean;
  topic_count: number;
  post_count: number;
}

export default function AdminForumPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [desc, setDesc] = useState('');
  const [order, setOrder] = useState('0');
  const [staffOnly, setStaffOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<number | null>(null);

  function token() { return localStorage.getItem('access_token') ?? ''; }

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function load() {
    api.get<{ categories: Category[] }>('/api/admin/forum/categories', token())
      .then(d => setCats(d.categories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setDesc(cat.description ?? '');
    setOrder(String(cat.display_order));
    setStaffOnly(cat.is_staff_only);
    setError('');
  }

  function cancelEdit() {
    setEditId(null);
    setName(''); setSlug(''); setDesc(''); setOrder('0'); setStaffOnly(false); setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !slug.trim()) { setError('Name and slug are required.'); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { setError('Slug must be lowercase letters, numbers, and hyphens only.'); return; }
    setSaving(true);
    const payload = { name, slug, description: desc || undefined, display_order: parseInt(order) || 0, is_staff_only: staffOnly };
    try {
      if (editId) {
        await api.put(`/api/admin/forum/categories/${editId}`, payload, token());
      } else {
        await api.post('/api/admin/forum/categories', payload, token());
      }
      cancelEdit();
      load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: number) {
    if (!confirm('Delete this category? All topics and posts inside will also be deleted.')) return;
    try {
      await api.delete(`/api/admin/forum/categories/${id}`, token());
      setCats(prev => prev.filter(c => c.id !== id));
    } catch { /* no-op */ }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Forum Categories</h1>

      {/* Create / edit form */}
      <form onSubmit={submit} className="space-y-4 rounded border border-current/10 p-5"
        style={{ backgroundColor: 'var(--bg-surface)' }}>
        <h2 className="text-sm font-semibold opacity-70">{editId ? 'Edit category' : 'New category'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={name}
            onChange={e => { setName(e.target.value); if (!editId) setSlug(slugify(e.target.value)); }}
            placeholder="Name"
            className="rounded border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-current/40"
            style={{ color: 'var(--text-primary)' }}
          />
          <input
            value={slug}
            onChange={e => setSlug(slugify(e.target.value))}
            placeholder="slug"
            disabled={!!editId}
            className="rounded border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-current/40 font-mono disabled:opacity-40"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-current/40"
          style={{ color: 'var(--text-primary)' }}
        />
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <span>Order</span>
            <input
              type="number"
              value={order}
              onChange={e => setOrder(e.target.value)}
              className="w-16 rounded border border-current/20 bg-transparent px-2 py-1 text-sm outline-none focus:border-current/40 text-center"
              style={{ color: 'var(--text-primary)' }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={staffOnly} onChange={e => setStaffOnly(e.target.checked)} />
            Staff only
          </label>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Create'}
          </button>
          {editId && (
            <button type="button" onClick={cancelEdit}
              className="rounded px-4 py-2 text-sm border border-current/20"
              style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Category list */}
      <div className="rounded border border-current/10 overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <div className="px-4 py-3 border-b border-current/10 text-xs font-semibold opacity-50 uppercase tracking-widest">
          Categories
        </div>
        {loading && <p className="p-4 text-sm opacity-40">Loading…</p>}
        {!loading && cats.length === 0 && <p className="p-4 text-sm opacity-40">No categories yet.</p>}
        {cats.map(cat => (
          <div key={cat.id} className="flex items-center gap-3 px-4 py-3 border-b border-current/5 last:border-0">
            <div className="w-6 text-xs opacity-30 text-center font-mono">{cat.display_order}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {cat.name}
                {cat.is_staff_only && (
                  <span className="ms-2 text-[10px] px-1.5 py-0.5 rounded font-medium opacity-70"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>Staff</span>
                )}
              </p>
              <p className="text-xs opacity-40 font-mono">{cat.slug} · {cat.topic_count} topics · {cat.post_count} posts</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => startEdit(cat)}
                className="text-xs px-2 py-1 rounded border border-current/20 hover:border-current/40 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Edit
              </button>
              <button
                onClick={() => deleteCategory(cat.id)}
                className="text-xs px-2 py-1 rounded border border-current/20 hover:border-red-500/40 hover:text-red-400 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs opacity-40">
        Deleting a category permanently removes all topics and posts inside it.
        Staff-only categories are hidden from regular members.
      </p>
    </div>
  );
}
