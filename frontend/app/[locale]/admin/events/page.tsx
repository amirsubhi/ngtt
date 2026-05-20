'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { EmptyState } from '@/components/EmptyState';

interface UploadEvent {
  id: number;
  name: string;
  type: 'double_upload' | 'freeleech_global';
  starts_at: string;
  ends_at: string;
  created_by_username: string;
}

const TYPE_LABEL: Record<string, string> = {
  double_upload:    '2× Upload',
  freeleech_global: 'Global Freeleech',
};

export default function AdminEventsPage() {
  const locale = useLocale();
  const router = useRouter();
  const [events, setEvents] = useState<UploadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  const [name, setName]         = useState('');
  const [type, setType]         = useState<'double_upload' | 'freeleech_global'>('double_upload');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt]     = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const tok = localStorage.getItem('access_token') ?? '';
    setToken(tok);
    if (!tok) { router.push(`/${locale}/login`); return; }
    load(tok);
  }, [router]);

  function load(tok: string) {
    setLoading(true);
    api.get<{ events: UploadEvent[] }>('/api/admin/events', tok)
      .then(d => setEvents(d.events))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/api/admin/events', {
        name,
        type,
        starts_at: new Date(startsAt).toISOString(),
        ends_at:   new Date(endsAt).toISOString(),
      }, token);
      setName(''); setStartsAt(''); setEndsAt('');
      load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create event');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this event?')) return;
    await api.delete(`/api/admin/events/${id}`, token).catch(() => {});
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  const now = new Date();
  const isActive = (ev: UploadEvent) => new Date(ev.starts_at) <= now && new Date(ev.ends_at) >= now;
  const isUpcoming = (ev: UploadEvent) => new Date(ev.starts_at) > now;

  const inputCls = 'w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30';
  const btnCls = 'rounded px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Upload Events</h1>

      {/* Create form */}
      <div className="rounded-lg border border-current/10 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Create Event</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} required maxLength={100} placeholder="Holiday Double Upload" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">Type</label>
              <select value={type} onChange={e => setType(e.target.value as typeof type)} className={inputCls}>
                <option value="double_upload">2× Upload (Double Upload)</option>
                <option value="freeleech_global">Global Freeleech</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium">Starts at</label>
              <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} required className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">Ends at</label>
              <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} required className={inputCls} />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className={btnCls} style={{ backgroundColor: 'var(--accent)' }}>
            {saving ? 'Creating…' : 'Create Event'}
          </button>
        </form>
      </div>

      {/* Event list */}
      {loading && <p className="opacity-50 text-sm">Loading…</p>}
      {!loading && events.length === 0 && (
        <EmptyState icon="📅" title="No events" description="Create an event above to run a double upload or global freeleech period." />
      )}
      {events.length > 0 && (
        <div className="space-y-2">
          {events.map(ev => {
            const active = isActive(ev);
            const upcoming = isUpcoming(ev);
            const status = active ? 'active' : upcoming ? 'upcoming' : 'ended';
            return (
              <div key={ev.id} className="flex items-center gap-4 rounded-lg border border-current/10 p-4">
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{ev.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      status === 'active' ? 'bg-green-500/20 text-green-400' :
                      status === 'upcoming' ? 'bg-blue-500/20 text-blue-400' : 'bg-current/10 opacity-50'
                    }`}>{status}</span>
                    <span className="text-xs opacity-50">{TYPE_LABEL[ev.type]}</span>
                  </div>
                  <p className="text-xs opacity-50">
                    {new Date(ev.starts_at).toLocaleString()} → {new Date(ev.ends_at).toLocaleString()} · by {ev.created_by_username}
                  </p>
                </div>
                <button onClick={() => handleDelete(ev.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40">
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
