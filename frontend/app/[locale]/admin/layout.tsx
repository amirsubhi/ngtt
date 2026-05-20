'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

const NAV = [
  {
    group: 'site',
    items: [
      { key: 'settings',   href: '/admin/settings' },
      { key: 'theme',      href: '/admin/theme' },
      { key: 'categories', href: '/admin/categories' },
      { key: 'pages',      href: '/admin/pages' },
      { key: 'flux_store', href: '/admin/flux-store' },
    ],
  },
  {
    group: 'community',
    items: [
      { key: 'news',  href: '/admin/news' },
      { key: 'forum', href: '/admin/forum' },
    ],
  },
  {
    group: 'security',
    items: [
      { key: 'ip_bans', href: '/admin/ip-bans' },
      { key: 'clients', href: '/admin/clients' },
    ],
  },
  {
    group: 'system',
    items: [
      { key: 'events', href: '/admin/events' },
      { key: 'backup', href: '/admin/backup' },
      { key: 'update', href: '/admin/update' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin.nav');
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <ul className="space-y-0.5">
      {NAV.map(({ group, items }) => (
        <li key={group}>
          <p className="px-3 mt-4 mb-1 text-xs font-semibold uppercase tracking-wider opacity-40">
            {t(`group_${group}`)}
          </p>
          <ul className="space-y-0.5">
            {items.map(({ key, href }) => {
              const fullHref = `/${locale}${href}`;
              const active = pathname === fullHref || pathname.endsWith(href);
              return (
                <li key={key}>
                  <Link
                    href={fullHref}
                    onClick={() => setOpen(false)}
                    className="block rounded px-3 py-1.5 text-sm transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, shown as drawer when open */}
      <aside
        className={`
          fixed inset-y-0 start-0 top-14 z-50 w-52 shrink-0 border-e border-current/10 py-6 px-3 overflow-y-auto transition-transform md:static md:translate-x-0 md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {sidebar}
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile nav toggle */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-current/10 md:hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <button
            onClick={() => setOpen(v => !v)}
            className="p-1 rounded border border-current/20 text-sm"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Toggle admin menu"
          >
            ☰
          </button>
          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Admin</span>
        </div>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
