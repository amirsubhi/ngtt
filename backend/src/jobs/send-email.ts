import { queryOne } from '../lib/db';
import { sendMail } from '../lib/mail';
import { renderEmail } from '../lib/email-template';
import { logger } from '../lib/logger';

interface SendEmailPayload {
  // Direct send — caller provides everything
  to?: string;
  subject?: string;
  html?: string;
  // Template-based — caller provides template name + vars
  to_user_id?: number;
  template?: string;
  locale?: string;
  vars?: Record<string, string>;
  // Plain-text body fallback (converted to simple HTML)
  body?: string;
}

export async function sendEmail(data: SendEmailPayload): Promise<void> {
  try {
    let to = data.to;
    let subject = data.subject ?? '';
    let html = data.html;

    // Resolve recipient from user_id if needed
    if (!to && data.to_user_id) {
      const user = await queryOne<{ email: string; username: string; locale: string | null }>(
        'SELECT u.email, u.username, up.locale FROM users u LEFT JOIN user_preferences up ON up.user_id = u.id WHERE u.id = ? LIMIT 1',
        [data.to_user_id],
      );
      if (!user) {
        logger.warn({ to_user_id: data.to_user_id }, 'sendEmail: user not found, skipping');
        return;
      }
      to = user.email;

      if (data.template) {
        const locale = data.locale ?? user.locale ?? 'en';
        const rendered = renderEmail(data.template, locale, {
          username: user.username,
          ...data.vars,
        });
        subject = rendered.subject;
        html = rendered.html;
      }
    }

    // Render template when recipient email already known (e.g. at registration)
    if (to && data.template && !html) {
      const rendered = renderEmail(data.template, data.locale ?? 'en', data.vars ?? {});
      subject = rendered.subject;
      html = rendered.html;
    }

    if (!to) {
      logger.warn(data, 'sendEmail: no recipient, skipping');
      return;
    }

    // Plain-text body fallback
    if (!html && data.body) {
      const escaped = data.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html = `<div style="font-family:sans-serif;color:#ededed;background:#111;padding:32px;border-radius:8px;">${escaped.split('\n').map(l => `<p style="margin:0 0 8px;">${l}</p>`).join('')}</div>`;
    }

    if (!html) {
      logger.warn(data, 'sendEmail: no html content, skipping');
      return;
    }

    await sendMail(to, subject, html);
  } catch (err) {
    logger.error(err, 'sendEmail job failed');
    throw err;
  }
}
