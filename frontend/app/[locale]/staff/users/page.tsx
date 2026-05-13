'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface UserRow { id: number; username: string; email: string; is_banned: boolean; created_at: string; group_name: string; group_color: string }
interface UserDetail { user: UserRow & { uploaded: number; downloaded: number; ban_reason: string | null; group_id: number }; warnings: unknown[]; uploads: { id: number; name: string }[] }

function formatBytes(b: number) {
  const k = 1024, s = ['B','KB','MB','GB','TB'], i = Math.floor(Math.log(Math.max(b,1))/Math.log(k));
  return `${parseFloat((b/Math.pow(k,i)).toFixed(1))} ${s[i]}`;
}

export default function StaffUsersPage() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const [banReason, setBanReason] = useState('');
  const [showWarn, setShowWarn] = useState(false);
  const [showBan, setShowBan] = useState(false);

  function getToken() { return localStorage.getItem('access_token') ?? ''; }

  function search() {
    api.get<{ users: UserRow[] }>(`/api/staff/users?q=${encodeURIComponent(q)}`, getToken())
      .then(d => setUsers(d.users)).catch(() => {});
  }

  useEffect(search, []);

  async function loadUser(id: number) {
    const d = await api.get<UserDetail>(`/api/staff/users/${id}`, getToken());
    setSelected(d);
  }

  async function warn() {
    if (!selected || !warnReason.trim()) return;
    await api.post(`/api/staff/users/${selected.user.id}/warn`, { type: 'warning', reason: warnReason }, getToken());
    setShowWarn(false);
    setWarnReason('');
    loadUser(selected.user.id);
  }

  async function ban() {
    if (!selected || !banReason.trim()) return;
    await api.post(`/api/staff/users/${selected.user.id}/ban`, { reason: banReason }, getToken());
    setShowBan(false);
    setBanReason('');
    loadUser(selected.user.id);
  }

  async function unban() {
    if (!selected) return;
    await api.post(`/api/staff/users/${selected.user.id}/unban`, {}, getToken());
    loadUser(selected.user.id);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search username or email…"
          className="flex-1 border border-current/20 rounded bg-transparent px-3 py-2 text-sm" />
        <button onClick={search} className="px-4 py-2 rounded bg-[var(--color-accent)] text-white text-sm">Search</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1">
          {users.map(u => (
            <button key={u.id} onClick={() => loadUser(u.id)}
              className={`w-full text-left border border-current/10 rounded px-3 py-2 hover:bg-current/5 text-sm ${selected?.user.id === u.id ? 'bg-current/10' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{u.username}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${u.group_color}20`, color: u.group_color }}>{u.group_name}</span>
              </div>
              <div className="text-xs opacity-50 mt-0.5">{u.email}{u.is_banned && ' · 🚫 Banned'}</div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="border border-current/10 rounded p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{selected.user.username}</div>
                <div className="opacity-50 text-xs">{selected.user.email}</div>
              </div>
              {selected.user.is_banned && <span className="text-red-500 text-xs font-medium">BANNED</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs opacity-70">
              <div>Up: {formatBytes(selected.user.uploaded)}</div>
              <div>Down: {formatBytes(selected.user.downloaded)}</div>
              <div>Warnings: {(selected.warnings as unknown[]).length}</div>
              <div>Uploads: {selected.uploads.length}</div>
            </div>
            {selected.user.ban_reason && <p className="text-xs text-red-400">Ban reason: {selected.user.ban_reason}</p>}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowWarn(true)}
                className="px-3 py-1.5 rounded border border-yellow-500/30 text-yellow-500 text-xs hover:bg-yellow-500/10">Warn</button>
              {selected.user.is_banned
                ? <button onClick={unban} className="px-3 py-1.5 rounded border border-green-500/30 text-green-500 text-xs hover:bg-green-500/10">Unban</button>
                : <button onClick={() => setShowBan(true)} className="px-3 py-1.5 rounded border border-red-500/30 text-red-500 text-xs hover:bg-red-500/10">Ban</button>
              }
            </div>
          </div>
        )}
      </div>

      {showWarn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg)] border border-current/20 rounded-lg p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold">Issue Warning</h2>
            <textarea value={warnReason} onChange={e => setWarnReason(e.target.value)} rows={3} placeholder="Reason…"
              className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowWarn(false)} className="px-4 py-2 rounded border border-current/20 text-sm">Cancel</button>
              <button onClick={warn} className="px-4 py-2 rounded bg-yellow-600 text-white text-sm">Issue Warning</button>
            </div>
          </div>
        </div>
      )}

      {showBan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg)] border border-current/20 rounded-lg p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold">Ban User</h2>
            <textarea value={banReason} onChange={e => setBanReason(e.target.value)} rows={3} placeholder="Reason…"
              className="w-full border border-current/20 rounded bg-transparent px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBan(false)} className="px-4 py-2 rounded border border-current/20 text-sm">Cancel</button>
              <button onClick={ban} className="px-4 py-2 rounded bg-red-600 text-white text-sm">Ban</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
