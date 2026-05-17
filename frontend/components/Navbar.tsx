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

const THEMES = ['void', 'pulse', 'cipher', 'nebula', 'ember', 'lumen', 'sand', 'cobalt'] as const;
type Theme = typeof THEMES[number];

// bg + accent for each theme — used to render swatches without relying on CSS vars
const SWATCHES: Record<Theme, { bg: string; accent: string }> = {
  void:   { bg: '#111111', accent: '#3b82f6' },
  pulse:  { bg: '#181818', accent: '#06b6d4' },
  cipher: { bg: '#161b22', accent: '#10b981' },
  nebula: { bg: '#13131f', accent: '#8b5cf6' },
  ember:  { bg: '#1a1710', accent: '#f97316' },
  lumen:  { bg: '#f8fafc', accent: '#6366f1' },
  sand:   { bg: '#f3f0e8', accent: '#d97706' },
  cobalt: { bg: '#0c0760', accent: '#1800E7' },
};

interface NavUser { username: string; group_slug: string }
interface MenuStats {
  flux: number;
  uploaded: number;
  downloaded: number;
  avatar_url: string | null;
  group_name: string;
  group_color: string;
}

const MENU_CACHE_KEY = 'ngtt_me';
const MENU_CACHE_TTL = 60_000;

function formatBytes(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TB';
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + ' GB';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + ' MB';
  return (n / 1e3).toFixed(1) + ' KB';
}

function ratioColor(ratio: number): string {
  if (ratio === Infinity || ratio >= 1) return 'oklch(0.72 0.17 145)';
  if (ratio >= 0.5) return 'oklch(0.75 0.16 65)';
  return 'oklch(0.62 0.20 25)';
}

interface CustomThemeSwatch { name: string; bg: string; accent: string }

