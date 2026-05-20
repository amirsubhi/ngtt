'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { sanitizeHtml } from '@/lib/sanitize';
import { Breadcrumb } from '@/components/Breadcrumb';

interface Post {
  id: number;
  body: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  edited_at: string | null;
}

interface Topic {
  id: number;
  title: string;
  is_locked: boolean;
  is_pinned: boolean;
  reply_count: number;
  author: string;
}

export default function ForumTopicPage({ params }: { params: { category: string; topic: string } }) {
  const t = useTranslations('forum');
  const locale = useLocale();
  const { category, topic: topicSlug } = params;
  const [topicData, setTopicData] = useState<Topic | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [replyBody, setReplyBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [token, setToken] = useState('');
  const [topicId, setTopicId] = useState<number | null>(null);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    const tok = localStorage.getItem('access_token') ?? '';
    setToken(tok);
    try {
      const payload = JSON.parse(atob(tok.split('.')[1]));
      if (['staff', 'admin', 'moderator'].includes(payload?.group_slug ?? '')) setIsStaff(true);
    } catch { /* no-op */ }
  }, []);

  useEffect(() => {
    const tok = localStorage.getItem('access_token') ?? '';
    api.get<{ id: number }>(`/api/forum/topics/by-slug/${encodeURIComponent(topicSlug)}`, tok)
      .then(d => setTopicId(d.id))
      .catch(() => {});
  }, [topicSlug]);

  useEffect(() => {
    if (!topicId) return;
    const tok = localStorage.getItem('access_token') ?? '';
    api.get<{ topic: Topic; posts: Post[] }>(`/api/forum/topics/${topicId}?page=${page}`, tok)
      .then(d => { setTopicData(d.topic); setPosts(d.posts); })
      .catch(() => {});
  }, [topicId, page]);

  async function submitReply() {
    if (!topicId || !replyBody.trim()) return;
    setPosting(true);
    try {
      await api.post(`/api/forum/topics/${topicId}/posts`, { body: replyBody }, token);
      setReplyBody('');
      const d = await api.get<{ topic: Topic; posts: Post[] }>(`/api/forum/topics/${topicId}?page=${page}`, token);
      setTopicData(d.topic); setPosts(d.posts);
    } catch { /* ignore */ } finally { setPosting(false); }
  }

  async function modTopic(patch: { is_pinned?: boolean; is_locked?: boolean }) {
    if (!topicId) return;
    await api.patch(`/api/forum/topics/${topicId}`, patch, token);
    setTopicData(prev => prev ? { ...prev, ...patch } : prev);
  }

  async function deleteTopic() {
    if (!topicId || !confirm('Delete this topic permanently?')) return;
    await api.delete(`/api/forum/topics/${topicId}`, token);
    window.location.href = `/${locale}/forum/${category}`;
  }

  const inputCls = 'w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30';

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      <Breadcrumb crumbs={[
        { label: 'Forum', href: '/forum' },
        { label: category, href: `/forum/${category}` },
        ...(topicData ? [{ label: topicData.title }] : []),
      ]} />

      {topicData && (
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold">{topicData.title}</h1>
          {isStaff && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => modTopic({ is_pinned: !topicData.is_pinned })}
                className="text-xs px-2 py-1 rounded border border-current/20 hover:border-current/40 transition-colors"
                style={{ color: topicData.is_pinned ? 'var(--accent)' : 'var(--text-muted)' }}
                title={topicData.is_pinned ? 'Unpin' : 'Pin'}
              >
                {topicData.is_pinned ? '📌 Pinned' : '📌 Pin'}
              </button>
              <button
                onClick={() => modTopic({ is_locked: !topicData.is_locked })}
                className="text-xs px-2 py-1 rounded border border-current/20 hover:border-current/40 transition-colors"
                style={{ color: topicData.is_locked ? 'var(--accent)' : 'var(--text-muted)' }}
                title={topicData.is_locked ? 'Unlock' : 'Lock'}
              >
                {topicData.is_locked ? '🔒 Locked' : '🔓 Lock'}
              </button>
              <button
                onClick={deleteTopic}
                className="text-xs px-2 py-1 rounded border border-current/20 hover:border-red-500/40 hover:text-red-400 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className="border border-current/10 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              {post.avatar_url
                ? <img src={post.avatar_url} alt={post.username} loading="lazy" className="w-8 h-8 rounded-full object-cover" />
                : <div className="w-8 h-8 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold opacity-40">{post.username[0]?.toUpperCase()}</div>
              }
              <span className="text-sm font-medium">{post.username}</span>
              <span className="text-xs opacity-40">{new Date(post.created_at).toLocaleString()}</span>
              {post.edited_at && <span className="text-xs opacity-30">{t('edited')}</span>}
            </div>
            <div
              className="prose prose-sm max-w-none text-sm opacity-90"
              // Content is server-rendered markdown sanitized by DOMPurify
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
            />
          </div>
        ))}
        {posts.length === 0 && <p className="opacity-40 text-sm">{t('no_posts')}</p>}
      </div>

      <div className="flex gap-3 justify-center">
        {page > 1 && <button onClick={() => setPage(p => p - 1)} className="text-sm opacity-60 hover:opacity-90">{t('prev')}</button>}
        {posts.length === 25 && <button onClick={() => setPage(p => p + 1)} className="text-sm opacity-60 hover:opacity-90">{t('next')}</button>}
      </div>

      {token && topicData && !topicData.is_locked && (
        <div className="border border-current/10 rounded-lg p-4 space-y-3">
          <h2 className="font-medium text-sm">{t('reply')}</h2>
          <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder={t('reply_placeholder')} rows={4} className={inputCls} />
          <button onClick={submitReply} disabled={posting}
            className="rounded px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}>
            {t('post_reply')}
          </button>
        </div>
      )}
      {topicData?.is_locked && <p className="text-sm opacity-50 text-center">{t('locked')}</p>}
    </div>
  );
}
