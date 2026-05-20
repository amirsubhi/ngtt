'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { TABS, JSON_KEYS, WORDLIST_KEYS, type Setting, type Tab } from './categories';
import { SettingField } from './SettingField';

export default function AdminSettingsPage() {
  const locale = useLocale();
  const router = useRouter();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [server, setServer] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    api.get<{ settings: Setting[] }>('/api/admin/settings', token)
      .then(d => {
        const map: Record<string, string> = {};
        for (const s of d.settings) map[s.key] = s.value;
        setSettings(d.settings);
        setServer(map);
      }).catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) router.push(`/${locale}/login`);
      });
  }, []);

  const grouped: Record<string, Setting[]> = {};
  for (const s of settings) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }

  const tabSettings = grouped[activeTab] ?? [];
  const dirtyKeys = tabSettings
    .map(s => s.key)
    .filter(k => drafts[k] !== undefined && drafts[k] !== server[k]);
  const hasDirty = dirtyKeys.length > 0;

  function onChange(key: string, value: string) {
    setDrafts(prev => ({ ...prev, [key]: value }));
    if (jsonErrors[key]) setJsonErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  async function uploadImage(key: string, file: File) {
    const token = localStorage.getItem('access_token') ?? '';
    const endpoint = key === 'site_logo_url' ? '/api/admin/upload/logo' : '/api/admin/upload/favicon';
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) return;
    const data = await res.json() as { url: string };
    setServer(prev => ({ ...prev, [key]: data.url }));
    setToast('Image saved');
    setTimeout(() => setToast(''), 3000);
  }

  async function applyDefaults() {
    if (!confirm("This will override every user's theme and language preference with the current site defaults. Continue?")) return;
    setApplying(true);
    const token = localStorage.getItem('access_token') ?? '';
    try {
      await api.post('/api/admin/settings/apply-defaults', {}, token);
      setToast('Applied to all users');
    } catch {
      setToast('Failed to apply');
    }
    setApplying(false);
    setTimeout(() => setToast(''), 3000);
  }

  async function saveTab() {
    const newErrors: Record<string, string> = {};
    for (const k of dirtyKeys) {
      if (JSON_KEYS.has(k) && !WORDLIST_KEYS.has(k)) {
        try { JSON.parse(drafts[k]); } catch { newErrors[k] = 'Invalid JSON'; }
      }
    }
    if (Object.keys(newErrors).length) { setJsonErrors(newErrors); return; }
    setJsonErrors({});
    setSaving(true);
    const token = localStorage.getItem('access_token') ?? '';
    const snapshot = { ...drafts };
    const results = await Promise.allSettled(
      dirtyKeys.map(key => api.put('/api/admin/settings', { key, value: snapshot[key] }, token))
    );
    const failed: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        setServer(prev => ({ ...prev, [dirtyKeys[i]]: snapshot[dirtyKeys[i]] }));
        setDrafts(prev => { const n = { ...prev }; delete n[dirtyKeys[i]]; return n; });
      } else {
        failed.push(dirtyKeys[i]);
      }
    });
    setSaving(false);
    setToast(failed.length ? `${failed.length} field(s) failed to save` : 'Saved');
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        Site Settings
      </h1>

      <div className="border-b border-current/10 flex flex-wrap gap-1 mb-8">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setJsonErrors({}); }}
            className="px-4 py-2 text-sm transition-colors border-b-2 -mb-px"
            style={{
              borderBottomColor: activeTab === key ? 'var(--accent)' : 'transparent',
              color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
              opacity: grouped[key] ? 1 : 0.3,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {tabSettings.map(s => (
          <SettingField
            key={s.key}
            setting={s}
            value={drafts[s.key] ?? server[s.key] ?? ''}
            onChange={onChange}
            onUpload={uploadImage}
            error={jsonErrors[s.key]}
          />
        ))}
      </div>

      {activeTab === 'general' && (
        <div
          className="rounded border border-current/10 p-4 space-y-2 mt-6"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Apply defaults to all users
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Overrides every user&apos;s theme and language preference with the current Default Theme and Default Language settings above.
          </p>
          <button
            onClick={applyDefaults}
            disabled={applying}
            className="text-sm px-3 py-1.5 rounded border disabled:opacity-50"
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {applying ? 'Applying…' : 'Apply to all users'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-current/10 mt-8">
        <span
          className="text-xs"
          style={{ color: 'var(--text-muted)', visibility: hasDirty ? 'visible' : 'hidden' }}
        >
          {dirtyKeys.length} unsaved change{dirtyKeys.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={saveTab}
          disabled={!hasDirty || saving}
          className="px-4 py-2 rounded text-sm font-medium disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      {toast && (
        <div
          className="fixed bottom-4 end-4 z-50 rounded border border-current/20 px-4 py-2 text-sm shadow-lg"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
