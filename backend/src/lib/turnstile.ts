import { queryOne } from './db';
import { config } from './config';

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const row = await queryOne<{ value: string }>(
    "SELECT value FROM site_settings WHERE `key` = 'turnstile_secret_key'",
  );
  const secret = row?.value || config.turnstileSecret;
  if (!secret) return true;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = await res.json() as { success: boolean };
  return data.success === true;
}
