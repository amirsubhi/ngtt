'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface LogRow { id: number; action: string; target_type: string | null; target_id: number | null; metadata: string | null; username: string | null; created_at: string }

export default function StaffLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [page, setPage] = useState(1);

  function load(p: number) {
    const token = localStorage.getItem('access_token') ?? '';
    api.get<{ logs: LogRow[]; page: number }>(`/api/staff/logs?page=${p}`, token)
      .then(d => { setLogs(d.logs); setPage(d.page); }).catch(() => {});
  }

  useEffect(() => load(1), []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left opacity-50 border-b border-current/10">
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Staff</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Target</th>
              <th className="py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b border-current/5">
                <td className="py-1.5 pr-4 opacity-50 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="py-1.5 pr-4 font-medium">{l.username ?? '—'}</td>
                <td className="py-1.5 pr-4 font-mono">{l.action}</td>
                <td className="py-1.5 pr-4 opacity-60">{l.target_type ? `${l.target_type}#${l.target_id}` : '—'}</td>
                <td className="py-1.5 opacity-40 font-mono max-w-xs truncate">{l.metadata ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        {page > 1 && <button onClick={() => load(page - 1)} className="px-3 py-1 border border-current/20 rounded text-sm">Prev</button>}
        <button onClick={() => load(page + 1)} className="px-3 py-1 border border-current/20 rounded text-sm">Next</button>
      </div>
    </div>
  );
}
