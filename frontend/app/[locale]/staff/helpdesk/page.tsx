'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Ticket { id: number; subject: string; category: string; status: string; priority: string; username: string; created_at: string }
interface Reply { id: number; username: string; body: string; is_staff: boolean; created_at: string }
interface Detail { ticket: Ticket; replies: Reply[] }

export default function StaffHelpdeskPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [reply, setReply] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');

  function getToken() { return localStorage.getItem('access_token') ?? ''; }

  function loadTickets() {
    api.get<{ tickets: Ticket[] }>(`/api/staff/helpdesk/tickets?status=${statusFilter}`, getToken())
      .then(d => setTickets(d.tickets)).catch(() => {});
  }

  useEffect(loadTickets, [statusFilter]);

  async function loadDetail(id: number) {
    const d = await api.get<Detail>(`/api/staff/helpdesk/tickets/${id}`, getToken());
    setSelected(d);
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    await api.post(`/api/staff/helpdesk/tickets/${selected.ticket.id}/reply`, { body: reply }, getToken());
    setReply('');
    loadDetail(selected.ticket.id);
  }

  async function setStatus(status: string) {
    if (!selected) return;
    await api.post(`/api/staff/helpdesk/tickets/${selected.ticket.id}/status`, { status }, getToken());
    loadTickets();
    loadDetail(selected.ticket.id);
  }

  const PRIORITY_COLOR: Record<string, string> = { high: 'text-red-500', medium: 'text-yellow-500', low: 'opacity-50' };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Helpdesk</h1>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-current/20 rounded bg-transparent px-2 py-1 text-sm">
          {['open','in_progress','resolved','closed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1">
          {tickets.map(t => (
            <button key={t.id} onClick={() => loadDetail(t.id)}
              className={`w-full text-left border border-current/10 rounded px-3 py-2 hover:bg-current/5 text-sm ${selected?.ticket.id === t.id ? 'bg-current/10' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{t.subject}</span>
                <span className={`text-xs ml-2 ${PRIORITY_COLOR[t.priority] ?? ''}`}>{t.priority}</span>
              </div>
              <div className="text-xs opacity-50 mt-0.5">{t.username} · {t.category}</div>
            </button>
          ))}
          {tickets.length === 0 && <p className="opacity-40 text-sm">No tickets.</p>}
        </div>

        {selected && (
          <div className="border border-current/10 rounded p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{selected.ticket.subject}</div>
                <div className="text-xs opacity-50">{selected.ticket.username} · {selected.ticket.status}</div>
              </div>
              <div className="flex gap-1">
                {['open','in_progress','resolved','closed'].map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`text-xs px-2 py-0.5 rounded border border-current/20 hover:bg-current/5 ${selected.ticket.status===s ? 'bg-current/10' : ''}`}>
                    {s.replace('_',' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selected.replies.map(r => (
                <div key={r.id} className="text-sm rounded p-2"
                  style={{ backgroundColor: r.is_staff ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'rgba(128,128,128,0.07)' }}>
                  <div className="text-xs opacity-50 mb-1">{r.username} {r.is_staff && '(staff)'} · {new Date(r.created_at).toLocaleDateString()}</div>
                  <p className="whitespace-pre-wrap">{r.body}</p>
                </div>
              ))}
            </div>
            <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder="Reply…"
              className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm" />
            <button onClick={sendReply}
              className="px-4 py-2 rounded text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>Send Reply</button>
          </div>
        )}
      </div>
    </div>
  );
}
