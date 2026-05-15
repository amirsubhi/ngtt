'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

interface Props {
  params: { token: string };
}

interface ValidateResponse {
  valid: boolean;
  email: string;
}

export default function RegisterWithInvitePage({ params }: Props) {
  const t = useTranslations('auth.register');
  const inviteToken = params.token;

  const [prefillEmail, setPrefillEmail] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoadedAt] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);

  useEffect(() => {
    api.get<ValidateResponse>(`/api/auth/validate-invite/${inviteToken}`)
      .then(res => {
        setInviteValid(true);
        setPrefillEmail(res.email);
        setEmail(res.email);
      })
      .catch(() => setInviteValid(false));
  }, [inviteToken]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        username, email, password,
        invite_token: inviteToken,
        form_loaded_at: formLoadedAt,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (inviteValid === null) {
    return <div className="flex min-h-screen items-center justify-center">Checking invite…</div>;
  }

  if (inviteValid === false) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium text-red-500">This invite link is invalid or has expired.</p>
          <Link href="/login" className="text-sm hover:underline opacity-70">{t('login_link')}</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">{t('success')}</p>
          <Link href="/login" className="text-sm hover:underline opacity-70">{t('login_link')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-center">{t('title')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">{t('username')}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required minLength={3} maxLength={50} pattern="[a-zA-Z0-9_-]+"
              className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">{t('email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              readOnly={!!prefillEmail}
              className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30 disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">{t('password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required minLength={8} maxLength={128}
              className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30"
            />
          </div>
          <input type="text" name="_hp" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {loading ? '…' : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
