'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-bold tabular-nums" style={{ color: 'var(--text-subtle)' }}>500</p>
      <p className="mt-4 text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Something went wrong</p>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        An unexpected error occurred. Try again or go back home.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/5"
          style={{ color: 'var(--text-muted)' }}
        >
          Go home
        </a>
      </div>
    </div>
  );
}
