interface SkeletonProps {
  className?: string;
  height?: string;
  width?: string;
  count?: number;
}

export function Skeleton({ className = '', height = 'h-4', width = 'w-full' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded ${height} ${width} ${className}`}
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    />
  );
}

export function SkeletonRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-2">
          <Skeleton height="h-3" width={i === 1 ? 'w-48' : 'w-full'} />
        </td>
      ))}
    </tr>
  );
}
