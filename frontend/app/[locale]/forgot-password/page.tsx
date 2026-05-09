'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgot');

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setLoading(false);
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-base">{t('success')}</p>
          <Link href="/login" className="text-sm hover:underline opacity-70">{t('back_login')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">{t('title')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? '…' : t('submit')}
          </button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-sm hover:underline opacity-70">{t('back_login')}</Link>
        </div>
      </div>
    </div>
  );
}
