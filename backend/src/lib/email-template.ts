import { config } from './config';

interface TemplateEntry {
  subject: string;
  html: string;
}

type TemplateMap = Record<string, Record<string, TemplateEntry>>;

function base(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;padding:0 16px;">
  <div style="background:#111;border:1px solid #222;border-radius:8px;overflow:hidden;">
    <div style="background:#111;border-bottom:1px solid #222;padding:20px 32px;">
      <span style="color:#ededed;font-size:18px;font-weight:700;letter-spacing:-0.5px;">NGTT</span>
    </div>
    <div style="padding:32px;">
      ${body}
    </div>
    <div style="padding:16px 32px;border-top:1px solid #222;">
      <p style="margin:0;color:#404040;font-size:12px;">
        This is an automated message from <a href="${config.frontendUrl}" style="color:#3b82f6;text-decoration:none;">NGTT</a>.
        Do not reply to this email.
      </p>
    </div>
  </div>
</div>
</body>
</html>`;
}

const P = (text: string) => `<p style="margin:0 0 16px;color:#a3a3a3;font-size:15px;line-height:1.6;">${text}</p>`;
const H = (text: string) => `<h2 style="margin:0 0 20px;color:#ededed;font-size:20px;font-weight:600;">${text}</h2>`;
const BTN = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;margin:8px 0 16px;">${label}</a>`;

const TEMPLATES: TemplateMap = {
  'welcome': {
    en: {
      subject: 'Welcome to NGTT',
      html: base('Welcome to NGTT', `
        ${H('Welcome to NGTT, {{username}}!')}
        ${P('Your account has been created. Please verify your email address to start using the site.')}
        ${BTN('{{verify_link}}', 'Verify Email')}
        ${P('This link expires in 24 hours. If you did not create an account, you can safely ignore this email.')}
      `),
    },
    'ms-MY': {
      subject: 'Selamat Datang ke NGTT',
      html: base('Selamat Datang ke NGTT', `
        ${H('Selamat datang ke NGTT, {{username}}!')}
        ${P('Akaun anda telah dibuat. Sila sahkan alamat e-mel anda untuk mula menggunakan laman ini.')}
        ${BTN('{{verify_link}}', 'Sahkan E-mel')}
        ${P('Pautan ini tamat tempoh dalam 24 jam. Jika anda tidak membuat akaun ini, abaikan e-mel ini.')}
      `),
    },
  },

  'verify-email': {
    en: {
      subject: 'Verify your email — NGTT',
      html: base('Verify your email', `
        ${H('Verify your email address')}
        ${P('Hi {{username}}, click the button below to verify your NGTT account.')}
        ${BTN('{{verify_link}}', 'Verify Email')}
        ${P('This link expires in 24 hours. If you did not register on NGTT, you can safely ignore this email.')}
      `),
    },
    'ms-MY': {
      subject: 'Sahkan e-mel anda — NGTT',
      html: base('Sahkan e-mel anda', `
        ${H('Sahkan alamat e-mel anda')}
        ${P('Hai {{username}}, klik butang di bawah untuk mengesahkan akaun NGTT anda.')}
        ${BTN('{{verify_link}}', 'Sahkan E-mel')}
        ${P('Pautan ini tamat tempoh dalam 24 jam. Jika anda tidak mendaftar di NGTT, abaikan e-mel ini.')}
      `),
    },
  },

  'password-reset': {
    en: {
      subject: 'Reset your password — NGTT',
      html: base('Reset your password', `
        ${H('Reset your password')}
        ${P('Hi {{username}}, we received a request to reset your NGTT password.')}
        ${BTN('{{reset_link}}', 'Reset Password')}
        ${P('This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your password will not change.')}
      `),
    },
    'ms-MY': {
      subject: 'Tetapkan semula kata laluan — NGTT',
      html: base('Tetapkan semula kata laluan', `
        ${H('Tetapkan semula kata laluan anda')}
        ${P('Hai {{username}}, kami menerima permintaan untuk menetapkan semula kata laluan NGTT anda.')}
        ${BTN('{{reset_link}}', 'Tetapkan Semula Kata Laluan')}
        ${P('Pautan ini tamat tempoh dalam 1 jam. Jika anda tidak meminta penetapan semula kata laluan, abaikan e-mel ini.')}
      `),
    },
  },

  'hnr-warning': {
    en: {
      subject: 'Hit & Run Warning — NGTT',
      html: base('Hit & Run Warning', `
        ${H('Hit & Run Warning')}
        ${P('Hi {{username}}, you have {{count}} expired Hit & Run(s) on your account.')}
        ${P('You must seed torrents you download to at least 1:1 ratio or for a minimum seeding period. Failure to comply may result in account suspension.')}
        ${P('Please log in to review your Hit & Run status.')}
        ${BTN('{{site_url}}/user/{{username}}', 'View My H&Rs')}
      `),
    },
    'ms-MY': {
      subject: 'Amaran Hit & Run — NGTT',
      html: base('Amaran Hit & Run', `
        ${H('Amaran Hit & Run')}
        ${P('Hai {{username}}, anda mempunyai {{count}} Hit & Run yang tamat tempoh dalam akaun anda.')}
        ${P('Anda mesti menyemai torrent yang anda muat turun sekurang-kurangnya nisbah 1:1 atau untuk tempoh penyemaian minimum. Kegagalan mematuhi boleh mengakibatkan penggantungan akaun.')}
        ${BTN('{{site_url}}/user/{{username}}', 'Lihat H&R Saya')}
      `),
    },
  },

  'ban-notice': {
    en: {
      subject: 'Account Suspended — NGTT',
      html: base('Account Suspended', `
        ${H('Your account has been suspended')}
        ${P('Hi {{username}}, your NGTT account has been suspended.')}
        ${P('Reason: {{reason}}')}
        ${P('If you believe this is a mistake, please contact staff.')}
      `),
    },
    'ms-MY': {
      subject: 'Akaun Digantung — NGTT',
      html: base('Akaun Digantung', `
        ${H('Akaun anda telah digantung')}
        ${P('Hai {{username}}, akaun NGTT anda telah digantung.')}
        ${P('Sebab: {{reason}}')}
        ${P('Jika anda percaya ini adalah kesilapan, sila hubungi kakitangan.')}
      `),
    },
  },

  'inactivity-warning': {
    en: {
      subject: 'Inactivity Warning — NGTT',
      html: base('Inactivity Warning', `
        ${H('Your account is inactive')}
        ${P('Hi {{username}}, your NGTT account has been inactive for over {{days}} days.')}
        ${P('Please log in to keep your account active. Accounts inactive for {{prune_days}} days will be disabled.')}
        ${BTN('{{site_url}}/login', 'Log In Now')}
      `),
    },
    'ms-MY': {
      subject: 'Amaran Tidak Aktif — NGTT',
      html: base('Amaran Tidak Aktif', `
        ${H('Akaun anda tidak aktif')}
        ${P('Hai {{username}}, akaun NGTT anda tidak aktif selama lebih {{days}} hari.')}
        ${P('Sila log masuk untuk mengekalkan akaun anda aktif. Akaun yang tidak aktif selama {{prune_days}} hari akan dilumpuhkan.')}
        ${BTN('{{site_url}}/login', 'Log Masuk Sekarang')}
      `),
    },
  },
};

export function renderEmail(
  templateName: string,
  locale: string,
  vars: Record<string, string>,
): { subject: string; html: string } {
  const tmpl = TEMPLATES[templateName];
  if (!tmpl) throw new Error(`Unknown email template: ${templateName}`);

  const entry = tmpl[locale] ?? tmpl['en'];
  if (!entry) throw new Error(`No template for ${templateName}/${locale} and no 'en' fallback`);

  const allVars: Record<string, string> = { site_url: config.frontendUrl, ...vars };

  function substitute(s: string): string {
    return s.replace(/\{\{(\w+)\}\}/g, (_, key: string) => allVars[key] ?? `{{${key}}}`);
  }

  return {
    subject: substitute(entry.subject),
    html: substitute(entry.html),
  };
}
