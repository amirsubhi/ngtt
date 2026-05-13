import Link from 'next/link';

interface Props { text: string; }

const LEGAL_LINKS = [
  { href: '/p/terms',   label: 'Terms' },
  { href: '/p/dmca',    label: 'DMCA' },
  { href: '/p/support', label: 'Support' },
];

export function Footer({ text }: Props) {
  return (
    <footer className="mt-auto py-4 text-center text-xs opacity-50 space-y-1">
      <div className="flex items-center justify-center gap-4">
        {LEGAL_LINKS.map(l => (
          <Link key={l.href} href={l.href} className="hover:opacity-80 transition-opacity">
            {l.label}
          </Link>
        ))}
      </div>
      {text.trim() && <p>{text}</p>}
      <p>Powered by NGTT</p>
    </footer>
  );
}
