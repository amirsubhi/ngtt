'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Setting { key: string; value: string; type: string; category: string; label: string }

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    api.get<{ settings: Setting[] }>('/api/admin/settings', token)
      .then(d => setSettings(d.settings)).catch(() => {});
  }, []);

  async function save(key: string, value: string) {
    const token = localStorage.getItem('access_token') ?? '';
    await api.put('/api/admin/settings', { key, value }, token);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  async function uploadImage(key: string, file: File) {
    const token = localStorage.getItem('access_token') ?? '';
    const endpoint = key === 'site_logo_url' ? '/api/admin/upload/logo' : '/api/admin/upload/favicon';
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    if (!res.ok) return;
    const data = await res.json() as { url: string };
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: data.url } : s));
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  function handleChange(key: string, value: string) {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
  }

  const grouped: Record<string, Setting[]> = {};
  for (const s of settings) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">Admin Settings</h1>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider opacity-50">{cat}</h2>
          <div className="space-y-2">
            {items.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-4 border border-current/10 rounded px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs opacity-40 font-mono">{s.key}</div>
                </div>
                <div className="flex items-center gap-2">
                  {s.type === 'bool' ? (
                    <select value={s.value} onChange={e => handleChange(s.key, e.target.value)}
                      className="border border-current/20 rounded bg-transparent px-2 py-1 text-sm">
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (s.key === 'site_logo_url' || s.key === 'site_favicon_url') ? (
                    <input type="file" accept="image/png,image/jpeg,image/webp"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(s.key, f); }}
                      className="text-xs w-40" />
                  ) : (
                    <input type={s.type === 'int' ? 'number' : 'text'} value={s.value}
                      onChange={e => handleChange(s.key, e.target.value)}
                      className="border border-current/20 rounded bg-transparent px-2 py-1 text-sm w-32" />
                  )}
                  <button onClick={() => save(s.key, s.value)}
                    className="px-3 py-1 rounded bg-[var(--color-accent)] text-white text-xs">
                    {saved === s.key ? '✓' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
