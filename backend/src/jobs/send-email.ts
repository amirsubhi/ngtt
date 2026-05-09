import { sendMail } from '../lib/mail';
import { logger } from '../lib/logger';

interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(data: SendEmailPayload): Promise<void> {
  try {
    await sendMail(data.to, data.subject, data.html);
  } catch (err) {
    logger.error(err, 'sendEmail job failed');
    throw err; // re-throw so BullMQ retries
  }
}
