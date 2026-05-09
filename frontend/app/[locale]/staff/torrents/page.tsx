'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface PendingTorrent {
  id: number; name: string; size: number; created_at: string;
  uploader: string; category: string;
}

function formatBytes(bytes: number): string {
  const k = 1024, sizes = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(Math.max(bytes,1)) / Math.log(k));
  return `${parseFloat((bytes/Math.pow(k,i)).toFixed(1))} ${sizes[i]}`;
}

export default function StaffTorrentsPage() {
  const [torrents, setTorrents] = useState<PendingTorrent[]>([]);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  function load() {
    const token = localStorage.getItem('access_token') ?? '';
    api.get<{ torrents: PendingTorrent[] }>('/api/staff/torrents/pending', token)
      .then(d => setTorrents(d.torrents)).catch(() => {});
  }

  useEffect(load, []);

  async function approve(id: number) {
    const token = localStorage.getItem('access_token') ?? '';
    await api.post(`/api/staff/torrents/${id}/approve`, {}, token);
    load();
  }

  async function reject() {
    if (!rejectId || !rejectReason.trim()) return;
    const token = localStorage.getItem('access_token') ?? '';
    await api.post(`/api/staff/torrents/${rejectId}/reject`, { reason: rejectReason }, token);
    setRejectId(null);
    setRejectReason('');
    load();
  }

  async function toggleFreeleech(id: number) {
    const token = localStorage.getItem('access_token') ?? '';
    await api.post(`/api/staff/torrents/${id}/freeleech`, {}, token);
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">Torrent Approval Queue</h1>
      {torrents.length === 0 && <p className="opacity-40 text-sm">No pending torrents.</p>}
      <div className="space-y-2">
        {torrents.map(t => (
          <div key={t.id} className="border border-current/10 rounded p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.name}</div>
              <div className="text-xs opacity-50 mt-0.5">
                {t.category} · {formatBytes(t.size)} · by {t.uploader} · {new Date(t.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => approve(t.id)}
                className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700">Approve</button>
              <button onClick={() => setRejectId(t.id)}
                className="px-3 py-1 rounded bg-red-600/20 text-red-500 text-xs hover:bg-red-600/30">Reject</button>
              <button onClick={() => toggleFreeleech(t.id)}
                className="px-3 py-1 rounded border border-current/20 text-xs hover:bg-current/5">FL</button>
            </div>
          </div>
        ))}
      </div>

      {rejectId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg)] border border-current/20 rounded-lg p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold">Reject Torrent</h2>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…" rows={3}
              className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRejectId(null)} className="px-4 py-2 rounded border border-current/20 text-sm">Cancel</button>
              <button onClick={reject} className="px-4 py-2 rounded bg-red-600 text-white text-sm">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
