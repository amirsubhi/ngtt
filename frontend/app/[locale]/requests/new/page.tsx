'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface Category { id: number; name: string; slug: string }

export default function NewRequestPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: '', description: '', category_id: '', bounty_flux: '0',
  });
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    api.get<{ categories: Category[] }>('/api/admin/categories', token)
      .then(d => setCategories(d.categories)).catch(() => {});
    api.get<{ balance: number }>('/api/users/me/flux', token)
      .then(d => setBalance(d.balance)).catch(() => {});
  }, []);

  async function submit() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSubmitting(true);
    setError('');
    const token = localStorage.getItem('access_token') ?? '';
    try {
      await api.post('/api/requests', {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category_id: form.category_id ? parseInt(form.category_id, 10) : undefined,
        bounty_flux: parseFloat(form.bounty_flux) || 0,
      }, token);
      router.push('/requests');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">New Torrent Request</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="What are you looking for?"
            className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Provide more details, year, format preferences…" rows={4}
            className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm">
              <option value="">Any</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Bounty (FLX){balance !== null && <span className="opacity-50 ml-1">— you have {balance.toLocaleString()}</span>}
            </label>
            <input type="number" min="0" step="1" value={form.bounty_flux}
              onChange={e => setForm(f => ({ ...f, bounty_flux: e.target.value }))}
              className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm" />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button onClick={() => router.push('/requests')}
            className="px-4 py-2 rounded border border-current/20 text-sm">Cancel</button>
          <button onClick={submit} disabled={submitting}
            className="px-4 py-2 rounded text-white text-sm disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)' }}>
            {submitting ? 'Posting…' : 'Post Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
