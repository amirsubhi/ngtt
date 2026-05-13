import { notFound } from 'next/navigation';

interface CustomPage {
  title: string;
  slug: string;
  body: string;
}

async function fetchPage(slug: string): Promise<CustomPage | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/public/pages/${encodeURIComponent(slug)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return res.json() as Promise<CustomPage>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await fetchPage(slug);
  return { title: page?.title ?? 'Page Not Found' };
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) notFound();

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight mb-6">{page.title}</h1>
      <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap opacity-90">
        {page.body}
      </div>
    </div>
  );
}
