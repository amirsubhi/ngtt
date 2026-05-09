'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { api, ApiError } from '@/lib/api';

const THEMES = ['void', 'pulse', 'cipher', 'nebula', 'ember', 'lumen', 'sand'] as const;
const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '中文' },
  { value: 'es', label: 'Español' },
  { value: 'pt-BR', label: 'Português' },
  { value: 'ar', label: 'العربية' },
  { value: 'ms-MY', label: 'Bahasa Melayu' },
] as const;

type Tab = 'appearance' | 'privacy' | 'notifications' | 'security' | 'integrations' | 'danger';

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
  }, [router]);

  async function save(partial: Partial<Settings>) {
    if (!token) return;
    if (partial.theme) setTheme(partial.theme);
    try {
      await api.post('/api/users/me/settings', partial, token);
      setSettings(prev => ({ ...prev, ...partial }));
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
      await fetch('/api/users/me/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: deletePassword }),
      });
      localStorage.removeItem('access_token');
      router.push('/');
    } catch {
      setDeleteError('Deletion failed. Check your password.');
    }
  }

  const inputCls = 'w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30';
  const btnCls = 'rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

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
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {/* Tab bar */}
      <div className="border-b border-current/10 flex flex-wrap gap-1 mb-6">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === key ? 'border-[var(--color-accent)]' : 'border-transparent opacity-50 hover:opacity-70'}`}>
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
            <div className="flex flex-wrap gap-2">
              {THEMES.map(th => (
                <button key={th} onClick={() => save({ theme: th })}
                  className={`px-4 py-2 rounded border text-sm capitalize transition-colors ${(theme ?? settings.theme) === th ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-current/20 hover:border-current/40'}`}>
                  {th}
                </button>
              ))}
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
                  className={`px-4 py-2 rounded border text-sm capitalize ${settings.browse_view === v ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-current/20'}`}>
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
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-medium">{t('username_change_title')}</h2>
            <p className="text-sm opacity-50">{t('username_change_cost')}</p>
            <form onSubmit={handleUsernameChange} className="space-y-3">
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                placeholder={t('new_username')} required minLength={3} maxLength={50}
                pattern="[a-zA-Z0-9_-]+" className={inputCls} />
              <input type="password" value={usernamePassword} onChange={e => setUsernamePassword(e.target.value)}
                placeholder={t('confirm_password')} required className={inputCls} />
              {usernameError && <p className="text-sm text-red-500">{usernameError}</p>}
              <button type="submit" className={btnCls}>{t('change_username')}</button>
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
              <button type="submit" className={btnCls}>{t('os_connect')}</button>
            </form>
          )}
        </div>
      )}

      {/* Danger Zone */}
      {tab === 'danger' && (
        <div className="space-y-8">
          <div className="space-y-3 p-4 border border-current/10 rounded">
            <h2 className="font-medium">{t('export_data')}</h2>
            <a href="/api/users/me/export" download className={btnCls} style={{ display: 'inline-block' }}>
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
