export interface Setting {
  key: string;
  value: string;
  type: string;
  category: string;
  label: string;
}

export type Tab =
  | 'general' | 'registration' | 'security' | 'tracker'
  | 'features' | 'economy' | 'community' | 'pruning' | 'branding' | 'moderation';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'general',      label: 'General' },
  { key: 'registration', label: 'Registration' },
  { key: 'security',     label: 'Security' },
  { key: 'tracker',      label: 'Tracker' },
  { key: 'features',     label: 'Features' },
  { key: 'economy',      label: 'Economy' },
  { key: 'community',    label: 'Community' },
  { key: 'pruning',      label: 'Pruning' },
  { key: 'branding',     label: 'Branding' },
  { key: 'moderation',   label: 'Moderation' },
];

export const JSON_KEYS = new Set(['email_domain_blacklist', 'prune_exempt_classes']);
export const WORDLIST_KEYS = new Set(['bad_words']);

export const SELECT_FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  default_theme: [
    { value: 'void',   label: 'Void (default dark)' },
    { value: 'pulse',  label: 'Pulse' },
    { value: 'cipher', label: 'Cipher' },
    { value: 'nebula', label: 'Nebula' },
    { value: 'ember',  label: 'Ember' },
    { value: 'lumen',  label: 'Lumen (light)' },
    { value: 'sand',   label: 'Sand (light)' },
    { value: 'cobalt', label: 'Cobalt' },
  ],
  default_locale: [
    { value: 'en',    label: 'English' },
    { value: 'zh-CN', label: '中文 (Chinese)' },
    { value: 'es',    label: 'Español (Spanish)' },
    { value: 'pt-BR', label: 'Português (Portuguese)' },
    { value: 'ar',    label: 'العربية (Arabic)' },
    { value: 'ms-MY', label: 'Bahasa Melayu (Malay)' },
  ],
  captcha_provider: [
    { value: 'turnstile', label: 'Cloudflare Turnstile' },
    { value: 'recaptcha', label: 'Google reCAPTCHA v2' },
    { value: 'none',      label: 'Disabled' },
  ],
  announcement_level: [
    { value: 'info',    label: 'Info (blue)' },
    { value: 'warning', label: 'Warning (amber)' },
    { value: 'danger',  label: 'Danger (red)' },
  ],
};
