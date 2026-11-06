import nodemailer from 'nodemailer';

function frontendOrigin(): string {
  return process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
}

// Render's free services can't use SMTP ports, so email can go through Brevo's web API instead
async function sendWithBrevo(apiKey: string, to: string, subject: string, html: string) {
  const match = process.env.EMAIL_FROM?.match(/^\s*(.*?)\s*<(.+)>\s*$/);
  const sender = match
    ? { name: match[1] || 'resumIQ', email: match[2] }
    : { name: 'resumIQ', email: process.env.EMAIL_FROM };
  if (!sender.email) {
    throw new Error('EMAIL_FROM is not configured');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // The status is enough to diagnose this, and the body could repeat the address
    throw new Error(`Brevo returned status ${response.status}`);
  }
}

async function sendEmail(to: string, subject: string, intro: string, action: string, link: string, footer: string) {
  const { BREVO_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM, NODE_ENV } = process.env;

  if (BREVO_API_KEY) {
    await sendWithBrevo(BREVO_API_KEY, to, subject, `<p>${intro}</p><p><a href="${link}">${action}</a></p><p>${footer}</p>`);
    return;
  }

  if (!SMTP_HOST) {
    // Links are credentials, so they may only ever be logged during local development
    if (NODE_ENV === 'production') {
      throw new Error('SMTP_HOST is not configured');
    }
    console.log(`[dev email, SMTP not configured] ${subject}: ${link}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  await transport.sendMail({
    from: EMAIL_FROM || 'no-reply@localhost',
    to,
    subject,
    text: `${intro}\n\n${action}: ${link}\n\n${footer}`,
    html: `<p>${intro}</p><p><a href="${link}">${action}</a></p><p>${footer}</p>`,
  });
}

// Tokens go in the URL fragment, which browsers never send to servers or in Referer headers
export function sendVerificationEmail(to: string, token: string) {
  return sendEmail(
    to,
    'Verify your email address',
    'Please confirm your email address for your resumIQ account.',
    'Verify email',
    `${frontendOrigin()}/#verify-email=${token}`,
    "This link expires in 24 hours. If you didn't create an account, ignore this email and don't click the link."
  );
}

export function sendPasswordResetEmail(to: string, token: string) {
  return sendEmail(
    to,
    'Reset your password',
    'We received a request to reset the password for your resumIQ account.',
    'Reset password',
    `${frontendOrigin()}/#reset-password=${token}`,
    "This link expires in 1 hour and signs you out everywhere. If you didn't request it, you can ignore this email."
  );
}
