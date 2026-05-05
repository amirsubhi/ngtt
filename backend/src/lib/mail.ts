import nodemailer from 'nodemailer';
import { config } from './config';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpPort === 465,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPass,
  },
});

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({ from: config.smtpFrom, to, subject, html });
    logger.info({ to, subject }, 'email sent');
  } catch (err) {
    logger.error({ err, to, subject }, 'email failed');
    throw err;
  }
}
