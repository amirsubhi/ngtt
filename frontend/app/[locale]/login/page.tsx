'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Turnstile } from '@/components/Turnstile';

interface LoginResponse {
  token?: string;
  requires_2fa?: boolean;
  user?: { id: number; username: string; group_id: number };
}

interface PublicSettings {
  captcha_on_login?: string;
  turnstile_site_key?: string;
  login_message?: string;
}

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [formLoadedAt] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>({});
  const [turnstileToken, setTurnstileToken] = useState('');

  const captchaEnabled = settings.captcha_on_login === 'true' && !!settings.turnstile_site_key;

  useEffect(() => {
    fetch('/api/settings/public')
      .then(r => r.json())
      .then((d: Record<string, string>) => setSettings(d))
      .catch(() => {});

    fetch('/api/public/settings')
      .then(r => r.json())
      .then((d: { settings: Record<string, string> }) => {
        if (d.settings?.login_message) setSettings(prev => ({ ...prev, login_message: d.settings.login_message }));
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (captchaEnabled && !turnstileToken) { setError('Please complete the security check'); return; }
    setError('');
    setLoading(true);
    try {
      const body: Record<string, unknown> = { email, password, form_loaded_at: formLoadedAt };
      if (requires2fa) body.totp_code = totpCode;
      if (turnstileToken) body.turnstile_response = turnstileToken;

      const res = await api.post<LoginResponse>('/api/auth/login', body);

      if (res.requires_2fa) {
        setRequires2fa(true);
        setLoading(false);
        return;
      }

      if (res.token) {
        localStorage.setItem('access_token', res.token);
        window.dispatchEvent(new Event('authchange'));
      }
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 423) setError(t('error_locked'));
        else if (err.code === 'FORBIDDEN') setError(t('error_banned'));
        else setError(t('error_invalid'));
      } else {
        setError(t('error_invalid'));
      }
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-center">{t('title')}</h1>

        {settings.login_message && (
          <p className="text-center text-sm opacity-70">{settings.login_message}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!requires2fa ? (
            <>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{t('email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium">{t('password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="block text-sm font-medium">{t('two_fa_label')}</label>
              <input
                type="text"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                autoFocus
                autoComplete="one-time-code"
                className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30"
              />
            </div>
          )}

          {captchaEnabled && !requires2fa && (
            <Turnstile
              siteKey={settings.turnstile_site_key!}
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
            />
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || (captchaEnabled && !turnstileToken && !requires2fa)}
            className="w-full rounded px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {loading ? '…' : t('submit')}
          </button>
        </form>

        <div className="flex justify-between text-sm opacity-70">
          <Link href="/forgot-password" className="hover:underline">{t('forgot')}</Link>
          <span>
            {t('no_account')}{' '}
            <Link href="/register" className="font-medium hover:underline">{t('register_link')}</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
