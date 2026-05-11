import Link from 'next/link';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon = '🔍', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
      <span className="text-4xl opacity-30">{icon}</span>
      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {description && <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="mt-2 rounded px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-2 rounded px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
