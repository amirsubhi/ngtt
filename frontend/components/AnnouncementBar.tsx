interface Props {
  enabled: boolean;
  text: string;
  level: 'info' | 'warning' | 'danger';
}

const LEVEL_STYLES: Record<string, string> = {
  info:    'bg-blue-600 text-white',
  warning: 'bg-yellow-500 text-black',
  danger:  'bg-red-600 text-white',
};

export function AnnouncementBar({ enabled, text, level }: Props) {
  if (!enabled || !text.trim()) return null;
  return (
    <div className={`w-full py-2 px-4 text-center text-sm font-medium ${LEVEL_STYLES[level] ?? LEVEL_STYLES.info}`}>
      {text}
    </div>
  );
}
