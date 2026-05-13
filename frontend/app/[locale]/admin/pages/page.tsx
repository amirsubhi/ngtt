'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Page { id: number; title: string; slug: string; body: string; show_in_nav: boolean; is_published: boolean; display_order: number }

export default function AdminPagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [editing, setEditing] = useState<Page | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', body: '', show_in_nav: false, display_order: 0 });

  function getToken() { return localStorage.getItem('access_token') ?? ''; }
  function load() {
    api.get<{ pages: Page[] }>('/api/admin/pages', getToken()).then(d => setPages(d.pages)).catch(() => {});
  }
  useEffect(load, []);

  async function save() {
    if (editing) {
      await api.put(`/api/admin/pages/${editing.id}`, form, getToken());
    } else {
      await api.post('/api/admin/pages', form, getToken());
    }
    setEditing(null);
    setForm({ title: '', slug: '', body: '', show_in_nav: false, display_order: 0 });
    load();
  }

  async function remove(id: number) {
    await api.delete(`/api/admin/pages/${id}`, getToken());
    load();
  }

  function startEdit(p: Page) {
    setEditing(p);
    setForm({ title: p.title, slug: p.slug, body: p.body, show_in_nav: p.show_in_nav, display_order: p.display_order });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Custom Pages</h1>

      <div className="border border-current/10 rounded p-4 space-y-3 text-sm">
        <h2 className="text-lg font-semibold">{editing ? 'Edit Page' : 'New Page'}</h2>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Title" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 col-span-2" />
          <input placeholder="slug" value={form.slug} onChange={e => setForm(f => ({...f, slug: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1" />
          <input type="number" placeholder="Display order" value={form.display_order} onChange={e => setForm(f => ({...f, display_order: +e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1" />
        </div>
        <textarea placeholder="Body (markdown)" value={form.body} onChange={e => setForm(f => ({...f, body: e.target.value}))}
          rows={8} className="w-full border border-current/20 rounded bg-transparent px-2 py-1 font-mono text-xs" />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.show_in_nav} onChange={e => setForm(f => ({...f, show_in_nav: e.target.checked}))} />
            Show in nav
          </label>
          <div className="flex gap-2 ml-auto">
            {editing && <button onClick={() => { setEditing(null); setForm({ title:'', slug:'', body:'', show_in_nav: false, display_order: 0 }); }}
              className="px-4 py-2 rounded border border-current/20 text-sm">Cancel</button>}
            <button onClick={save} className="px-4 py-2 rounded bg-[var(--color-accent)] text-white text-sm">
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {pages.map(p => (
          <div key={p.id} className="border border-current/10 rounded p-3 flex items-center justify-between gap-4 text-sm">
            <div>
              <div className="font-medium">{p.title}</div>
              <div className="text-xs opacity-50">/{p.slug}{p.show_in_nav ? ' · nav' : ''}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(p)} className="px-2 py-1 border border-current/20 rounded text-xs">Edit</button>
              <button onClick={() => remove(p.id)} className="px-2 py-1 border border-red-500/30 text-red-500 rounded text-xs">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