export function Navbar({ logoUrl, customTheme }: { logoUrl?: string; customTheme?: CustomThemeSwatch | null }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<NavUser | null>(null);
  const [menuStats, setMenuStats] = useState<MenuStats | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  function fetchMenuStats(force = false) {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    if (!force) {
      try {
        const raw = sessionStorage.getItem(MENU_CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw) as { ts: number; data: MenuStats };
          if (Date.now() - ts < MENU_CACHE_TTL) { setMenuStats(data); return; }
        }
      } catch { /* ignore */ }
    }
    api.get<MenuStats>('/api/users/me', token).then(data => {
      setMenuStats(data);
      sessionStorage.setItem(MENU_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    }).catch(() => {});
  }

  function applyToken() {
    const token = localStorage.getItem('access_token');
    if (!token) { setUser(null); setMenuStats(null); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload?.sub) {
        setUser({ username: payload.username, group_slug: payload.group_slug ?? '' });
        fetchMenuStats(true);
      }
    } catch { /* no-op */ }
  }

  useEffect(() => {
    applyToken();
    window.addEventListener('authchange', applyToken);
    return () => window.removeEventListener('authchange', applyToken);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLang(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setShowTheme(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function logout() {
    const token = localStorage.getItem('access_token') ?? '';
    api.post('/api/auth/logout', {}, token).catch(() => {});
    localStorage.removeItem('access_token');
    sessionStorage.removeItem(MENU_CACHE_KEY);
    setUser(null);
    setMenuStats(null);
    setShowMenu(false);
    router.push('/login');
  }

  async function switchLocale(newLocale: string) {
    setShowLang(false);
    const token = localStorage.getItem('access_token') ?? '';
    if (token) api.put('/api/users/me/settings', { locale: newLocale }, token).catch(() => {});
    const current = window.location.pathname;
    const hasPrefix = NON_DEFAULT_LOCALES.some(l => current.startsWith(`/${l}/`) || current === `/${l}`);
    const stripped = hasPrefix ? current.replace(/^\/[^/]+/, '') || '/' : current;
    const newPath = newLocale === 'en' ? stripped : `/${newLocale}${stripped === '/' ? '' : stripped}`;
    window.location.href = newPath;
  }

  function applyTheme(next: string) {
    setTheme(next);
    setShowTheme(false);
    const token = localStorage.getItem('access_token') ?? '';
    if (token) api.put('/api/users/me/settings', { theme: next }, token).catch(() => {});
  }

  const isStaff = user && ['staff', 'admin', 'moderator'].includes(user.group_slug);
  const isAdmin = user?.group_slug === 'admin';
  const currentLang = LOCALES.find(l => l.value === locale) ?? LOCALES[0];
  const activeTheme = (theme ?? 'void') as string;

  const allThemes: string[] = customTheme ? [...THEMES, 'custom'] : [...THEMES];
  const allSwatches: Record<string, { bg: string; accent: string }> = customTheme
    ? { ...SWATCHES, custom: { bg: customTheme.bg, accent: customTheme.accent } }
    : { ...SWATCHES };
  const activeSwatch = allSwatches[activeTheme] ?? SWATCHES.void;

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
        {user && <Link href="/stats" className="hover:opacity-80">{t('stats')}</Link>}
        {isStaff && <Link href="/staff" className="hover:opacity-80">{t('staff_panel')}</Link>}
        {isAdmin && <Link href="/admin" className="hover:opacity-80">{t('admin_panel')}</Link>}
      </div>

      {/* Right-side controls */}
      <div className="flex items-center gap-2 shrink-0 text-sm">

        {/* Theme swatch picker */}
        <div ref={themeRef} className="relative">
          <button
            onClick={() => setShowTheme(v => !v)}
            title={t('theme_toggle')}
            className="flex items-center gap-1.5 px-2 py-1 rounded border border-current/20 hover:border-current/40 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {/* Two-tone swatch showing current theme */}
            <span className="inline-flex rounded-full overflow-hidden w-4 h-4 shrink-0 border border-white/20">
              <span className="w-1/2 h-full" style={{ background: activeSwatch.bg }} />
              <span className="w-1/2 h-full" style={{ background: activeSwatch.accent }} />
            </span>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="opacity-50">
              <path d="M0 2l4 4 4-4H0z" />
            </svg>
          </button>

          {showTheme && (
            <div
              className="absolute end-0 top-full mt-1 rounded-lg border border-current/20 shadow-xl z-50 p-2"
              style={{ backgroundColor: 'var(--bg-elevated)', minWidth: '9rem' }}
            >
              <p className="text-xs opacity-40 px-1 pb-1.5 font-medium">Theme</p>
              <div className="grid grid-cols-4 gap-1.5">
                {allThemes.map(th => {
                  const s = allSwatches[th] ?? SWATCHES.void;
                  const active = th === activeTheme;
                  const label = (th === 'custom' && customTheme) ? customTheme.name : th;
                  return (
                    <button
                      key={th}
                      onClick={() => applyTheme(th)}
                      title={label}
                      className="flex flex-col items-center gap-1 p-1 rounded-md hover:bg-current/10 transition-colors"
                    >
                      <span
                        className="w-8 h-8 rounded-md overflow-hidden flex shrink-0"
                        style={{ outline: active ? `2px solid ${s.accent}` : '2px solid transparent', outlineOffset: '1px' }}
                      >
                        <span className="w-1/2 h-full" style={{ background: s.bg }} />
                        <span className="w-1/2 h-full" style={{ background: s.accent }} />
                      </span>
                      <span className="text-[9px] opacity-60 capitalize leading-none truncate max-w-[2.5rem]">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

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

        {/* Ratio / stats strip */}
        {user && menuStats && (
          <div className="hidden sm:flex items-center gap-3 text-xs px-1" style={{ color: 'var(--text-muted)' }}>
            <span title="Uploaded">↑ {formatBytes(menuStats.uploaded)}</span>
            <span title="Downloaded">↓ {formatBytes(menuStats.downloaded)}</span>
            <span
              title="Ratio"
              className="font-mono font-semibold"
              style={{ color: ratioColor(menuStats.downloaded === 0 ? Infinity : menuStats.uploaded / menuStats.downloaded) }}
            >
              {menuStats.downloaded === 0 ? '∞' : (menuStats.uploaded / menuStats.downloaded).toFixed(2)}
            </span>
          </div>
        )}

        {/* User menu */}
        {user ? (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => {
                const next = !showMenu;
                setShowMenu(next);
                if (next) {
                  try {
                    const raw = sessionStorage.getItem(MENU_CACHE_KEY);
                    const stale = !raw || Date.now() - (JSON.parse(raw) as { ts: number }).ts >= MENU_CACHE_TTL;
                    if (stale) fetchMenuStats(true);
                  } catch { fetchMenuStats(true); }
                }
              }}
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0 border border-current/20 hover:border-current/40 transition-colors"
              style={menuStats?.avatar_url ? undefined : { backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
              aria-label="User menu"
            >
              {menuStats?.avatar_url
                ? <img src={menuStats.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                : user.username.slice(0, 2).toUpperCase()}
            </button>

            {showMenu && (
              <div
                className="absolute end-0 top-full mt-1 rounded-lg border border-current/20 shadow-xl z-50 w-56"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                {/* Identity header */}
                <div className="flex items-center gap-3 p-3 border-b border-current/10">
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold"
                    style={menuStats?.avatar_url ? undefined : { backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
                  >
                    {menuStats?.avatar_url
                      ? <img src={menuStats.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      : user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {user.username}
                    </p>
                    {menuStats?.group_name && (
                      <span
                        className="inline-block text-[10px] px-1.5 py-0.5 rounded-sm font-medium mt-0.5"
                        style={{
                          backgroundColor: menuStats.group_color + '33',
                          color: menuStats.group_color,
                        }}
                      >
                        {menuStats.group_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats grid */}
                {menuStats ? (
                  <div className="p-3 grid grid-cols-2 gap-y-2 text-xs border-b border-current/10">
                    <div>
                      <p className="opacity-40 leading-none mb-1">Ratio</p>
                      <p
                        className="font-mono font-semibold"
                        style={{ color: ratioColor(menuStats.downloaded === 0 ? Infinity : menuStats.uploaded / menuStats.downloaded) }}
                      >
                        {menuStats.downloaded === 0 ? '∞' : (menuStats.uploaded / menuStats.downloaded).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="opacity-40 leading-none mb-1">Flux</p>
                      <p className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {menuStats.flux.toLocaleString()} <span className="opacity-50 font-normal">FLX</span>
                      </p>
                    </div>
                    <div>
                      <p className="opacity-40 leading-none mb-1">↑ Upload</p>
                      <p className="font-mono" style={{ color: 'var(--text-secondary)' }}>{formatBytes(menuStats.uploaded)}</p>
                    </div>
                    <div>
                      <p className="opacity-40 leading-none mb-1">↓ Download</p>
                      <p className="font-mono" style={{ color: 'var(--text-secondary)' }}>{formatBytes(menuStats.downloaded)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 text-xs opacity-40 border-b border-current/10">Loading…</div>
                )}

                {/* Nav links */}
                <div className="py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Link
                    href={`/user/${user.username}`}
                    onClick={() => setShowMenu(false)}
                    className="flex items-center px-3 py-2 hover:bg-current/10 transition-colors"
                  >
                    {t('profile')}
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center px-3 py-2 hover:bg-current/10 transition-colors"
                  >
                    {t('settings')}
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center w-full text-start px-3 py-2 hover:bg-current/10 transition-colors"
                    style={{ color: 'oklch(0.62 0.20 25)' }}
                  >
                    {t('logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
            {t('login')}
          </Link>
        )}
      </div>
    </nav>
  );
}
