'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface IpBan { id: number; ip_address: string; reason: string | null; banned_by_username: string | null; expires_at: string | null; created_at: string }

export default function AdminIpBansPage() {
  const [bans, setBans] = useState<IpBan[]>([]);
  const [form, setForm] = useState({ ip_address: '', reason: '', expires_at: '' });

  function getToken() { return localStorage.getItem('access_token') ?? ''; }
  function load() {
    api.get<{ bans: IpBan[] }>('/api/admin/ip-bans', getToken()).then(d => setBans(d.bans)).catch(() => {});
  }
  useEffect(load, []);

  async function add() {
    await api.post('/api/admin/ip-bans', {
      ip_address: form.ip_address,
      reason: form.reason || undefined,
      expires_at: form.expires_at || undefined,
    }, getToken());
    setForm({ ip_address: '', reason: '', expires_at: '' });
    load();
  }

  async function remove(id: number) {
    await api.delete(`/api/admin/ip-bans/${id}`, getToken());
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">IP Bans</h1>

      <div className="border border-current/10 rounded p-4 space-y-3 text-sm">
        <h2 className="font-semibold">Ban IP Address</h2>
        <div className="flex flex-wrap gap-2">
          <input placeholder="IP address" value={form.ip_address} onChange={e => setForm(f => ({...f, ip_address: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 font-mono w-40" />
          <input placeholder="Reason" value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 flex-1" />
          <input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({...f, expires_at: e.target.value}))}
            className="border border-current/20 rounded bg-transparent px-2 py-1 text-xs" />
          <button onClick={add} className="px-4 py-1 rounded bg-[var(--color-accent)] text-white">Ban</button>
        </div>
      </div>

      <div className="space-y-2">
        {bans.map(b => (
          <div key={b.id} className="border border-current/10 rounded p-3 flex items-center justify-between gap-4 text-sm">
            <div>
              <span className="font-mono font-medium">{b.ip_address}</span>
              {b.reason && <span className="text-xs opacity-50 ml-2">{b.reason}</span>}
              <div className="text-xs opacity-40 mt-0.5">
                {b.banned_by_username ?? '—'} · {new Date(b.created_at).toLocaleDateString()}
                {b.expires_at && ` · expires ${new Date(b.expires_at).toLocaleDateString()}`}
              </div>
            </div>
            <button onClick={() => remove(b.id)} className="px-2 py-1 border border-red-500/30 text-red-500 rounded text-xs flex-shrink-0">Remove</button>
          </div>
        ))}
        {bans.length === 0 && <p className="opacity-40 text-sm">No IP bans.</p>}
      </div>
    </div>
  );
}
