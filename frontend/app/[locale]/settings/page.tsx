'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { api, ApiError } from '@/lib/api';

const THEMES = ['void', 'pulse', 'cipher', 'nebula', 'ember', 'lumen', 'sand', 'cobalt'] as const;
type Theme = typeof THEMES[number];

const SWATCHES: Record<Theme, { bg: string; accent: string }> = {
  void:   { bg: '#111111', accent: '#3b82f6' },
  pulse:  { bg: '#181818', accent: '#06b6d4' },
  cipher: { bg: '#161b22', accent: '#10b981' },
  nebula: { bg: '#13131f', accent: '#8b5cf6' },
  ember:  { bg: '#1a1710', accent: '#f97316' },
  lumen:  { bg: '#f8fafc', accent: '#6366f1' },
  sand:   { bg: '#f3f0e8', accent: '#d97706' },
  cobalt: { bg: '#0c0760', accent: '#1800E7' },
};
const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '中文' },
  { value: 'es', label: 'Español' },
  { value: 'pt-BR', label: 'Português' },
  { value: 'ar', label: 'العربية' },
  { value: 'ms-MY', label: 'Bahasa Melayu' },
] as const;

type Tab = 'appearance' | 'privacy' | 'notifications' | 'security' | 'integrations' | 'danger';

interface Keys { passkey: string; api_key: string | null; api_enabled: boolean; rss_key: string }

interface Settings {
  theme: string;
  locale: string;
  browse_view: string;
  profile_private: boolean;
  show_online_status: boolean;
  hide_download_history: boolean;
  notify_hnr_warning: boolean;
  notify_ratio_low: boolean;
  notify_forum_reply: boolean;
  notify_pm_received: boolean;
  notify_promotion: boolean;
  email_hnr_warning: boolean;
  email_pm_received: boolean;
  email_staff_message: boolean;
  os_enabled: boolean;
  os_username: string | null;
  os_verified: boolean;
}

