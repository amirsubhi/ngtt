'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [token, setToken] = useState('');

  useEffect(() => {
    const tok = localStorage.getItem('access_token') ?? '';
    setToken(tok);
    if (!tok) { router.push('/login'); return; }
    api.get<{ notifications: Notification[]; unread_count: number }>('/api/notifications', tok)
      .then(d => { setNotifications(d.notifications); setUnread(d.unread_count); })
      .catch(() => {});
  }, [router]);

  async function markAllRead() {
    await api.post('/api/notifications/mark-all-read', {}, token).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  }

  async function markRead(id: number) {
    await api.post('/api/notifications/mark-read', { ids: [id] }, token).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')} {unread > 0 && <span className="text-sm bg-[var(--color-accent)] text-white rounded-full px-2 py-0.5 ml-2">{unread}</span>}</h1>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm opacity-60 hover:opacity-90">{t('mark_all_read')}</button>
        )}
      </div>

      <div className="space-y-1">
        {notifications.map(notif => (
          <div key={notif.id}
            className={`p-3 rounded-lg border transition-colors cursor-pointer ${notif.is_read ? 'border-current/5 opacity-60' : 'border-current/20 bg-[var(--color-accent)]/5'}`}
            onClick={() => { if (!notif.is_read) markRead(notif.id); if (notif.url) router.push(notif.url); }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium">{notif.title}</p>
                {notif.body && <p className="text-xs opacity-60 mt-0.5">{notif.body}</p>}
              </div>
              <span className="text-xs opacity-40 whitespace-nowrap ml-3">{new Date(notif.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {notifications.length === 0 && <p className="opacity-40 text-sm">{t('empty')}</p>}
      </div>
    </div>
  );
}
