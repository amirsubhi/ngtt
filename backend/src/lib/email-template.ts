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
    'zh-CN': {
      subject: '欢迎加入 NGTT',
      html: base('欢迎加入 NGTT', `
        ${H('欢迎加入 NGTT，{{username}}！')}
        ${P('您的账户已创建。请验证您的电子邮件地址以开始使用该网站。')}
        ${BTN('{{verify_link}}', '验证邮箱')}
        ${P('此链接将在 24 小时后失效。如果您没有创建账户，请忽略此邮件。')}
      `),
    },
    es: {
      subject: 'Bienvenido a NGTT',
      html: base('Bienvenido a NGTT', `
        ${H('¡Bienvenido a NGTT, {{username}}!')}
        ${P('Tu cuenta ha sido creada. Por favor, verifica tu dirección de correo electrónico para comenzar a usar el sitio.')}
        ${BTN('{{verify_link}}', 'Verificar Email')}
        ${P('Este enlace expira en 24 horas. Si no creaste una cuenta, puedes ignorar este correo.')}
      `),
    },
    'pt-BR': {
      subject: 'Bem-vindo ao NGTT',
      html: base('Bem-vindo ao NGTT', `
        ${H('Bem-vindo ao NGTT, {{username}}!')}
        ${P('Sua conta foi criada. Por favor, verifique seu endereço de e-mail para começar a usar o site.')}
        ${BTN('{{verify_link}}', 'Verificar E-mail')}
        ${P('Este link expira em 24 horas. Se você não criou uma conta, pode ignorar este e-mail.')}
      `),
    },
    ar: {
      subject: 'مرحباً بك في NGTT',
      html: base('مرحباً بك في NGTT', `
        ${H('مرحباً بك في NGTT، {{username}}!')}
        ${P('تم إنشاء حسابك. يرجى التحقق من عنوان بريدك الإلكتروني للبدء في استخدام الموقع.')}
        ${BTN('{{verify_link}}', 'تحقق من البريد الإلكتروني')}
        ${P('ينتهي صلاحية هذا الرابط خلال 24 ساعة. إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذا البريد الإلكتروني.')}
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
    'zh-CN': {
      subject: '验证您的邮箱 — NGTT',
      html: base('验证您的邮箱', `
        ${H('验证您的电子邮件地址')}
        ${P('您好 {{username}}，请点击下方按钮验证您的 NGTT 账户。')}
        ${BTN('{{verify_link}}', '验证邮箱')}
        ${P('此链接将在 24 小时后失效。如果您没有在 NGTT 注册，请忽略此邮件。')}
      `),
    },
    es: {
      subject: 'Verifica tu email — NGTT',
      html: base('Verifica tu email', `
        ${H('Verifica tu dirección de correo electrónico')}
        ${P('Hola {{username}}, haz clic en el botón de abajo para verificar tu cuenta de NGTT.')}
        ${BTN('{{verify_link}}', 'Verificar Email')}
        ${P('Este enlace expira en 24 horas. Si no te registraste en NGTT, puedes ignorar este correo.')}
      `),
    },
    'pt-BR': {
      subject: 'Verifique seu e-mail — NGTT',
      html: base('Verifique seu e-mail', `
        ${H('Verifique seu endereço de e-mail')}
        ${P('Olá {{username}}, clique no botão abaixo para verificar sua conta NGTT.')}
        ${BTN('{{verify_link}}', 'Verificar E-mail')}
        ${P('Este link expira em 24 horas. Se você não se registrou no NGTT, pode ignorar este e-mail.')}
      `),
    },
    ar: {
      subject: 'تحقق من بريدك الإلكتروني — NGTT',
      html: base('تحقق من بريدك الإلكتروني', `
        ${H('تحقق من عنوان بريدك الإلكتروني')}
        ${P('مرحباً {{username}}، انقر على الزر أدناه للتحقق من حساب NGTT الخاص بك.')}
        ${BTN('{{verify_link}}', 'تحقق من البريد الإلكتروني')}
        ${P('ينتهي صلاحية هذا الرابط خلال 24 ساعة. إذا لم تسجل في NGTT، يمكنك تجاهل هذا البريد الإلكتروني.')}
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
    'zh-CN': {
      subject: '重置密码 — NGTT',
      html: base('重置密码', `
        ${H('重置您的密码')}
        ${P('您好 {{username}}，我们收到了重置您 NGTT 密码的请求。')}
        ${BTN('{{reset_link}}', '重置密码')}
        ${P('此链接将在 1 小时后失效。如果您没有请求重置密码，请忽略此邮件，您的密码不会更改。')}
      `),
    },
    es: {
      subject: 'Restablece tu contraseña — NGTT',
      html: base('Restablece tu contraseña', `
        ${H('Restablece tu contraseña')}
        ${P('Hola {{username}}, recibimos una solicitud para restablecer tu contraseña de NGTT.')}
        ${BTN('{{reset_link}}', 'Restablecer Contraseña')}
        ${P('Este enlace expira en 1 hora. Si no solicitaste un restablecimiento de contraseña, puedes ignorar este correo — tu contraseña no cambiará.')}
      `),
    },
    'pt-BR': {
      subject: 'Redefina sua senha — NGTT',
      html: base('Redefina sua senha', `
        ${H('Redefina sua senha')}
        ${P('Olá {{username}}, recebemos uma solicitação para redefinir sua senha do NGTT.')}
        ${BTN('{{reset_link}}', 'Redefinir Senha')}
        ${P('Este link expira em 1 hora. Se você não solicitou uma redefinição de senha, pode ignorar este e-mail — sua senha não será alterada.')}
      `),
    },
    ar: {
      subject: 'إعادة تعيين كلمة المرور — NGTT',
      html: base('إعادة تعيين كلمة المرور', `
        ${H('إعادة تعيين كلمة المرور')}
        ${P('مرحباً {{username}}، تلقينا طلباً لإعادة تعيين كلمة مرور NGTT الخاصة بك.')}
        ${BTN('{{reset_link}}', 'إعادة تعيين كلمة المرور')}
        ${P('ينتهي صلاحية هذا الرابط خلال ساعة واحدة. إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني — لن تتغير كلمة مرورك.')}
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
    'zh-CN': {
      subject: 'Hit & Run 警告 — NGTT',
      html: base('Hit & Run 警告', `
        ${H('Hit & Run 警告')}
        ${P('您好 {{username}}，您的账户上有 {{count}} 个已到期的 Hit & Run。')}
        ${P('您必须将下载的种子做种至少 1:1 的比率或最低做种时间。不遵守规定可能导致账户被暂停。')}
        ${BTN('{{site_url}}/user/{{username}}', '查看我的 H&R')}
      `),
    },
    es: {
      subject: 'Advertencia Hit & Run — NGTT',
      html: base('Advertencia Hit & Run', `
        ${H('Advertencia Hit & Run')}
        ${P('Hola {{username}}, tienes {{count}} Hit & Run(s) vencidos en tu cuenta.')}
        ${P('Debes sembrar los torrents que descargues hasta al menos una proporción 1:1 o por un período mínimo de siembra. El incumplimiento puede resultar en la suspensión de la cuenta.')}
        ${BTN('{{site_url}}/user/{{username}}', 'Ver mis H&Rs')}
      `),
    },
    'pt-BR': {
      subject: 'Aviso de Hit & Run — NGTT',
      html: base('Aviso de Hit & Run', `
        ${H('Aviso de Hit & Run')}
        ${P('Olá {{username}}, você tem {{count}} Hit & Run(s) expirados em sua conta.')}
        ${P('Você deve semear os torrents que baixar até pelo menos a proporção 1:1 ou por um período mínimo de semeadura. O não cumprimento pode resultar na suspensão da conta.')}
        ${BTN('{{site_url}}/user/{{username}}', 'Ver meus H&Rs')}
      `),
    },
    ar: {
      subject: 'تحذير Hit & Run — NGTT',
      html: base('تحذير Hit & Run', `
        ${H('تحذير Hit & Run')}
        ${P('مرحباً {{username}}، لديك {{count}} مخالفة Hit & Run منتهية الصلاحية في حسابك.')}
        ${P('يجب عليك بذر التورنتات التي تقوم بتنزيلها حتى نسبة 1:1 على الأقل أو لفترة بذر دنيا. قد يؤدي عدم الامتثال إلى تعليق الحساب.')}
        ${BTN('{{site_url}}/user/{{username}}', 'عرض مخالفاتي')}
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
    'zh-CN': {
      subject: '账户已暂停 — NGTT',
      html: base('账户已暂停', `
        ${H('您的账户已被暂停')}
        ${P('您好 {{username}}，您的 NGTT 账户已被暂停。')}
        ${P('原因：{{reason}}')}
        ${P('如果您认为这是错误，请联系工作人员。')}
      `),
    },
    es: {
      subject: 'Cuenta Suspendida — NGTT',
      html: base('Cuenta Suspendida', `
        ${H('Tu cuenta ha sido suspendida')}
        ${P('Hola {{username}}, tu cuenta de NGTT ha sido suspendida.')}
        ${P('Motivo: {{reason}}')}
        ${P('Si crees que esto es un error, por favor contacta al personal.')}
      `),
    },
    'pt-BR': {
      subject: 'Conta Suspensa — NGTT',
      html: base('Conta Suspensa', `
        ${H('Sua conta foi suspensa')}
        ${P('Olá {{username}}, sua conta do NGTT foi suspensa.')}
        ${P('Motivo: {{reason}}')}
        ${P('Se você acredita que isso é um erro, entre em contato com a equipe.')}
      `),
    },
    ar: {
      subject: 'تم تعليق الحساب — NGTT',
      html: base('تم تعليق الحساب', `
        ${H('تم تعليق حسابك')}
        ${P('مرحباً {{username}}، تم تعليق حساب NGTT الخاص بك.')}
        ${P('السبب: {{reason}}')}
        ${P('إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع الفريق.')}
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
    'zh-CN': {
      subject: '不活跃警告 — NGTT',
      html: base('不活跃警告', `
        ${H('您的账户处于不活跃状态')}
        ${P('您好 {{username}}，您的 NGTT 账户已超过 {{days}} 天未活跃。')}
        ${P('请登录以保持账户活跃。不活跃超过 {{prune_days}} 天的账户将被禁用。')}
        ${BTN('{{site_url}}/login', '立即登录')}
      `),
    },
    es: {
      subject: 'Advertencia de Inactividad — NGTT',
      html: base('Advertencia de Inactividad', `
        ${H('Tu cuenta está inactiva')}
        ${P('Hola {{username}}, tu cuenta de NGTT ha estado inactiva por más de {{days}} días.')}
        ${P('Por favor inicia sesión para mantener tu cuenta activa. Las cuentas inactivas por {{prune_days}} días serán desactivadas.')}
        ${BTN('{{site_url}}/login', 'Iniciar Sesión')}
      `),
    },
    'pt-BR': {
      subject: 'Aviso de Inatividade — NGTT',
      html: base('Aviso de Inatividade', `
        ${H('Sua conta está inativa')}
        ${P('Olá {{username}}, sua conta do NGTT está inativa há mais de {{days}} dias.')}
        ${P('Por favor, faça login para manter sua conta ativa. Contas inativas por {{prune_days}} dias serão desativadas.')}
        ${BTN('{{site_url}}/login', 'Entrar Agora')}
      `),
    },
    ar: {
      subject: 'تحذير من عدم النشاط — NGTT',
      html: base('تحذير من عدم النشاط', `
        ${H('حسابك غير نشط')}
        ${P('مرحباً {{username}}، حساب NGTT الخاص بك غير نشط منذ أكثر من {{days}} يوماً.')}
        ${P('يرجى تسجيل الدخول للحفاظ على نشاط حسابك. ستُعطَّل الحسابات غير النشطة لمدة {{prune_days}} يوماً.')}
        ${BTN('{{site_url}}/login', 'تسجيل الدخول الآن')}
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

  'invite': {
    en: {
      subject: "You've been invited to NGTT",
      html: base("You're invited to NGTT", `
        ${H("You've been invited to NGTT")}
        ${P('{{sender_username}} has invited you to join NGTT, a private BitTorrent tracker.')}
        ${BTN('{{invite_link}}', 'Create Your Account')}
        ${P('This invite expires in 7 days. If you did not expect this invitation, you can safely ignore this email.')}
      `),
    },
    'zh-CN': {
      subject: '您被邀请加入 NGTT',
      html: base('您被邀请加入 NGTT', `
        ${H('您被邀请加入 NGTT')}
        ${P('{{sender_username}} 邀请您加入 NGTT，一个私人 BitTorrent 追踪器。')}
        ${BTN('{{invite_link}}', '创建您的账户')}
        ${P('此邀请将在 7 天后失效。如果您没有预期此邀请，可以安全地忽略此邮件。')}
      `),
    },
    es: {
      subject: 'Has sido invitado a NGTT',
      html: base('Estás invitado a NGTT', `
        ${H('Has sido invitado a NGTT')}
        ${P('{{sender_username}} te ha invitado a unirte a NGTT, un tracker privado de BitTorrent.')}
        ${BTN('{{invite_link}}', 'Crear Tu Cuenta')}
        ${P('Esta invitación expira en 7 días. Si no esperabas esta invitación, puedes ignorar este correo.')}
      `),
    },
    'pt-BR': {
      subject: 'Você foi convidado para o NGTT',
      html: base('Você foi convidado para o NGTT', `
        ${H('Você foi convidado para o NGTT')}
        ${P('{{sender_username}} convidou você a se juntar ao NGTT, um tracker privado de BitTorrent.')}
        ${BTN('{{invite_link}}', 'Criar Sua Conta')}
        ${P('Este convite expira em 7 dias. Se você não esperava este convite, pode ignorar este e-mail.')}
      `),
    },
    ar: {
      subject: 'تمت دعوتك للانضمام إلى NGTT',
      html: base('تمت دعوتك للانضمام إلى NGTT', `
        ${H('تمت دعوتك للانضمام إلى NGTT')}
        ${P('قام {{sender_username}} بدعوتك للانضمام إلى NGTT، متتبع BitTorrent خاص.')}
        ${BTN('{{invite_link}}', 'إنشاء حسابك')}
        ${P('تنتهي صلاحية هذه الدعوة خلال 7 أيام. إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني.')}
      `),
    },
    'ms-MY': {
      subject: 'Anda dijemput ke NGTT',
      html: base('Anda dijemput ke NGTT', `
        ${H('Anda dijemput ke NGTT')}
        ${P('{{sender_username}} telah menjemput anda untuk menyertai NGTT, sebuah tracker BitTorrent peribadi.')}
        ${BTN('{{invite_link}}', 'Buat Akaun Anda')}
        ${P('Jemputan ini tamat tempoh dalam 7 hari. Jika anda tidak menjangkakan jemputan ini, abaikan e-mel ini.')}
      `),
    },
  },

  'staff-warning': {
    en: {
      subject: 'Warning Issued — NGTT',
      html: base('Warning Issued', `
        ${H('You have received a warning')}
        ${P('Hi {{username}}, a staff member has issued a warning on your NGTT account.')}
        ${P('Reason: {{reason}}')}
        ${P('Please review our rules and ensure your activity complies with site policy. Repeated violations may result in account suspension.')}
        ${BTN('{{site_url}}/support', 'Contact Support')}
      `),
    },
    'zh-CN': {
      subject: '警告通知 — NGTT',
      html: base('警告通知', `
        ${H('您收到了一条警告')}
        ${P('您好 {{username}}，一名工作人员已对您的 NGTT 账户发出警告。')}
        ${P('原因：{{reason}}')}
        ${P('请查看我们的规则，确保您的活动符合网站政策。多次违规可能导致账户被暂停。')}
        ${BTN('{{site_url}}/support', '联系支持')}
      `),
    },
    es: {
      subject: 'Advertencia Emitida — NGTT',
      html: base('Advertencia Emitida', `
        ${H('Has recibido una advertencia')}
        ${P('Hola {{username}}, un miembro del personal ha emitido una advertencia en tu cuenta de NGTT.')}
        ${P('Motivo: {{reason}}')}
        ${P('Por favor revisa nuestras reglas y asegúrate de que tu actividad cumpla con la política del sitio. Las infracciones repetidas pueden resultar en la suspensión de la cuenta.')}
        ${BTN('{{site_url}}/support', 'Contactar Soporte')}
      `),
    },
    'pt-BR': {
      subject: 'Aviso Emitido — NGTT',
      html: base('Aviso Emitido', `
        ${H('Você recebeu um aviso')}
        ${P('Olá {{username}}, um membro da equipe emitiu um aviso em sua conta do NGTT.')}
        ${P('Motivo: {{reason}}')}
        ${P('Por favor, revise nossas regras e garanta que sua atividade esteja em conformidade com a política do site. Violações repetidas podem resultar na suspensão da conta.')}
        ${BTN('{{site_url}}/support', 'Contatar Suporte')}
      `),
    },
    ar: {
      subject: 'تحذير صادر — NGTT',
      html: base('تحذير صادر', `
        ${H('لقد تلقيت تحذيراً')}
        ${P('مرحباً {{username}}، قام أحد أعضاء الفريق بإصدار تحذير على حساب NGTT الخاص بك.')}
        ${P('السبب: {{reason}}')}
        ${P('يرجى مراجعة قواعدنا والتأكد من أن نشاطك يتوافق مع سياسة الموقع. قد تؤدي الانتهاكات المتكررة إلى تعليق الحساب.')}
        ${BTN('{{site_url}}/support', 'التواصل مع الدعم')}
      `),
    },
    'ms-MY': {
      subject: 'Amaran Dikeluarkan — NGTT',
      html: base('Amaran Dikeluarkan', `
        ${H('Anda telah menerima amaran')}
        ${P('Hai {{username}}, seorang kakitangan telah mengeluarkan amaran pada akaun NGTT anda.')}
        ${P('Sebab: {{reason}}')}
        ${P('Sila semak peraturan kami dan pastikan aktiviti anda mematuhi dasar laman. Pelanggaran berulang boleh mengakibatkan penggantungan akaun.')}
        ${BTN('{{site_url}}/support', 'Hubungi Sokongan')}
      `),
    },
  },

  'pm-notification': {
    en: {
      subject: 'New message from {{sender_username}} — NGTT',
      html: base('New Private Message', `
        ${H('You have a new message')}
        ${P('Hi {{username}}, you have received a private message from {{sender_username}} on NGTT.')}
        ${P('<em style="color:#737373;">{{preview}}</em>')}
        ${BTN('{{site_url}}/messages', 'Read Message')}
        ${P('You can manage email notification preferences in your account settings.')}
      `),
    },
    'zh-CN': {
      subject: '来自 {{sender_username}} 的新消息 — NGTT',
      html: base('新私信', `
        ${H('您有一条新消息')}
        ${P('您好 {{username}}，您在 NGTT 上收到了来自 {{sender_username}} 的私信。')}
        ${P('<em style="color:#737373;">{{preview}}</em>')}
        ${BTN('{{site_url}}/messages', '阅读消息')}
        ${P('您可以在账户设置中管理电子邮件通知偏好。')}
      `),
    },
    es: {
      subject: 'Nuevo mensaje de {{sender_username}} — NGTT',
      html: base('Nuevo Mensaje Privado', `
        ${H('Tienes un nuevo mensaje')}
        ${P('Hola {{username}}, has recibido un mensaje privado de {{sender_username}} en NGTT.')}
        ${P('<em style="color:#737373;">{{preview}}</em>')}
        ${BTN('{{site_url}}/messages', 'Leer Mensaje')}
        ${P('Puedes gestionar las preferencias de notificación por correo en la configuración de tu cuenta.')}
      `),
    },
    'pt-BR': {
      subject: 'Nova mensagem de {{sender_username}} — NGTT',
      html: base('Nova Mensagem Privada', `
        ${H('Você tem uma nova mensagem')}
        ${P('Olá {{username}}, você recebeu uma mensagem privada de {{sender_username}} no NGTT.')}
        ${P('<em style="color:#737373;">{{preview}}</em>')}
        ${BTN('{{site_url}}/messages', 'Ler Mensagem')}
        ${P('Você pode gerenciar as preferências de notificação por e-mail nas configurações da sua conta.')}
      `),
    },
    ar: {
      subject: 'رسالة جديدة من {{sender_username}} — NGTT',
      html: base('رسالة خاصة جديدة', `
        ${H('لديك رسالة جديدة')}
        ${P('مرحباً {{username}}، تلقيت رسالة خاصة من {{sender_username}} على NGTT.')}
        ${P('<em style="color:#737373;">{{preview}}</em>')}
        ${BTN('{{site_url}}/messages', 'قراءة الرسالة')}
        ${P('يمكنك إدارة تفضيلات الإشعارات عبر البريد الإلكتروني في إعدادات حسابك.')}
      `),
    },
    'ms-MY': {
      subject: 'Mesej baru dari {{sender_username}} — NGTT',
      html: base('Mesej Peribadi Baru', `
        ${H('Anda mempunyai mesej baru')}
        ${P('Hai {{username}}, anda telah menerima mesej peribadi dari {{sender_username}} di NGTT.')}
        ${P('<em style="color:#737373;">{{preview}}</em>')}
        ${BTN('{{site_url}}/messages', 'Baca Mesej')}
        ${P('Anda boleh mengurus pilihan pemberitahuan e-mel dalam tetapan akaun anda.')}
      `),
    },
  },

  'promotion': {
    en: {
      subject: 'Congratulations! You have been promoted — NGTT',
      html: base('Account Promoted', `
        ${H('Congratulations, {{username}}!')}
        ${P('Your NGTT account has been promoted to <strong style="color:#ededed;">{{group_name}}</strong>.')}
        ${P('You now have access to additional site features and privileges. Keep up the great work!')}
        ${BTN('{{site_url}}/settings', 'View My Account')}
      `),
    },
    'zh-CN': {
      subject: '恭喜！您已晋级 — NGTT',
      html: base('账户晋级', `
        ${H('恭喜，{{username}}！')}
        ${P('您的 NGTT 账户已晋级至 <strong style="color:#ededed;">{{group_name}}</strong>。')}
        ${P('您现在可以访问更多网站功能和权限。继续保持！')}
        ${BTN('{{site_url}}/settings', '查看我的账户')}
      `),
    },
    es: {
      subject: '¡Felicidades! Has sido promovido — NGTT',
      html: base('Cuenta Promovida', `
        ${H('¡Felicidades, {{username}}!')}
        ${P('Tu cuenta de NGTT ha sido promovida a <strong style="color:#ededed;">{{group_name}}</strong>.')}
        ${P('Ahora tienes acceso a características y privilegios adicionales del sitio. ¡Sigue así!')}
        ${BTN('{{site_url}}/settings', 'Ver Mi Cuenta')}
      `),
    },
    'pt-BR': {
      subject: 'Parabéns! Você foi promovido — NGTT',
      html: base('Conta Promovida', `
        ${H('Parabéns, {{username}}!')}
        ${P('Sua conta do NGTT foi promovida para <strong style="color:#ededed;">{{group_name}}</strong>.')}
        ${P('Agora você tem acesso a recursos e privilégios adicionais do site. Continue assim!')}
        ${BTN('{{site_url}}/settings', 'Ver Minha Conta')}
      `),
    },
    ar: {
      subject: 'تهانينا! تمت ترقيتك — NGTT',
      html: base('ترقية الحساب', `
        ${H('تهانينا، {{username}}!')}
        ${P('تمت ترقية حساب NGTT الخاص بك إلى <strong style="color:#ededed;">{{group_name}}</strong>.')}
        ${P('أصبح بإمكانك الآن الوصول إلى ميزات وامتيازات إضافية في الموقع. استمر في العمل الرائع!')}
        ${BTN('{{site_url}}/settings', 'عرض حسابي')}
      `),
    },
    'ms-MY': {
      subject: 'Tahniah! Anda telah dinaikkan pangkat — NGTT',
      html: base('Akaun Dinaikkan Pangkat', `
        ${H('Tahniah, {{username}}!')}
        ${P('Akaun NGTT anda telah dinaikkan ke <strong style="color:#ededed;">{{group_name}}</strong>.')}
        ${P('Anda kini mempunyai akses kepada ciri-ciri dan keistimewaan laman tambahan. Teruskan kerja yang baik!')}
        ${BTN('{{site_url}}/settings', 'Lihat Akaun Saya')}
      `),
    },
  },

  'torrent-approved': {
    en: {
      subject: 'Your torrent has been approved — NGTT',
      html: base('Torrent Approved', `
        ${H('Your torrent has been approved!')}
        ${P('Hi {{username}}, your upload "<strong style="color:#ededed;">{{torrent_name}}</strong>" has been reviewed and approved by staff.')}
        ${P('It is now live on the site and available for members to download.')}
        ${BTN('{{torrent_url}}', 'View Torrent')}
      `),
    },
    'zh-CN': {
      subject: '您的种子已通过审核 — NGTT',
      html: base('种子已审核通过', `
        ${H('您的种子已通过审核！')}
        ${P('您好 {{username}}，您上传的"<strong style="color:#ededed;">{{torrent_name}}</strong>"已由工作人员审核并批准。')}
        ${P('它现在已在网站上线，成员可以下载。')}
        ${BTN('{{torrent_url}}', '查看种子')}
      `),
    },
    es: {
      subject: 'Tu torrent ha sido aprobado — NGTT',
      html: base('Torrent Aprobado', `
        ${H('¡Tu torrent ha sido aprobado!')}
        ${P('Hola {{username}}, tu subida "<strong style="color:#ededed;">{{torrent_name}}</strong>" ha sido revisada y aprobada por el personal.')}
        ${P('Ahora está disponible en el sitio para que los miembros lo descarguen.')}
        ${BTN('{{torrent_url}}', 'Ver Torrent')}
      `),
    },
    'pt-BR': {
      subject: 'Seu torrent foi aprovado — NGTT',
      html: base('Torrent Aprovado', `
        ${H('Seu torrent foi aprovado!')}
        ${P('Olá {{username}}, seu upload "<strong style="color:#ededed;">{{torrent_name}}</strong>" foi revisado e aprovado pela equipe.')}
        ${P('Agora está disponível no site para os membros baixarem.')}
        ${BTN('{{torrent_url}}', 'Ver Torrent')}
      `),
    },
    ar: {
      subject: 'تمت الموافقة على تورنتك — NGTT',
      html: base('تمت الموافقة على التورنت', `
        ${H('تمت الموافقة على تورنتك!')}
        ${P('مرحباً {{username}}، تمت مراجعة رفعك "<strong style="color:#ededed;">{{torrent_name}}</strong>" والموافقة عليه من قبل الفريق.')}
        ${P('أصبح متاحاً الآن على الموقع ليتمكن الأعضاء من تنزيله.')}
        ${BTN('{{torrent_url}}', 'عرض التورنت')}
      `),
    },
    'ms-MY': {
      subject: 'Torrent anda telah diluluskan — NGTT',
      html: base('Torrent Diluluskan', `
        ${H('Torrent anda telah diluluskan!')}
        ${P('Hai {{username}}, muat naik anda "<strong style="color:#ededed;">{{torrent_name}}</strong>" telah disemak dan diluluskan oleh kakitangan.')}
        ${P('Ia kini tersedia di laman web untuk ahli memuat turun.')}
        ${BTN('{{torrent_url}}', 'Lihat Torrent')}
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
