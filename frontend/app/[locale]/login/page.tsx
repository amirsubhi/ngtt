'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface LoginResponse {
  token?: string;
  requires_2fa?: boolean;
  user?: { id: number; username: string; group_id: number };
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
  const [loginMessage, setLoginMessage] = useState('');

  useEffect(() => {
    fetch('/api/public/settings')
      .then(r => r.json())
      .then((d: { settings: Record<string, string> }) => setLoginMessage(d.settings.login_message ?? ''))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body: Record<string, unknown> = { email, password, form_loaded_at: formLoadedAt };
      if (requires2fa) body.totp_code = totpCode;

      const res = await api.post<LoginResponse>('/api/auth/login', body);

      if (res.requires_2fa) {
        setRequires2fa(true);
        setLoading(false);
        return;
      }

      if (res.token) {
        localStorage.setItem('access_token', res.token);
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">{t('title')}</h1>

        {loginMessage && (
          <p className="text-center text-sm opacity-70">{loginMessage}</p>
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

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
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
