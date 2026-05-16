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

  return (
    <html
      lang={locale}
      dir={isRtl ? 'rtl' : 'ltr'}
      data-theme="void"
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <ThemeProvider attribute="data-theme" defaultTheme="void" enableSystem={false}>
          <NextIntlClientProvider messages={messages}>
            <AnnouncementBar
              enabled={announcementEnabled}
              text={settings.announcement_text ?? ''}
              level={announcementLevel}
            />
            <Navbar logoUrl={settings.site_logo_url} />
            <main className="flex-1">{children}</main>
            <Footer text={settings.footer_text ?? ''} locale={locale} />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
