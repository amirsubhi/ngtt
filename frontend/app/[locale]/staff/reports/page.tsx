'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Report { id: number; target_type: string; target_id: number; reason: string; status: string; reporter: string; created_at: string }

export default function StaffReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState('pending');

  function getToken() { return localStorage.getItem('access_token') ?? ''; }
  function load() {
    api.get<{ reports: Report[] }>(`/api/staff/reports?status=${filter}`, getToken())
      .then(d => setReports(d.reports)).catch(() => {});
  }
  useEffect(load, [filter]);

  async function action(id: number, act: 'resolve' | 'dismiss') {
    await api.post(`/api/staff/reports/${id}/${act}`, {}, getToken());
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-current/20 rounded bg-transparent px-2 py-1 text-sm">
          {['pending','resolved','dismissed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {reports.length === 0 && <p className="opacity-40 text-sm">No reports.</p>}
      <div className="space-y-2">
        {reports.map(r => (
          <div key={r.id} className="border border-current/10 rounded p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 text-sm">
              <div className="font-medium opacity-80">
                {r.target_type} #{r.target_id} — by {r.reporter}
              </div>
              <p className="opacity-60 mt-0.5 text-xs break-all">{r.reason}</p>
              <div className="opacity-40 text-xs mt-1">{new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            {r.status === 'pending' && (
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => action(r.id, 'resolve')}
                  className="px-3 py-1 rounded bg-green-600/20 text-green-500 text-xs hover:bg-green-600/30">Resolve</button>
                <button onClick={() => action(r.id, 'dismiss')}
                  className="px-3 py-1 rounded border border-current/20 text-xs hover:bg-current/5">Dismiss</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
