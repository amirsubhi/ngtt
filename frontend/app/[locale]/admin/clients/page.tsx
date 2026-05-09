'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Client { id: number; peer_id_prefix: string; client_name: string; reason: string | null; added_by_username: string | null; created_at: string }

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ peer_id_prefix: '', client_name: '', reason: '' });

  function getToken() { return localStorage.getItem('access_token') ?? ''; }
  function load() {
    api.get<{ clients: Client[] }>('/api/admin/clients', getToken()).then(d => setClients(d.clients)).catch(() => {});
  }
  useEffect(load, []);

  async function add() {
    await api.post('/api/admin/clients', form, getToken());
    setForm({ peer_id_prefix: '', client_name: '', reason: '' });
    load();
  }

  async function remove(id: number) {
    await api.delete(`/api/admin/clients/${id}`, getToken());
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Banned Clients</h1>

      <div className="border border-current/10 rounded p-4 space-y-3 text-sm">
        <h2 className="font-semibold">Add Client</h2>
        <div className="flex flex-wrap gap-2">
          <input placeholder="Peer ID prefix (8 chars)" maxLength={8} value={form.peer_id_prefix}
            onChange={e => setForm(f => ({...f, peer_id_prefix: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 font-mono w-36" />
          <input placeholder="Client name" value={form.client_name}
            onChange={e => setForm(f => ({...f, client_name: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 flex-1" />
          <input placeholder="Reason (optional)" value={form.reason}
            onChange={e => setForm(f => ({...f, reason: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 flex-1" />
          <button onClick={add} className="px-4 py-1 rounded bg-[var(--color-accent)] text-white">Add</button>
        </div>
      </div>

      <div className="space-y-2">
        {clients.map(c => (
          <div key={c.id} className="border border-current/10 rounded p-3 flex items-center justify-between gap-4 text-sm">
            <div>
              <span className="font-mono text-xs bg-current/10 px-1.5 py-0.5 rounded mr-2">{c.peer_id_prefix}</span>
              <span className="font-medium">{c.client_name}</span>
              {c.reason && <span className="text-xs opacity-50 ml-2">{c.reason}</span>}
              <div className="text-xs opacity-40 mt-0.5">Added by {c.added_by_username ?? '—'} · {new Date(c.created_at).toLocaleDateString()}</div>
            </div>
            <button onClick={() => remove(c.id)} className="px-2 py-1 border border-red-500/30 text-red-500 rounded text-xs flex-shrink-0">Remove</button>
          </div>
        ))}
        {clients.length === 0 && <p className="opacity-40 text-sm">No banned clients.</p>}
      </div>
    </div>
  );
}
