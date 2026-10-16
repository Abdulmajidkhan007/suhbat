import type { MailMessage } from './mailer';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Parolni tiklash xati (o'zbekcha, oddiy HTML + matn). */
export const passwordResetMail = (p: { to: string; displayName: string; link: string; ttlMinutes: number }): MailMessage => {
  const name = escapeHtml(p.displayName);
  const link = escapeHtml(p.link);
  return {
    to:      p.to,
    subject: 'Suhbat: parolni tiklash',
    text: [
      `Assalomu alaykum, ${p.displayName}!`,
      '',
      'Suhbat hisobingiz parolini tiklash so\'raldi. Yangi parol o\'rnatish uchun havolani oching:',
      p.link,
      '',
      `Havola ${p.ttlMinutes} daqiqa amal qiladi va faqat bir marta ishlaydi.`,
      'Agar buni siz so\'ramagan bo\'lsangiz — xatga e\'tibor bermang, parolingiz o\'zgarmaydi.',
      '',
      'Suhbat',
    ].join('\n'),
    html: `<!doctype html>
<html lang="uz">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
    <h1 style="margin:0 0 16px;font-size:20px;color:#3b82f6">Suhbat</h1>
    <p>Assalomu alaykum, ${name}!</p>
    <p>Suhbat hisobingiz parolini tiklash so'raldi. Yangi parol o'rnatish uchun tugmani bosing:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${link}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Yangi parol o'rnatish</a>
    </p>
    <p style="font-size:13px;color:#475569">Tugma ishlamasa, havolani brauzerga nusxalang:<br><a href="${link}" style="color:#3b82f6;word-break:break-all">${link}</a></p>
    <p style="font-size:13px;color:#475569">Havola ${p.ttlMinutes} daqiqa amal qiladi va faqat bir marta ishlaydi. Agar buni siz so'ramagan bo'lsangiz — xatga e'tibor bermang, parolingiz o'zgarmaydi.</p>
  </div>
</body>
</html>`,
  };
};
