import Link from 'next/link';

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="opacity-40">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:opacity-100 opacity-60 truncate max-w-[200px]">
              {crumb.label}
            </Link>
          ) : (
            <span className="opacity-100 font-medium truncate max-w-[200px]" style={{ color: 'var(--text-primary)' }}>
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
