import { config } from './config';

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!config.turnstileSecret) return true;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: config.turnstileSecret, response: token, remoteip: ip }),
  });
  const data = await res.json() as { success: boolean };
  return data.success === true;
}
