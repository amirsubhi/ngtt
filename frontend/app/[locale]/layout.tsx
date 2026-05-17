// Copyright (c) 2026 amirsubhi — MIT License
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Navbar } from '@/components/Navbar';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { Footer } from '@/components/Footer';
import { fetchPublicSettings } from '@/lib/publicSettings';
import '@/styles/globals.css';

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await fetchPublicSettings();
  return {
    title: s.site_name || 'NGTT',
    description: s.site_description || 'Next-Gen Torrent Tracker',
    icons: s.site_favicon_url ? { icon: s.site_favicon_url } : undefined,
  };
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const VOID_FALLBACK = `[data-theme='custom']{--bg-base:#0a0a0a;--bg-surface:#111111;--bg-elevated:#1a1a1a;--accent:#3b82f6;--accent-hover:#2563eb;--text-primary:#ededed;--text-muted:#737373;--text-subtle:#404040;--border:#222222;--border-focus:#3b82f6;--success:#22c55e;--danger:#ef4444;--warning:#f59e0b}`;

const BUILT_IN_THEMES = ['void', 'pulse', 'cipher', 'nebula', 'ember', 'lumen', 'sand', 'cobalt'];

function parseCustomTheme(raw: string | undefined): {
  css: string;
  swatch: { name: string; bg: string; accent: string } | null;
} {
  if (!raw) return { css: VOID_FALLBACK, swatch: null };
  try {
    const ct = JSON.parse(raw) as Record<string, string> | null;
    if (!ct || typeof ct !== 'object') return { css: VOID_FALLBACK, swatch: null };
    const vars = Object.entries(ct)
      .filter(([k, v]) => k.startsWith('--') && HEX_COLOR.test(v))
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
    if (!vars) return { css: VOID_FALLBACK, swatch: null };
    return {
      css: `[data-theme='custom']{${vars}}`,
      swatch: {
        name: typeof ct.name === 'string' ? ct.name.slice(0, 50) : 'Custom',
        bg: HEX_COLOR.test(ct['--bg-surface'] ?? '') ? ct['--bg-surface'] : '#111111',
        accent: HEX_COLOR.test(ct['--accent'] ?? '') ? ct['--accent'] : '#6366f1',
      },
    };
  } catch {
    return { css: VOID_FALLBACK, swatch: null };
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as never)) notFound();

  const [messages, settings] = await Promise.all([getMessages(), fetchPublicSettings()]);
  const isRtl = locale === 'ar';

  const announcementEnabled = settings.announcement_enabled === 'true';
  const announcementLevel = (['info', 'warning', 'danger'] as const).includes(
    settings.announcement_level as 'info' | 'warning' | 'danger',
  )
    ? (settings.announcement_level as 'info' | 'warning' | 'danger')
    : 'info';

  const { css: customThemeCSS, swatch: customThemeSwatch } = parseCustomTheme(settings.custom_theme);
  const themeList = customThemeSwatch ? [...BUILT_IN_THEMES, 'custom'] : BUILT_IN_THEMES;

  return (
    <html
      lang={locale}
      dir={isRtl ? 'rtl' : 'ltr'}
      data-theme="void"
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <style>{customThemeCSS}</style>
        <ThemeProvider attribute="data-theme" defaultTheme="void" enableSystem={false} themes={themeList}>
          <NextIntlClientProvider messages={messages}>
            <AnnouncementBar
              enabled={announcementEnabled}
              text={settings.announcement_text ?? ''}
              level={announcementLevel}
            />
            <Navbar logoUrl={settings.site_logo_url} customTheme={customThemeSwatch} />
            <main className="flex-1">{children}</main>
            <Footer text={settings.footer_text ?? ''} locale={locale} />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
