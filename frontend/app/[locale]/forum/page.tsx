'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  topic_count: number;
  post_count: number;
}

export default function ForumPage() {
  const t = useTranslations('forum');
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    api.get<{ categories: Category[] }>('/api/forum/categories', token)
      .then(d => setCategories(d.categories))
      .catch(() => {});
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <div className="space-y-3">
        {categories.map(cat => (
          <div key={cat.id} className="rounded-lg border border-current/10 p-4 hover:border-current/20 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <Link href={`/forum/${cat.slug}`} className="font-semibold hover:underline text-[var(--color-accent)]">
                  {cat.name}
                </Link>
                {cat.description && <p className="text-sm opacity-60 mt-1">{cat.description}</p>}
              </div>
              <div className="text-xs opacity-40 text-right ml-4 whitespace-nowrap">
                <div>{cat.topic_count} {t('topics')}</div>
                <div>{cat.post_count} {t('posts')}</div>
              </div>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="opacity-40 text-sm">{t('no_categories')}</p>}
      </div>
    </div>
  );
}
