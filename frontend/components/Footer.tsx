interface Props { text: string; }

export function Footer({ text }: Props) {
  if (!text.trim()) return null;
  return (
    <footer className="mt-auto py-4 text-center text-xs opacity-50">
      {text}
    </footer>
  );
}
