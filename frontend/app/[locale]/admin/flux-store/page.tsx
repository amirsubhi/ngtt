'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface StoreItem { id: number; name: string; description: string | null; cost: number; type: string; value: number; is_active: boolean; display_order: number }

export default function AdminFluxStorePage() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [form, setForm] = useState({ name: '', description: '', cost: 100, type: 'invite_token', value: 1, display_order: 0 });

  function getToken() { return localStorage.getItem('access_token') ?? ''; }
  function load() {
    api.get<{ items: StoreItem[] }>('/api/admin/flux-store', getToken()).then(d => setItems(d.items)).catch(() => {});
  }
  useEffect(load, []);

  async function create() {
    await api.post('/api/admin/flux-store', form, getToken());
    setForm({ name: '', description: '', cost: 100, type: 'invite_token', value: 1, display_order: 0 });
    load();
  }

  async function toggle(item: StoreItem) {
    await api.put(`/api/admin/flux-store/${item.id}`, { is_active: !item.is_active }, getToken());
    load();
  }

  async function remove(id: number) {
    await api.delete(`/api/admin/flux-store/${id}`, getToken());
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Flux Store Items</h1>

      <div className="border border-current/10 rounded p-4 space-y-3 text-sm">
        <h2 className="text-lg font-semibold">Add Item</h2>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 col-span-2" />
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 col-span-2" />
          <input type="number" placeholder="Cost (FLX)" value={form.cost} onChange={e => setForm(f => ({...f, cost: +e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1" />
          <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1">
            {['invite_token','freeleech_token','upload_credit','username_change'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={create} className="px-4 py-2 rounded bg-[var(--color-accent)] text-white text-sm">Add Item</button>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className={`border border-current/10 rounded p-3 flex items-center justify-between gap-4 text-sm ${!item.is_active ? 'opacity-50' : ''}`}>
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-xs opacity-50">{item.type} · {item.cost} FLX</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggle(item)} className="px-2 py-1 border border-current/20 rounded text-xs hover:bg-current/5">
                {item.is_active ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => remove(item.id)} className="px-2 py-1 border border-red-500/30 text-red-500 rounded text-xs hover:bg-red-500/10">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
