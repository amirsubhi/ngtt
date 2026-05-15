'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Latest {
  tag:          string;
  name:         string;
  body:         string;
  published_at: string;
  url:          string;
}

interface UpdateStatus {
  configured: boolean;
  message?:   string;
  current?:   string;
  isLatest?:  boolean | null;
  status?:    'idle' | 'running' | 'done' | 'failed';
  latest?:    Latest | null;
}

interface Progress {
  status: string;
  lines:  string[];
}

function getToken() {
  return localStorage.getItem('access_token') ?? '';
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

export default function AdminUpdatePage() {
  const [info, setInfo]         = useState<UpdateStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError]       = useState('');
  const pollingRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef                  = useRef<HTMLPreElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/update/status', { headers: authHeaders() });
      if (!res.ok) {
        setLoadError(`API error ${res.status}: ${res.statusText}`);
        return;
      }
      setLoadError('');
      setInfo(await res.json() as UpdateStatus);
    } catch (err) {
      setLoadError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/update/progress', { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json() as Progress;
      setProgress(data);
      if (data.status === 'done' || data.status === 'failed') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setApplying(false);
        void fetchStatus();
      }
    } catch { /* network error */ }
  }, [fetchStatus]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // If an update is already running when the page loads, start polling
  useEffect(() => {
    if (info?.status === 'running' && !applying) {
      setApplying(true);
      void fetchProgress();
      pollingRef.current = setInterval(fetchProgress, 2000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [info?.status, fetchProgress]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll log to bottom when progress updates
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progress]);

  async function handleApply() {
    if (applying) return;
    if (!info?.latest) return;
    setError('');
    setApplying(true);
    setProgress(null);

    try {
      const res = await fetch('/api/admin/update/apply', {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ tag: info.latest.tag }),
      });

      if (res.status === 409) {
        setError('An update is already in progress.');
        setApplying(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        setError(body.message ?? 'Failed to start update');
        setApplying(false);
        return;
      }

      pollingRef.current = setInterval(fetchProgress, 2000);
      void fetchProgress();
    } catch {
      setError('Network error — update may or may not have started. Check server logs.');
      setApplying(false);
    }
  }

  if (!info) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight mb-6">System Update</h1>
        {loadError
          ? <p className="text-sm text-red-500">{loadError}</p>
          : <p className="opacity-50 text-sm">Loading...</p>
        }
      </div>
    );
  }

  if (!info.configured) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight mb-6">System Update</h1>
        <p className="text-sm opacity-70">
          {info.message ?? 'Set GITHUB_REPO=owner/repo in backend/.env to enable in-app updates.'}
        </p>
      </div>
    );
  }

  const isRunning = applying || info.status === 'running';
  const canApply  = !isRunning && info.isLatest === false && !!info.latest;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">System Update</h1>

      <div className="border border-current/10 rounded p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="opacity-50">Current version</span>
          <span className="font-mono">{info.current ?? '—'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="opacity-50">Latest release</span>
          <span className="font-mono">
            {info.latest ? (
              <a href={info.latest.url} target="_blank" rel="noreferrer" className="hover:underline">
                {info.latest.tag}
              </a>
            ) : '—'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="opacity-50">Status</span>
          <span>
            {info.isLatest === true  && <span className="text-green-500">Up to date</span>}
            {info.isLatest === false && <span className="text-yellow-500">Update available</span>}
            {info.isLatest === null  && <span className="opacity-50">GitHub unreachable</span>}
          </span>
        </div>
      </div>

      {info.latest?.body && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest opacity-60">Release Notes</h2>
          <pre className="text-xs opacity-70 whitespace-pre-wrap border border-current/10 rounded p-4 max-h-48 overflow-y-auto">
            {info.latest.body}
          </pre>
        </div>
      )}

      {canApply && (
        <div className="space-y-3">
          <p className="text-sm opacity-60">
            Runs: git checkout {info.latest!.tag} → npm ci → build → migrate → pm2 reload. The site stays
            up during the rolling PM2 restart. On any failure the script reverts to{' '}
            <code className="font-mono">{info.current}</code>.
          </p>
          <button
            onClick={handleApply}
            disabled={applying || !canApply}
            className="px-4 py-2 rounded text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Update to {info.latest!.tag}
          </button>
        </div>
      )}

      {info.isLatest === true && !isRunning && (
        <p className="text-sm text-green-500">You are running the latest release.</p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {(isRunning || progress) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest opacity-60">Update Log</h2>
            {isRunning && progress?.status === 'running' && (
              <span className="text-xs opacity-50 animate-pulse">● running</span>
            )}
            {progress?.status === 'done'   && <span className="text-xs text-green-500">● done</span>}
            {progress?.status === 'failed' && <span className="text-xs text-red-500">● failed</span>}
          </div>
          <pre
            ref={logRef}
            className="text-xs font-mono bg-black/20 border border-current/10 rounded p-4 h-64 overflow-y-auto whitespace-pre-wrap"
          >
            {(progress?.lines ?? []).join('\n') || 'Starting...'}
          </pre>
        </div>
      )}

      {!isRunning && (
        <button onClick={fetchStatus} className="text-xs opacity-50 hover:opacity-80 underline">
          Refresh status
        </button>
      )}
    </div>
  );
}
