'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';

interface Message {
  id: number;
  subject: string;
  is_read?: boolean;
  created_at: string;
  sender_username?: string;
  receiver_username?: string;
}

export default function MessagesPage() {
  const t = useTranslations('messages');
  const locale = useLocale();
  const router = useRouter();
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tok = localStorage.getItem('access_token') ?? '';
    setToken(tok);
    if (!tok) { router.push(`/${locale}/login`); return; }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.get<{ messages: Message[] }>(`/api/messages?folder=${folder}`, token)
      .then(d => setMessages(d.messages))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [folder, token]);

  async function send() {
    setError('');
    setSending(true);
    try {
      await api.post('/api/messages', { receiver_username: to, subject, body }, token);
      setComposing(false); setTo(''); setSubject(''); setBody('');
      if (folder === 'sent') {
        const d = await api.get<{ messages: Message[] }>('/api/messages?folder=sent', token);
        setMessages(d.messages);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('send_error'));
    } finally { setSending(false); }
  }

  const inputCls = 'w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30';

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('title')}</h1>
        <button onClick={() => setComposing(c => !c)}
          className="rounded px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}>
          {t('compose')}
        </button>
      </div>

      {composing && (
        <div className="border border-current/10 rounded-lg p-4 space-y-3">
          <h2 className="font-medium text-sm">{t('new_message')}</h2>
          <input value={to} onChange={e => setTo(e.target.value)} placeholder={t('to')} className={inputCls} />
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={t('subject')} className={inputCls} />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={t('body')} rows={4} className={inputCls} />
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setComposing(false)} className="rounded border border-current/20 px-4 py-2 text-sm hover:border-current/40">{t('cancel')}</button>
            <button onClick={send} disabled={sending}
              className="rounded px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}>
              {sending ? t('sending') : t('send')}
            </button>
          </div>
        </div>
      )}

      <div className="border-b border-current/10 flex gap-1">
        {(['inbox', 'sent'] as const).map(f => (
          <button key={f} onClick={() => setFolder(f)}
            className="px-4 py-2 text-sm border-b-2 capitalize transition-colors -mb-px"
            style={{
              borderBottomColor: folder === f ? 'var(--accent)' : 'transparent',
              color: folder === f ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
            {t(f)}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-current/5 px-2">
            <Skeleton height="h-3" width="w-64" />
            <Skeleton height="h-3" width="w-16" />
          </div>
        ))}
        {!loading && messages.map(msg => (
          <Link key={msg.id} href={`/messages/${msg.id}`}
            className={`flex justify-between items-center py-2 border-b border-current/5 hover:bg-current/5 px-2 rounded ${!msg.is_read && folder === 'inbox' ? 'font-medium' : ''}`}>
            <div className="min-w-0">
              <span className="text-sm truncate">{msg.subject}</span>
              <span className="text-xs opacity-40 ml-2">
                {folder === 'inbox' ? msg.sender_username : msg.receiver_username}
              </span>
            </div>
            <span className="text-xs opacity-40 whitespace-nowrap ml-4">{new Date(msg.created_at).toLocaleDateString()}</span>
          </Link>
        ))}
        {!loading && messages.length === 0 && <p className="opacity-40 text-sm">{t('empty')}</p>}
      </div>
    </div>
  );
}