export default function SettingsPage() {
  const t = useTranslations('user.settings');
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>('appearance');
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [saved, setSaved] = useState(false);
  const [token, setToken] = useState('');

  // Username change state
  const [newUsername, setNewUsername] = useState('');
  const [usernamePassword, setUsernamePassword] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // OS state
  const [osApiKey, setOsApiKey] = useState('');
  const [osUsername, setOsUsername] = useState('');
  const [osPassword, setOsPassword] = useState('');
  const [osError, setOsError] = useState('');

  const [keys, setKeys] = useState<Keys | null>(null);
  const [keyLoading, setKeyLoading] = useState('');

  // Delete account
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token') ?? '';
    setToken(t);
    if (!t) { router.push('/login'); return; }
    api.get<Settings>('/api/users/me/settings', t)
      .then(s => setSettings(s))
      .catch(() => {});
    api.get<Keys>('/api/users/me/keys', t)
      .then(setKeys)
      .catch(() => {});
  }, [router]);

  async function save(partial: Partial<Settings>) {
    if (!token) return;
    if (partial.theme) setTheme(partial.theme);
    try {
      await api.put('/api/users/me/settings', partial, token);
      setSettings(prev => ({ ...prev, ...partial }));
      if (partial.locale) {
        const newLocale = partial.locale;
        const current = window.location.pathname;
        const hasPrefix = ['ms-MY', 'zh-CN', 'es', 'pt-BR', 'ar'].some(
          l => current.startsWith(`/${l}/`) || current === `/${l}`,
        );
        const stripped = hasPrefix ? current.replace(/^\/[^/]+/, '') || '/' : current;
        const newPath = newLocale === 'en' ? stripped : `/${newLocale}${stripped === '/' ? '' : stripped}`;
        window.location.href = newPath;
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  }

  async function handleUsernameChange(e: FormEvent) {
    e.preventDefault();
    setUsernameError('');
    try {
      await api.post('/api/users/me/username', { new_username: newUsername, password: usernamePassword }, token);
      setNewUsername('');
      setUsernamePassword('');
      alert(`Username changed to ${newUsername}`);
    } catch (err) {
      setUsernameError(err instanceof ApiError ? err.message : 'Failed');
    }
  }

  async function handleOsConnect(e: FormEvent) {
    e.preventDefault();
    setOsError('');
    try {
      const res = await api.post<{ username: string }>('/api/users/me/integrations/opensubtitles/verify', { api_key: osApiKey, username: osUsername, password: osPassword }, token);
      setSettings(prev => ({ ...prev, os_verified: true, os_enabled: true, os_username: res.username }));
      setOsApiKey(''); setOsPassword('');
    } catch (err) {
      setOsError(err instanceof ApiError ? err.message : 'Connection failed');
    }
  }

  async function handleOsDisconnect() {
    await api.post('/api/users/me/integrations/opensubtitles', {}, token).catch(() => {});
    setSettings(prev => ({ ...prev, os_verified: false, os_enabled: false, os_username: null }));
  }

  async function handleDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteError('');
    try {
      const res = await fetch('/api/users/me/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setDeleteError(body.message ?? 'Deletion failed. Check your password.');
        return;
      }
      localStorage.removeItem('access_token');
      router.push('/');
    } catch {
      setDeleteError('Deletion failed. Check your password.');
    }
  }

  const inputCls = 'w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30';
  const btnCls = 'rounded px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'appearance', label: t('tab_appearance') },
    { key: 'privacy', label: t('tab_privacy') },
    { key: 'notifications', label: t('tab_notifications') },
    { key: 'security', label: t('tab_security') },
    { key: 'integrations', label: t('tab_integrations') },
    { key: 'danger', label: t('tab_danger') },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight mb-6">{t('title')}</h1>

      {/* Tab bar */}
      <div className="border-b border-current/10 flex flex-wrap gap-1 mb-6">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-2 text-sm border-b-2 transition-colors"
            style={{
              borderBottomColor: tab === key ? 'var(--accent)' : 'transparent',
              opacity: tab === key ? 1 : 0.5,
            }}>
            {label}
          </button>
        ))}
      </div>

      {saved && <div className="mb-4 text-sm text-green-500">{t('saved')}</div>}

      {/* Appearance */}
      {tab === 'appearance' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('theme')}</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {THEMES.map(th => {
                const s = SWATCHES[th];
                const active = (theme ?? settings.theme) === th;
                return (
                  <button
                    key={th}
                    onClick={() => save({ theme: th })}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors hover:border-current/40"
                    style={{ borderColor: active ? s.accent : 'rgba(128,128,128,0.2)', background: active ? `${s.accent}18` : 'transparent' }}
                  >
                    <span
                      className="w-10 h-10 rounded-md overflow-hidden flex"
                      style={{ outline: active ? `2px solid ${s.accent}` : 'none', outlineOffset: '2px' }}
                    >
                      <span className="w-1/2 h-full" style={{ background: s.bg }} />
                      <span className="w-1/2 h-full" style={{ background: s.accent }} />
                    </span>
                    <span className="text-xs capitalize opacity-70 leading-none">{th}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('language')}</label>
            <select value={settings.locale ?? 'en'} onChange={e => save({ locale: e.target.value })} className={inputCls}>
              {LOCALES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('browse_view')}</label>
            <div className="flex gap-3">
              {(['table', 'card'] as const).map(v => (
                <button key={v} onClick={() => save({ browse_view: v })}
                  className="px-4 py-2 rounded border text-sm capitalize transition-colors"
                  style={{
                    borderColor: settings.browse_view === v ? 'var(--accent)' : 'rgba(128,128,128,0.2)',
                    backgroundColor: settings.browse_view === v ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                  }}>
                  {v === 'table' ? t('view_table') : t('view_card')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Privacy */}
      {tab === 'privacy' && (
        <div className="space-y-4">
          {([
            ['profile_private', t('profile_private')],
            ['show_online_status', t('show_online')],
            ['hide_download_history', t('hide_downloads')],
          ] as [keyof Settings, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={!!(settings as Record<string, unknown>)[key]}
                onChange={e => save({ [key]: e.target.checked })}
                className="w-4 h-4 rounded" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="space-y-4">
          <div className="space-y-3">
            {([
              ['notify_hnr_warning', 'H&R warnings'],
              ['notify_ratio_low', 'Low ratio alerts'],
              ['notify_forum_reply', 'Forum replies'],
              ['notify_pm_received', 'Private messages'],
              ['notify_promotion', 'Group promotions'],
            ] as [keyof Settings, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={!!(settings as Record<string, unknown>)[key]}
                  onChange={e => save({ [key]: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          <hr className="border-current/10" />
          <p className="text-sm font-medium opacity-60">Email notifications</p>
          {([
            ['email_hnr_warning', 'H&R warning emails'],
            ['email_pm_received', 'PM notification emails'],
            ['email_staff_message', 'Staff message emails'],
          ] as [keyof Settings, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={!!(settings as Record<string, unknown>)[key]}
                onChange={e => save({ [key]: e.target.checked })} className="w-4 h-4 rounded" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="space-y-8">
          {/* Passkey / Announce URL */}
          <div className="space-y-3 p-4 rounded border border-current/10">
            <h2 className="font-medium">Announce URL</h2>
            <p className="text-xs opacity-50">Use this URL in your torrent client. Keep it private.</p>
            {keys ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/announce/${keys.passkey}`} className={inputCls + ' font-mono text-xs'} />
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/announce/${keys.passkey}`)}
                    className="rounded border border-current/20 px-3 py-2 text-xs hover:border-current/40 shrink-0">Copy</button>
                </div>
                <button disabled={keyLoading === 'passkey'} onClick={async () => {
                  if (!confirm('Regenerate your announce URL? Your torrent client will stop seeding until you update it with the new URL.')) return;
                  setKeyLoading('passkey');
                  const res = await api.post<{ passkey: string }>('/api/users/me/keys/passkey', {}, token).catch(() => null);
                  if (res) setKeys(prev => prev ? { ...prev, passkey: res.passkey } : prev);
                  setKeyLoading('');
                }} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">
                  {keyLoading === 'passkey' ? 'Regenerating…' : 'Regenerate passkey'}
                </button>
              </div>
            ) : <p className="text-xs opacity-40">Loading…</p>}
          </div>

          {/* API Key */}
          <div className="space-y-3 p-4 rounded border border-current/10">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">API / Torznab Key</h2>
              {keys && (
                <button disabled={keyLoading === 'apitoggle'} onClick={async () => {
                  setKeyLoading('apitoggle');
                  const res = await api.post<{ api_enabled: boolean }>('/api/users/me/keys/api/toggle', {}, token).catch(() => null);
                  if (res) setKeys(prev => prev ? { ...prev, api_enabled: res.api_enabled } : prev);
                  setKeyLoading('');
                }} className={`text-xs px-2 py-1 rounded border ${keys.api_enabled ? 'border-green-500/40 text-green-400' : 'border-current/20 opacity-50'} hover:opacity-80 disabled:opacity-40`}>
                  {keys.api_enabled ? 'Enabled' : 'Disabled'}
                </button>
              )}
            </div>
            <p className="text-xs opacity-50">Used for Torznab feeds (autobrr, Prowlarr) and direct API access.</p>
            {keys ? (
              <div className="space-y-2">
                {keys.api_key ? (
                  <>
                    <div className="flex gap-2">
                      <input readOnly value={keys.api_key} className={inputCls + ' font-mono text-xs'} />
                      <button onClick={() => navigator.clipboard.writeText(keys.api_key!)}
                        className="rounded border border-current/20 px-3 py-2 text-xs hover:border-current/40 shrink-0">Copy</button>
                    </div>
                    <p className="text-xs opacity-40">Torznab URL: {typeof window !== 'undefined' ? window.location.origin : ''}/api/torznab?apikey={keys.api_key}</p>
                  </>
                ) : (
                  <p className="text-xs opacity-50">No API key generated yet.</p>
                )}
                <button disabled={keyLoading === 'api'} onClick={async () => {
                  setKeyLoading('api');
                  const res = await api.post<{ api_key: string; api_enabled: boolean }>('/api/users/me/keys/api', {}, token).catch(() => null);
                  if (res) setKeys(prev => prev ? { ...prev, api_key: res.api_key, api_enabled: res.api_enabled } : prev);
                  setKeyLoading('');
                }} className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50">
                  {keyLoading === 'api' ? 'Generating…' : keys.api_key ? 'Regenerate API key' : 'Generate API key'}
                </button>
              </div>
            ) : <p className="text-xs opacity-40">Loading…</p>}
          </div>

          {/* RSS Key */}
          <div className="space-y-3 p-4 rounded border border-current/10">
            <h2 className="font-medium">RSS Feed Key</h2>
            <p className="text-xs opacity-50">Authenticated RSS feed URL for your torrent client or reader.</p>
            {keys ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/rss/${keys.rss_key}`} className={inputCls + ' font-mono text-xs'} />
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/rss/${keys.rss_key}`)}
                    className="rounded border border-current/20 px-3 py-2 text-xs hover:border-current/40 shrink-0">Copy</button>
                </div>
                <button disabled={keyLoading === 'rss'} onClick={async () => {
                  setKeyLoading('rss');
                  const res = await api.post<{ rss_key: string }>('/api/users/me/keys/rss', {}, token).catch(() => null);
                  if (res) setKeys(prev => prev ? { ...prev, rss_key: res.rss_key } : prev);
                  setKeyLoading('');
                }} className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50">
                  {keyLoading === 'rss' ? 'Regenerating…' : 'Regenerate RSS key'}
                </button>
              </div>
            ) : <p className="text-xs opacity-40">Loading…</p>}
          </div>

          {/* Username change */}
          <div className="space-y-3 p-4 rounded border border-current/10">
            <h2 className="font-medium">{t('username_change_title')}</h2>
            <p className="text-sm opacity-50">{t('username_change_cost')}</p>
            <form onSubmit={handleUsernameChange} className="space-y-3">
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                placeholder={t('new_username')} required minLength={3} maxLength={50}
                pattern="[a-zA-Z0-9_-]+" className={inputCls} />
              <input type="password" value={usernamePassword} onChange={e => setUsernamePassword(e.target.value)}
                placeholder={t('confirm_password')} required className={inputCls} />
              {usernameError && <p className="text-sm text-red-500">{usernameError}</p>}
              <button type="submit" className={btnCls} style={{ backgroundColor: 'var(--accent)' }}>{t('change_username')}</button>
            </form>
          </div>
        </div>
      )}

      {/* Integrations */}
      {tab === 'integrations' && (
        <div className="space-y-6">
          <h2 className="font-medium">{t('os_title')}</h2>
          {settings.os_verified ? (
            <div className="space-y-3">
              <p className="text-sm text-green-500">{t('os_connected')} {settings.os_username}</p>
              <button onClick={handleOsDisconnect} className="rounded border border-red-500/40 text-red-500 px-4 py-2 text-sm hover:bg-red-500/10">
                {t('os_disconnect')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleOsConnect} className="space-y-3">
              <input type="text" value={osApiKey} onChange={e => setOsApiKey(e.target.value)}
                placeholder={t('os_api_key')} required className={inputCls} />
              <input type="text" value={osUsername} onChange={e => setOsUsername(e.target.value)}
                placeholder={t('os_username')} required className={inputCls} />
              <input type="password" value={osPassword} onChange={e => setOsPassword(e.target.value)}
                placeholder={t('os_password')} required className={inputCls} />
              {osError && <p className="text-sm text-red-500">{osError}</p>}
              <button type="submit" className={btnCls} style={{ backgroundColor: 'var(--accent)' }}>{t('os_connect')}</button>
            </form>
          )}
        </div>
      )}

      {/* Danger Zone */}
      {tab === 'danger' && (
        <div className="space-y-8">
          <div className="space-y-3 p-4 border border-current/10 rounded">
            <h2 className="font-medium">{t('export_data')}</h2>
            <a href="/api/users/me/export" download className={btnCls} style={{ display: 'inline-block', backgroundColor: 'var(--accent)' }}>
              {t('export_data')}
            </a>
          </div>
          <div className="space-y-3 p-4 border border-red-500/20 rounded">
            <h2 className="font-medium text-red-500">{t('delete_account')}</h2>
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                placeholder={t('delete_confirm')} required className={inputCls} />
              {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
              <button type="submit" className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                {t('delete_account')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
