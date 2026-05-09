'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface MessageDetail {
  id: number;
  subject: string;
  body: string;
  sender_id: number;
  receiver_id: number;
  sender_username: string;
  receiver_username: string;
  created_at: string;
  is_read: boolean;
}

export default function MessageDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('messages');
  const locale = useLocale();
  const router = useRouter();
  const [msg, setMsg] = useState<MessageDetail | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    const tok = localStorage.getItem('access_token') ?? '';
    setToken(tok);
    if (!tok) { router.push('/login'); return; }
    api.get<MessageDetail>(`/api/messages/${params.id}`, tok)
      .then(setMsg)
      .catch(() => router.push(`/${locale}/messages`));
  }, [params.id, router, locale]);

  async function deleteMsg() {
    await api.post(`/api/messages/mark-read`, { ids: [msg!.id] }, token).catch(() => {});
    await fetch(`/api/messages/${msg!.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    router.push(`/${locale}/messages`);
  }

  if (!msg) return <div className="flex min-h-screen items-center justify-center opacity-40">Loading…</div>;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
      <Link href={`/${locale}/messages`} className="text-sm opacity-50 hover:opacity-70">{t('back')}</Link>

      <div className="border border-current/10 rounded-lg p-6 space-y-4">
        <h1 className="text-xl font-semibold">{msg.subject}</h1>
        <div className="flex justify-between text-sm opacity-50">
          <span>{t('from')}: <strong className="opacity-100">{msg.sender_username}</strong></span>
          <span>{new Date(msg.created_at).toLocaleString()}</span>
        </div>
        <hr className="border-current/10" />
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
      </div>

      <div className="flex gap-3">
        <button onClick={deleteMsg} className="rounded border border-red-500/30 text-red-500 px-3 py-1.5 text-sm hover:bg-red-500/10">
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
