const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface PublicSettings {
  site_name?: string;
  site_description?: string;
  site_logo_url?: string;
  site_favicon_url?: string;
  login_message?: string;
  announcement_enabled?: string;
  announcement_text?: string;
  announcement_level?: string;
  footer_text?: string;
  registration_open?: string;
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  try {
    const res = await fetch(`${BACKEND}/api/public/settings`, { next: { revalidate: 60 } });
    if (!res.ok) return {};
    const data = await res.json() as { settings: Record<string, string> };
    return data.settings as PublicSettings;
  } catch {
    return {};
  }
}
