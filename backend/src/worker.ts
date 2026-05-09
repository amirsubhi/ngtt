import 'dotenv/config';
import Redis from 'ioredis';
import { Worker } from 'bullmq';
import { config } from './lib/config';
import { logger } from './lib/logger';
import { jobsQueue } from './lib/queues';
import { writeAnnounceStats } from './jobs/write-announce-stats';
import { updateHnr } from './jobs/hnr-update';
import { earnFlux } from './jobs/flux-earn';
import { sendEmail } from './jobs/send-email';
import { createNotification } from './jobs/send-notif';
import { flagCheat } from './jobs/flag-cheat';
import { sendWelcomePm } from './jobs/welcome-pm';
import { parseMediaInfo } from './jobs/parse-mediainfo';
import { archiveShoutboxMsg } from './jobs/shoutbox-archive';
import { awardSeedingFlux } from './jobs/seed-rewards';
import { awardBirthdayFlux } from './jobs/birthdays';
import { checkExpiredHnr } from './jobs/hnr-check';
import { pruneUsers } from './jobs/prune-users';

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const statsWorker = new Worker(
  'stats',
  async job => {
    if (job.name === 'write-stats') {
      await writeAnnounceStats(job.data);
    }
  },
  { connection, concurrency: 5 },
);

const jobsWorker = new Worker(
  'jobs',
  async job => {
    switch (job.name) {
      case 'hnr-update':      return updateHnr(job.data);
      case 'flux-earn':       return earnFlux(job.data);
      case 'send-email':      return sendEmail(job.data);
      case 'send-notif':      return createNotification(job.data);
      case 'flag-cheat':      return flagCheat(job.data);
      case 'welcome-pm':      return sendWelcomePm(job.data);
      case 'parse-mediainfo': return parseMediaInfo(job.data);
      case 'shoutbox-archive':return archiveShoutboxMsg(job.data);
      case 'seed-rewards':    return awardSeedingFlux();
      case 'birthday-flux':   return awardBirthdayFlux();
      case 'hnr-check':       return checkExpiredHnr();
      case 'prune-users':    return pruneUsers();
      default:
        logger.warn({ name: job.name }, 'unknown job type');
    }
  },
  { connection, concurrency: 3 },
);

statsWorker.on('failed', (job, err) => logger.error({ job: job?.name, err }, 'stats job failed'));
jobsWorker.on('failed', (job, err) => logger.error({ job: job?.name, err }, 'jobs job failed'));

// Register repeatable cron jobs (idempotent — BullMQ deduplicates by key)
void jobsQueue.add('seed-rewards', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'seed-rewards-cron' });
void jobsQueue.add('birthday-flux', {}, { repeat: { pattern: '0 0 * * *' }, jobId: 'birthday-flux-cron' });
void jobsQueue.add('hnr-check', {}, { repeat: { pattern: '*/30 * * * *' }, jobId: 'hnr-check-cron' });
void jobsQueue.add('prune-users', {}, { repeat: { pattern: '0 3 * * *' }, jobId: 'prune-users-cron' });

logger.info('Worker process started');

async function shutdown(): Promise<void> {
  logger.info('Worker shutting down...');
  await statsWorker.close();
  await jobsWorker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });
