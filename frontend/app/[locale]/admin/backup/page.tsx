'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Component = 'db' | 'uploads' | 'env';

interface BackupFile {
  name:       string;
  size:       number;
  created_at: string;
}

interface Progress {
  status: string;
  lines:  string[];
}

function getToken() { return localStorage.getItem('access_token') ?? ''; }
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

function formatBytes(n: number): string {
  if (n < 1024)    return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

const ALL_COMPONENTS: Component[] = ['db', 'uploads', 'env'];
const COMPONENT_LABELS: Record<Component, string> = {
  db:      'Database (MySQL)',
  uploads: 'Uploads directory',
  env:     '.env files ⚠ contains secrets',
};

export default function AdminBackupPage() {
  const [selected, setSelected]   = useState<Set<Component>>(new Set(ALL_COMPONENTS));
  const [running, setRunning]     = useState(false);
  const [progress, setProgress]   = useState<Progress | null>(null);
  const [backups, setBackups]     = useState<BackupFile[]>([]);
  const [error, setError]         = useState('');
  const [deleting, setDeleting]   = useState<string | null>(null);
  const pollingRef                = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef                    = useRef<HTMLPreElement>(null);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/backup/list', { headers: authHeaders() });
      if (res.ok) setBackups((await res.json() as { backups: BackupFile[] }).backups);
    } catch { /* ignore — stale list better than crash */ }
  }, []);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/backup/progress', { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json() as Progress;
      setProgress(data);
      if (data.status === 'done' || data.status === 'failed') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setRunning(false);
        void fetchList();
      }
    } catch { /* ignore */ }
  }, [fetchList]);

  // Initial data load
  useEffect(() => { void fetchList(); }, [fetchList]);

  // Detect in-progress backup on page load and start polling
  useEffect(() => {
    async function checkRunning() {
      try {
        const res = await fetch('/api/admin/backup/progress', { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json() as Progress;
        if (data.status === 'running') {
          setRunning(true);
          setProgress(data);
          void fetchProgress();
          pollingRef.current = setInterval(fetchProgress, 2000);
        }
      } catch { /* ignore */ }
    }
    void checkRunning();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchProgress]);

  // Auto-scroll log to bottom when new lines arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progress]);

  function toggleComponent(c: Component) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  async function handleStart() {
    if (running || selected.size === 0) return;
    setError('');
    setRunning(true);
    setProgress(null);

    try {
      const res = await fetch('/api/admin/backup/create', {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ components: [...selected] }),
      });

      if (res.status === 409) {
        const body = await res.json() as { message?: string };
        setError(body.message ?? 'Another operation is already running');
        setRunning(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        setError(body.message ?? 'Failed to start backup');
        setRunning(false);
        return;
      }

      pollingRef.current = setInterval(fetchProgress, 2000);
      void fetchProgress();
    } catch {
      setError('Network error — check server logs');
      setRunning(false);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    setDeleting(name);
    try {
      await fetch(`/api/admin/backup/${encodeURIComponent(name)}`, {
        method:  'DELETE',
        headers: authHeaders(),
      });
      void fetchList();
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  }

  async function handleDownload(name: string) {
    try {
      const res = await fetch(`/api/admin/backup/download/${encodeURIComponent(name)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Backup</h1>

      {/* Component selector */}
      <div className="border border-current/10 rounded p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest opacity-60">What to back up</h2>
        {ALL_COMPONENTS.map(c => (
          <label key={c} className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.has(c)}
              onChange={() => toggleComponent(c)}
              disabled={running}
              className="w-4 h-4"
            />
            <span className="text-sm">{COMPONENT_LABELS[c]}</span>
          </label>
        ))}
      </div>

      <button
        onClick={handleStart}
        disabled={running || selected.size === 0}
        className="px-4 py-2 rounded bg-[var(--color-accent)] text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? 'Backing up…' : 'Start Backup'}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Live log */}
      {(running || progress) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest opacity-60">Backup Log</h2>
            {progress?.status === 'running' && (
              <span className="text-xs opacity-50 animate-pulse">● running</span>
            )}
            {progress?.status === 'done'   && <span className="text-xs text-green-500">● done</span>}
            {progress?.status === 'failed' && <span className="text-xs text-red-500">● failed</span>}
          </div>
          <pre
            ref={logRef}
            className="text-xs font-mono bg-black/20 border border-current/10 rounded p-4 h-64 overflow-y-auto whitespace-pre-wrap"
          >
            {(progress?.lines ?? []).join('\n') || 'Starting…'}
          </pre>
        </div>
      )}

      {/* Existing backups */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest opacity-60">
            Existing Backups
          </h2>
          <button onClick={fetchList} className="text-xs opacity-50 hover:opacity-80 underline">
            Refresh
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="text-sm opacity-50">No backups yet.</p>
        ) : (
          <div className="space-y-2">
            {backups.map(b => (
              <div
                key={b.name}
                className="flex items-center justify-between gap-4 border border-current/10 rounded px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-mono truncate">{b.name}</div>
                  <div className="text-xs opacity-40">
                    {formatBytes(b.size)} · {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleDownload(b.name)}
                    className="px-3 py-1 rounded border border-current/20 text-xs hover:opacity-80"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(b.name)}
                    disabled={deleting === b.name}
                    className="px-3 py-1 rounded border border-red-500/40 text-xs text-red-500 hover:opacity-80 disabled:opacity-40"
                  >
                    {deleting === b.name ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
