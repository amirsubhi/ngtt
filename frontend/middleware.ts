import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const NON_DEFAULT_LOCALES = ['ms-MY', 'zh-CN', 'es', 'pt-BR', 'ar'];
const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/p', '/verify-email'];

function stripLocale(pathname: string): string {
  for (const locale of NON_DEFAULT_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || '/';
    }
  }
  return pathname;
}

function getLocalePrefix(pathname: string): string {
  for (const locale of NON_DEFAULT_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return `/${locale}`;
    }
  }
  return '';
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const stripped = stripLocale(pathname);

  const isPublic = PUBLIC_PATHS.some(p => stripped === p || stripped.startsWith(`${p}/`));

  if (!isPublic && !req.cookies.has('refresh_token')) {
    const url = req.nextUrl.clone();
    url.pathname = `${getLocalePrefix(pathname)}/login`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
