// Profanity filter — word list is intentionally short and maintainable.
// Add/remove terms here; patterns are compiled once at startup.

const BLOCKED = [
  'fuck', 'fucker', 'fucking', 'motherfucker',
  'shit', 'bullshit',
  'cunt',
  'dick', 'cock', 'pussy',
  'bitch', 'slut', 'whore',
  'asshole', 'arsehole',
  'bastard',
  'faggot', 'fag',
  'nigger', 'nigga',
  'retard',
  'piss',
];

const PATTERN = new RegExp(
  BLOCKED
    .sort((a, b) => b.length - a.length) // longest first to avoid partial matches
    .map(w => `\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    .join('|'),
  'gi',
);

export function filterBadWords(text: string): string {
  return text.replace(PATTERN, match => '*'.repeat(match.length));
}
