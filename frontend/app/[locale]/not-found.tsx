import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-bold tabular-nums" style={{ color: 'var(--text-subtle)' }}>404</p>
      <p className="mt-4 text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Page not found</p>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        This page doesn&apos;t exist or has been removed.
      </p>
      <Link
        href="/"
        className="mt-8 rounded px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        Go home
      </Link>
    </div>
  );
}
