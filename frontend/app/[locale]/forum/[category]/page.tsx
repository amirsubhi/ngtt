'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface Topic {
  id: number;
  title: string;
  slug: string;
  is_pinned: boolean;
  is_locked: boolean;
  views: number;
  reply_count: number;
  created_at: string;
  last_reply_at: string | null;
  author: string;
  last_reply_by_username: string | null;
}

export default function ForumCategoryPage({ params }: { params: { category: string; locale: string } }) {
  const t = useTranslations('forum');
  const locale = useLocale();
  const router = useRouter();
  const { category } = params;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [catName, setCatName] = useState('');
  const [page, setPage] = useState(1);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token') ?? '';
    setToken(t);
  }, []);

  useEffect(() => {
    const tok = localStorage.getItem('access_token') ?? '';
    api.get<{ category: { name: string }; topics: Topic[] }>(`/api/forum/categories/${category}/topics?page=${page}`, tok)
      .then(d => { setCatName(d.category.name); setTopics(d.topics); })
      .catch(() => {});
  }, [category, page]);

  async function createTopic() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setPosting(true);
    try {
      const res = await api.post<{ id: number; slug: string }>(`/api/forum/categories/${category}/topics`, { title: newTitle, body: newBody }, token);
      router.push(`/${locale}/forum/${category}/${res.slug}`);
    } catch { /* ignore */ } finally { setPosting(false); }
  }

  const inputCls = 'w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30';
  const btnCls = 'rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/${locale}/forum`} className="text-sm opacity-50 hover:opacity-70">{t('back')}</Link>
          <h1 className="text-2xl font-bold mt-1">{catName}</h1>
        </div>
      </div>

      <div className="space-y-2">
        {topics.map(topic => (
          <div key={topic.id} className="flex items-center justify-between py-2 border-b border-current/5">
            <div className="flex items-center gap-2 min-w-0">
              {topic.is_pinned && <span className="text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)] px-1.5 py-0.5 rounded">PIN</span>}
              {topic.is_locked && <span className="text-xs bg-current/10 px-1.5 py-0.5 rounded opacity-50">LOCK</span>}
              <Link href={`/${locale}/forum/${category}/${topic.slug}`} className="text-sm hover:underline truncate">
                {topic.title}
              </Link>
            </div>
            <div className="text-xs opacity-40 whitespace-nowrap ml-4">
              {topic.reply_count} {t('replies')} · {topic.author}
            </div>
          </div>
        ))}
        {topics.length === 0 && <p className="opacity-40 text-sm">{t('no_topics')}</p>}
      </div>

      <div className="flex gap-3 justify-center">
        {page > 1 && <button onClick={() => setPage(p => p - 1)} className="text-sm opacity-60 hover:opacity-90">{t('prev')}</button>}
        {topics.length === 25 && <button onClick={() => setPage(p => p + 1)} className="text-sm opacity-60 hover:opacity-90">{t('next')}</button>}
      </div>

      {token && (
        <div className="border border-current/10 rounded-lg p-4 space-y-3">
          <h2 className="font-medium text-sm">{t('new_topic')}</h2>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={t('topic_title')} className={inputCls} />
          <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder={t('topic_body')} rows={4} className={inputCls} />
          <button onClick={createTopic} disabled={posting} className={btnCls}>{t('post_topic')}</button>
        </div>
      )}
    </div>
  );
}
