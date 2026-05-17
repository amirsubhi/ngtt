'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

type Draft = {
  name: string;
  '--bg-base': string;
  '--bg-surface': string;
  '--bg-elevated': string;
  '--text-primary': string;
  '--text-muted': string;
  '--text-subtle': string;
  '--accent': string;
  '--accent-hover': string;
  '--border-focus': string;
  '--border': string;
  '--success': string;
  '--danger': string;
  '--warning': string;
};

const DEFAULTS: Draft = {
  name: 'My Theme',
  '--bg-base': '#0a0a0a',
  '--bg-surface': '#111111',
  '--bg-elevated': '#1a1a1a',
  '--accent': '#3b82f6',
  '--accent-hover': '#2563eb',
  '--text-primary': '#ededed',
  '--text-muted': '#737373',
  '--text-subtle': '#404040',
  '--border': '#222222',
  '--border-focus': '#3b82f6',
  '--success': '#22c55e',
  '--danger': '#ef4444',
  '--warning': '#f59e0b',
};

const SECTIONS: { title: string; items: { key: keyof Draft; label: string }[] }[] = [
  {
    title: 'Backgrounds',
    items: [
      { key: '--bg-base',     label: 'Page Background' },
      { key: '--bg-surface',  label: 'Card / Panel' },
      { key: '--bg-elevated', label: 'Dropdown / Modal' },
    ],
  },
  {
    title: 'Text',
    items: [
      { key: '--text-primary', label: 'Main Text' },
      { key: '--text-muted',   label: 'Secondary Text' },
      { key: '--text-subtle',  label: 'Subtle / Placeholder' },
    ],
  },
  {
    title: 'Accent',
    items: [
      { key: '--accent',       label: 'Accent Color' },
      { key: '--accent-hover', label: 'Accent Hover' },
      { key: '--border-focus', label: 'Focus Ring' },
    ],
  },
  {
    title: 'Borders',
    items: [
      { key: '--border', label: 'Border' },
    ],
  },
  {
    title: 'Status',
    items: [
      { key: '--success', label: 'Success' },
      { key: '--danger',  label: 'Danger / Error' },
      { key: '--warning', label: 'Warning' },
    ],
  },
];

function Preview({ draft }: { draft: Draft }) {
  return (
    <div
      className="rounded-lg border overflow-hidden text-sm"
      style={{ backgroundColor: draft['--bg-base'], borderColor: draft['--border'] }}
    >
      {/* Mini navbar */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b"
        style={{ backgroundColor: draft['--bg-surface'], borderColor: draft['--border'] }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: draft['--accent'] }}
        />
        <span className="font-semibold text-xs" style={{ color: draft['--text-primary'] }}>
          {draft.name || 'My Theme'}
        </span>
        <div className="flex gap-3 ml-auto">
          {['Browse', 'Forum', 'Upload'].map(l => (
            <span key={l} className="text-[11px]" style={{ color: draft['--text-muted'] }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Card */}
        <div
          className="rounded-lg p-3 border"
          style={{ backgroundColor: draft['--bg-surface'], borderColor: draft['--border'] }}
        >
          <p className="font-semibold text-xs mb-1" style={{ color: draft['--text-primary'] }}>
            Sample Card Title
          </p>
          <p className="text-[11px]" style={{ color: draft['--text-muted'] }}>
            This is how body text looks. Useful context appears here.
          </p>
          <p className="text-[10px] mt-1" style={{ color: draft['--text-subtle'] }}>
            Subtle metadata or timestamps show here.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              className="text-[11px] px-3 py-1 rounded font-medium"
              style={{ backgroundColor: draft['--accent'], color: '#fff' }}
            >
              Primary
            </button>
            <button
              className="text-[11px] px-3 py-1 rounded border"
              style={{ color: draft['--text-muted'], borderColor: draft['--border'] }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Dropdown preview */}
        <div
          className="rounded border p-2 text-[11px]"
          style={{ backgroundColor: draft['--bg-elevated'], borderColor: draft['--border'] }}
        >
          <p className="opacity-50 text-[10px] mb-1" style={{ color: draft['--text-muted'] }}>Dropdown / Modal surface</p>
          <p style={{ color: draft['--text-primary'] }}>Menu item — active</p>
          <p style={{ color: draft['--text-muted'] }}>Menu item — inactive</p>
        </div>

        {/* Status indicators */}
        <div className="flex gap-4 text-[11px] font-medium">
          <span style={{ color: draft['--success'] }}>● Success</span>
          <span style={{ color: draft['--warning'] }}>● Warning</span>
          <span style={{ color: draft['--danger'] }}>● Error</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminThemePage() {
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get<{ settings: Record<string, string> }>('/api/public/settings')
      .then(d => {
        const raw = d.settings.custom_theme;
        if (!raw || raw === 'null') return;
        try {
          const ct = JSON.parse(raw) as Partial<Draft>;
          if (ct && typeof ct === 'object') {
            setDraft(prev => ({ ...prev, ...ct }));
            setHasExisting(true);
          }
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, []);

  function set(key: keyof Draft, value: string) {
    setDraft(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const token = localStorage.getItem('access_token') ?? '';
    try {
      await api.put('/api/admin/settings', { key: 'custom_theme', value: JSON.stringify(draft) }, token);
      setSaved(true);
      setHasExisting(true);
      setToast('Theme saved — reload the page to see it applied');
      setTimeout(() => setToast(''), 4000);
    } catch {
      setToast('Failed to save');
      setTimeout(() => setToast(''), 3000);
    }
    setSaving(false);
  }

  async function disable() {
    if (!confirm('Remove the custom theme? Users who selected it will fall back to the default theme.')) return;
    const token = localStorage.getItem('access_token') ?? '';
    try {
      await api.put('/api/admin/settings', { key: 'custom_theme', value: 'null' }, token);
      setHasExisting(false);
      setSaved(false);
      setToast('Custom theme disabled');
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast('Failed to disable');
      setTimeout(() => setToast(''), 3000);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Theme Editor</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Design a custom theme for your site. Changes take effect on next page load.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasExisting && (
            <button
              onClick={disable}
              className="text-sm px-3 py-1.5 rounded border"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              Disable custom theme
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="text-sm px-4 py-1.5 rounded font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save theme'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          {/* Theme name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Theme Name
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Club Dark, Ocean Blue"
              maxLength={50}
              className="w-full rounded border border-current/20 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:border-current/40"
              style={{ color: 'var(--text-primary)' }}
            />
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
              Shown in the theme picker for all users.
            </p>
          </div>

          {/* Color sections */}
          {SECTIONS.map(({ title, items }) => (
            <div key={title} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-50" style={{ color: 'var(--text-muted)' }}>
                {title}
              </p>
              <div className="space-y-2">
                {items.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={draft[key]}
                      onChange={e => set(key, e.target.value)}
                      className="w-9 h-9 rounded cursor-pointer border border-current/20 p-0.5 bg-transparent shrink-0"
                      title={label}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>{draft[key]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-50" style={{ color: 'var(--text-muted)' }}>
            Live Preview
          </p>
          <Preview draft={draft} />
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            Preview updates as you change colors. Save to apply site-wide.
          </p>
        </div>
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
