'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Category { id: number; name: string; slug: string; icon: string | null; display_order: number; is_active: boolean }
interface Tag { id: number; name: string; slug: string; color: string; usage_count: number }

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [catForm, setCatForm] = useState({ name: '', slug: '', icon: '', display_order: 0 });
  const [tagForm, setTagForm] = useState({ name: '', slug: '', color: '#6366f1' });

  function getToken() { return localStorage.getItem('access_token') ?? ''; }
  function load() {
    const tok = getToken();
    api.get<{ categories: Category[] }>('/api/admin/categories', tok).then(d => setCategories(d.categories)).catch(() => {});
    api.get<{ tags: Tag[] }>('/api/admin/tags', tok).then(d => setTags(d.tags)).catch(() => {});
  }
  useEffect(load, []);

  async function addCategory() {
    await api.post('/api/admin/categories', catForm, getToken());
    setCatForm({ name:'', slug:'', icon:'', display_order: 0 });
    load();
  }
  async function deleteCategory(id: number) {
    await api.delete(`/api/admin/categories/${id}`, getToken());
    load();
  }
  async function toggleCategory(c: Category) {
    await api.put(`/api/admin/categories/${c.id}`, { is_active: !c.is_active }, getToken());
    load();
  }
  async function addTag() {
    await api.post('/api/admin/tags', tagForm, getToken());
    setTagForm({ name:'', slug:'', color:'#6366f1' });
    load();
  }
  async function deleteTag(id: number) {
    await api.delete(`/api/admin/tags/${id}`, getToken());
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">Categories & Tags</h1>

      <section className="space-y-3">
        <h2 className="font-semibold">Categories</h2>
        <div className="flex gap-2 text-sm flex-wrap">
          <input placeholder="Name" value={catForm.name} onChange={e => setCatForm(f => ({...f, name: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1" />
          <input placeholder="slug" value={catForm.slug} onChange={e => setCatForm(f => ({...f, slug: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1" />
          <input placeholder="Icon" value={catForm.icon} onChange={e => setCatForm(f => ({...f, icon: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 w-16" />
          <button onClick={addCategory} className="px-3 py-1 rounded bg-[var(--color-accent)] text-white">Add</button>
        </div>
        <div className="space-y-1">
          {categories.map(c => (
            <div key={c.id} className={`flex items-center justify-between border border-current/10 rounded px-3 py-2 text-sm ${!c.is_active ? 'opacity-40' : ''}`}>
              <span>{c.icon} {c.name} <span className="opacity-40 text-xs">/{c.slug}</span></span>
              <div className="flex gap-2">
                <button onClick={() => toggleCategory(c)} className="text-xs px-2 py-0.5 border border-current/20 rounded">
                  {c.is_active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => deleteCategory(c.id)} className="text-xs px-2 py-0.5 border border-red-500/30 text-red-500 rounded">Del</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Tags</h2>
        <div className="flex gap-2 text-sm flex-wrap items-center">
          <input placeholder="Name" value={tagForm.name} onChange={e => setTagForm(f => ({...f, name: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1" />
          <input placeholder="slug" value={tagForm.slug} onChange={e => setTagForm(f => ({...f, slug: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1" />
          <input type="color" value={tagForm.color} onChange={e => setTagForm(f => ({...f, color: e.target.value}))}
            className="w-10 h-8 rounded border border-current/20 cursor-pointer" />
          <button onClick={addTag} className="px-3 py-1 rounded bg-[var(--color-accent)] text-white">Add</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map(t => (
            <div key={t.id} className="flex items-center gap-1 text-xs rounded px-2 py-1"
              style={{ backgroundColor: `${t.color}20`, color: t.color }}>
              {t.name}
              <button onClick={() => deleteTag(t.id)} className="opacity-60 hover:opacity-100 ml-1">×</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
