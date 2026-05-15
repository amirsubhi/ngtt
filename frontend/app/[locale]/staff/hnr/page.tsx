'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface HnrRow { id: number; torrent_id: number; torrent_name: string; username: string; downloaded_at: string; seed_deadline_at: string; seeded_time_mins: number; status: string; pardon_reason: string | null }

const STATUS_COLOR: Record<string, string> = { active: 'text-yellow-500', resolved: 'text-green-500', pardoned: 'text-blue-500', expired: 'text-red-500' };

export default function StaffHnrPage() {
  const [hnr, setHnr] = useState<HnrRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [pardonId, setPardonId] = useState<number | null>(null);
  const [pardonReason, setPardonReason] = useState('');

  function getToken() { return localStorage.getItem('access_token') ?? ''; }
  function load() {
    api.get<{ hnr: HnrRow[] }>(`/api/staff/hnr?status=${statusFilter}`, getToken())
      .then(d => setHnr(d.hnr)).catch(() => {});
  }
  useEffect(load, [statusFilter]);

  async function pardon() {
    if (!pardonId || !pardonReason.trim()) return;
    await api.post(`/api/staff/hnr/${pardonId}/pardon`, { reason: pardonReason }, getToken());
    setPardonId(null);
    setPardonReason('');
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">H&R Management</h1>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-current/20 rounded bg-transparent px-2 py-1 text-sm">
          {['active','expired','resolved','pardoned'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {hnr.length === 0 && <p className="opacity-40 text-sm">No records.</p>}
      <div className="space-y-2">
        {hnr.map(h => (
          <div key={h.id} className="border border-current/10 rounded p-3 flex items-center justify-between gap-4 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex gap-2 items-center">
                <Link href={`/torrent/${h.torrent_id}`} className="font-medium hover:underline truncate">{h.torrent_name}</Link>
              </div>
              <div className="text-xs opacity-50 mt-0.5">
                {h.username} · seeded {h.seeded_time_mins}m · deadline {new Date(h.seed_deadline_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`text-xs ${STATUS_COLOR[h.status] ?? 'opacity-50'}`}>{h.status}</span>
              {(h.status === 'active' || h.status === 'expired') && (
                <button onClick={() => setPardonId(h.id)}
                  className="px-2 py-0.5 rounded border border-current/20 text-xs hover:bg-current/5">Pardon</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {pardonId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="border border-current/20 rounded-lg p-6 w-full max-w-md space-y-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <h2 className="font-semibold">Pardon H&R</h2>
            <textarea value={pardonReason} onChange={e => setPardonReason(e.target.value)} rows={3} placeholder="Reason for pardon…"
              className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPardonId(null)} className="px-4 py-2 rounded border border-current/20 text-sm">Cancel</button>
              <button onClick={pardon} className="px-4 py-2 rounded bg-[var(--color-accent)] text-white text-sm">Pardon</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
