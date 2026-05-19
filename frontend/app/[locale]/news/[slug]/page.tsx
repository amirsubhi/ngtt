'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { sanitizeHtml } from '@/lib/sanitize';

interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
  author: string;
}

export default function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

  useEffect(() => {
    params.then(({ slug }) => {
      const token = localStorage.getItem('access_token') ?? '';
      api.get<NewsArticle>(`/api/news/${encodeURIComponent(slug)}`, token)
        .then(setArticle)
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 401) {
            router.push('/login');
          } else {
            setNotFound(true);
          }
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (notFound) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
        <p className="text-4xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>404</p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>News article not found.</p>
        <Link href="/" className="text-sm" style={{ color: 'var(--accent)' }}>Back to home</Link>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="h-8 w-2/3 rounded mb-4 animate-pulse" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-4 w-1/3 rounded mb-8 animate-pulse" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-elevated)', width: `${85 - i * 5}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-6">
        <Link href="/" className="text-xs hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
          Back to home
        </Link>
      </div>

      {article.is_pinned && (
        <span
          className="inline-block text-[10px] px-2 py-0.5 rounded font-medium mb-3"
          style={{ backgroundColor: 'var(--accent)', color: '#fff', opacity: 0.9 }}
        >
          Pinned
        </span>
      )}

      <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
        {article.title}
      </h1>

      <p className="text-xs mb-8" style={{ color: 'var(--text-muted)' }}>
        By {article.author} &middot; {new Date(article.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      {/* Content sanitized by DOMPurify via sanitizeHtml — safe for dangerouslySetInnerHTML */}
      <div
        className="prose prose-sm max-w-none leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.body) }}
      />
    </div>
  );
}
