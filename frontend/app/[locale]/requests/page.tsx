'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

interface Request {
  id: number; title: string; description: string | null;
  bounty_flux: number; is_filled: boolean; filled_torrent_id: number | null;
  created_at: string; username: string; category_name: string | null;
}

function formatBytes(b: number) {
  if (!b) return '0 FLX';
  return `${b.toLocaleString()} FLX`;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'0' | '1'>('0');
  const [fillId, setFillId] = useState<number | null>(null);
  const [torrentIdInput, setTorrentIdInput] = useState('');
  const [fillError, setFillError] = useState('');

  function getToken() { return localStorage.getItem('access_token') ?? ''; }

  function load(p: number, f: string) {
    api.get<{ requests: Request[]; page: number }>(
      `/api/requests?page=${p}&filled=${f}`,
      getToken(),
    ).then(d => { setRequests(d.requests); setPage(d.page); }).catch(() => {});
  }

  useEffect(() => load(1, filter), [filter]);

  async function fill() {
    if (!fillId) return;
    const torrentId = parseInt(torrentIdInput, 10);
    if (!torrentId) { setFillError('Enter a valid torrent ID'); return; }
    setFillError('');
    try {
      await api.post(`/api/requests/${fillId}/fill`, { torrent_id: torrentId }, getToken());
      setFillId(null);
      setTorrentIdInput('');
      load(page, filter);
    } catch (e) {
      setFillError(e instanceof ApiError ? e.message : 'Failed to fill request');
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Torrent Requests</h1>
        <Link href="/requests/new"
          className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90">
          + New Request
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        <button onClick={() => setFilter('0')}
          className={`px-3 py-1 rounded border border-current/20 ${filter === '0' ? 'bg-current/10' : 'hover:bg-current/5'}`}>
          Open
        </button>
        <button onClick={() => setFilter('1')}
          className={`px-3 py-1 rounded border border-current/20 ${filter === '1' ? 'bg-current/10' : 'hover:bg-current/5'}`}>
          Filled
        </button>
      </div>

      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="border border-current/10 rounded p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs opacity-50 mt-0.5">
                  by {r.username}
                  {r.category_name && ` · ${r.category_name}`}
                  {' · '}{new Date(r.created_at).toLocaleDateString()}
                </div>
                {r.description && (
                  <p className="text-sm opacity-70 mt-1 line-clamp-2">{r.description}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-right space-y-1">
                {r.bounty_flux > 0 && (
                  <div className="text-sm font-semibold text-[var(--color-accent)]">
                    {r.bounty_flux.toLocaleString()} FLX
                  </div>
                )}
                {r.is_filled ? (
                  r.filled_torrent_id ? (
                    <Link href={`/torrent/${r.filled_torrent_id}`}
                      className="text-xs text-green-500 hover:underline">Filled ✓</Link>
                  ) : (
                    <span className="text-xs text-green-500">Filled ✓</span>
                  )
                ) : (
                  <button onClick={() => { setFillId(r.id); setTorrentIdInput(''); setFillError(''); }}
                    className="text-xs px-2 py-0.5 border border-current/20 rounded hover:bg-current/5">
                    Fill
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="opacity-40 text-sm">No requests.</p>}
      </div>

      <div className="flex gap-2">
        {page > 1 && (
          <button onClick={() => load(page - 1, filter)}
            className="px-3 py-1 border border-current/20 rounded text-sm">Prev</button>
        )}
        <button onClick={() => load(page + 1, filter)}
          className="px-3 py-1 border border-current/20 rounded text-sm">Next</button>
      </div>

      {fillId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg)] border border-current/20 rounded-lg p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold">Fill Request</h2>
            <p className="text-sm opacity-70">Enter the torrent ID that fulfils this request.</p>
            <input
              type="number" value={torrentIdInput}
              onChange={e => setTorrentIdInput(e.target.value)}
              placeholder="Torrent ID"
              className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm"
            />
            {fillError && <p className="text-red-500 text-xs">{fillError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFillId(null)}
                className="px-4 py-2 rounded border border-current/20 text-sm">Cancel</button>
              <button onClick={fill}
                className="px-4 py-2 rounded bg-[var(--color-accent)] text-white text-sm">Fill</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
