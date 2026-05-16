import { queryOne } from './db';
import { redis } from './redis';

const CACHE_KEY = 'bad_words_list';
const CACHE_TTL = 300; // 5 minutes

export const DEFAULT_WORDS = [
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

function buildPattern(words: string[]): RegExp | null {
  if (words.length === 0) return null;
  const escaped = words
    .filter(w => w.trim().length > 0)
    .sort((a, b) => b.length - a.length) // longest first to avoid partial-match cutoff
    .map(w => `\\b${w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  return escaped.length ? new RegExp(escaped.join('|'), 'gi') : null;
}

async function getWords(): Promise<string[]> {
  const cached = await redis.get(CACHE_KEY);
  if (cached !== null) return JSON.parse(cached) as string[];

  const row = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'bad_words'",
  );
  const words: string[] = row ? JSON.parse(row.value) : DEFAULT_WORDS;
  await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(words));
  return words;
}

export async function filterBadWords(text: string): Promise<string> {
  const words = await getWords();
  const pattern = buildPattern(words);
  if (!pattern) return text;
  return text.replace(pattern, match => '*'.repeat(match.length));
}

export async function invalidateBadWordsCache(): Promise<void> {
  await redis.del(CACHE_KEY);
}
