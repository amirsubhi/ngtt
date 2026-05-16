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
