'use client';

export function Navbar() {
  return (
    <nav
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>
        NGTT
      </span>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <a
          href="/browse"
          style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}
        >
          Browse
        </a>
        <a
          href="/forum"
          style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}
        >
          Forum
        </a>
        <a
          href="/login"
          style={{
            color: 'var(--accent)',
            fontSize: '0.875rem',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Login
        </a>
      </div>
    </nav>
  );
}
