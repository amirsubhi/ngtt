'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Notice { id: number; torrent_id: number | null; torrent_name: string | null; claimant_name: string; claimant_email: string; description: string; status: string; created_at: string }

export default function StaffDmcaPage() {
  const [notices, setNotices] = useState<Notice[]>([]);

  function getToken() { return localStorage.getItem('access_token') ?? ''; }
  function load() {
    api.get<{ notices: Notice[] }>('/api/staff/dmca', getToken())
      .then(d => setNotices(d.notices)).catch(() => {});
  }
  useEffect(load, []);

  async function action(id: number, act: 'action' | 'dismiss') {
    await api.post(`/api/staff/dmca/${id}/${act}`, {}, getToken());
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">DMCA Notices</h1>
      {notices.length === 0 && <p className="opacity-40 text-sm">No notices.</p>}
      <div className="space-y-3">
        {notices.map(n => (
          <div key={n.id} className="border border-current/10 rounded p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm">
                <div className="font-medium">{n.claimant_name} &lt;{n.claimant_email}&gt;</div>
                {n.torrent_name && <div className="opacity-60 text-xs">Torrent: {n.torrent_name}</div>}
                <p className="opacity-70 mt-1 text-xs">{n.description.slice(0, 300)}{n.description.length > 300 ? '…' : ''}</p>
                <div className="opacity-40 text-xs mt-1">{new Date(n.created_at).toLocaleDateString()} · {n.status}</div>
              </div>
              {n.status === 'pending' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => action(n.id, 'action')}
                    className="px-3 py-1 rounded bg-red-600/20 text-red-500 text-xs hover:bg-red-600/30">Take Down</button>
                  <button onClick={() => action(n.id, 'dismiss')}
                    className="px-3 py-1 rounded border border-current/20 text-xs hover:bg-current/5">Dismiss</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
