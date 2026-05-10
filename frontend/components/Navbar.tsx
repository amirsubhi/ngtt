'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { api } from '@/lib/api';

const LOCALES = [
  { value: 'en',    label: 'English',       flag: '🇬🇧' },
  { value: 'ms-MY', label: 'Bahasa Melayu', flag: '🇲🇾' },
  { value: 'zh-CN', label: '中文',           flag: '🇨🇳' },
  { value: 'es',    label: 'Español',        flag: '🇪🇸' },
  { value: 'pt-BR', label: 'Português',      flag: '🇧🇷' },
  { value: 'ar',    label: 'العربية',        flag: '🇸🇦' },
] as const;

const NON_DEFAULT_LOCALES = ['ms-MY', 'zh-CN', 'es', 'pt-BR', 'ar'];
const THEMES = ['void', 'pulse', 'cipher', 'nebula', 'ember', 'lumen', 'sand'] as const;

interface NavUser { username: string; group_slug: string }

export function Navbar({ logoUrl }: { logoUrl?: string }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<NavUser | null>(null);
  const [showLang, setShowLang] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload?.id) setUser({ username: payload.username, group_slug: payload.group_slug ?? '' });
    } catch { /* no-op */ }
  }, []);

  // Close lang dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setShowLang(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function logout() {
    const token = localStorage.getItem('access_token') ?? '';
    api.post('/api/auth/logout', {}, token).catch(() => {});
    localStorage.removeItem('access_token');
    setUser(null);
    router.push('/login');
  }

  async function switchLocale(newLocale: string) {
    setShowLang(false);
    const token = localStorage.getItem('access_token') ?? '';
    if (token) api.post('/api/users/me/settings', { locale: newLocale }, token).catch(() => {});
    // Strip existing locale prefix, apply new one
    const hasPrefix = NON_DEFAULT_LOCALES.some(l => pathname.startsWith(`/${l}/`) || pathname === `/${l}`);
    const stripped = hasPrefix ? pathname.replace(/^\/[^/]+/, '') || '/' : pathname;
    const newPath = newLocale === 'en' ? stripped : `/${newLocale}${stripped === '/' ? '' : stripped}`;
    router.push(newPath);
  }

  function cycleTheme() {
    const idx = THEMES.indexOf((theme ?? 'void') as typeof THEMES[number]);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
    const token = localStorage.getItem('access_token') ?? '';
    if (token) api.post('/api/users/me/settings', { theme: next }, token).catch(() => {});
  }

  const isStaff = user && ['staff', 'admin', 'moderator'].includes(user.group_slug);
  const isAdmin = user?.group_slug === 'admin';
  const currentLang = LOCALES.find(l => l.value === locale) ?? LOCALES[0];
  const themeName = (theme ?? 'void') as typeof THEMES[number];

  const AUTH_SEGMENTS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
  const isAuthPage = AUTH_SEGMENTS.some(seg =>
    pathname === seg ||
    pathname === `/${locale}${seg}` ||
    pathname.startsWith(`/${locale}${seg}/`),
  );
  if (isAuthPage) return null;

  return (
    <nav
      className="border-b border-current/10 flex items-center gap-4 px-6 h-14 shrink-0"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Logo */}
      <Link href="/" className="font-bold text-lg shrink-0" style={{ color: 'var(--text-primary)' }}>
        {logoUrl
          ? <img src={logoUrl} alt="Site logo" className="h-8 w-auto object-contain" />
          : 'NGTT'}
      </Link>

      {/* Main nav links */}
      <div className="flex items-center gap-4 flex-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/browse" className="hover:opacity-80">{t('browse')}</Link>
        <Link href="/forum" className="hover:opacity-80">{t('forum')}</Link>
        {user && <Link href="/upload" className="hover:opacity-80">{t('upload')}</Link>}
        {user && <Link href="/requests" className="hover:opacity-80">{t('requests')}</Link>}
        {user && <Link href="/bonus" className="hover:opacity-80">{t('bonus')}</Link>}
        {isStaff && <Link href="/staff" className="hover:opacity-80">{t('staff')}</Link>}
        {isAdmin && <Link href="/admin/settings" className="hover:opacity-80">{t('admin')}</Link>}
      </div>

      {/* Right-side controls */}
      <div className="flex items-center gap-2 shrink-0 text-sm">
        {/* Theme cycle button */}
        <button
          onClick={cycleTheme}
          title={t('theme_toggle')}
          className="px-2 py-1 rounded border border-current/20 hover:border-current/40 text-xs capitalize"
          style={{ color: 'var(--text-muted)' }}
        >
          {themeName}
        </button>

        {/* Language switcher */}
        <div ref={langRef} className="relative">
          <button
            onClick={() => setShowLang(v => !v)}
            className="px-2 py-1 rounded border border-current/20 hover:border-current/40 text-xs"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('language')}
          >
            {currentLang.flag} <span className="hidden sm:inline">{currentLang.label}</span>
          </button>
          {showLang && (
            <div
              className="absolute end-0 top-full mt-1 rounded border border-current/20 shadow-lg z-50 py-1 min-w-[160px]"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              {LOCALES.map(l => (
                <button
                  key={l.value}
                  onClick={() => switchLocale(l.value)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-current/10 text-start"
                  style={{ color: locale === l.value ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auth links */}
        {user ? (
          <>
            <Link
              href={`/user/${user.username}`}
              className="hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              {user.username}
            </Link>
            <Link href="/settings" className="hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
              {t('settings')}
            </Link>
            <button onClick={logout} className="hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
              {t('logout')}
            </button>
          </>
        ) : (
          <Link href="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
            {t('login')}
          </Link>
        )}
      </div>
    </nav>
  );
}
