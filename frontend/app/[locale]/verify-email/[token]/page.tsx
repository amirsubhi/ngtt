import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

interface Props {
  params: Promise<{ token: string }>;
}

async function verifyToken(token: string): Promise<boolean> {
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${API}/api/auth/verify-email/${token}`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function VerifyEmailPage({ params }: Props) {
  const { token } = await params;
  const t = await getTranslations('auth.verify_email');
  const ok = await verifyToken(token);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className={ok ? 'text-green-500' : 'text-red-500'}>
          {ok ? t('success') : t('error')}
        </p>
        <Link href="/login" className="text-sm hover:underline opacity-70">
          Back to login
        </Link>
      </div>
    </div>
  );
}
