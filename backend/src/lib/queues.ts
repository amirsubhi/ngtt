import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from './config';

// Dedicated connection for BullMQ — must not reuse the shared redis instance
const bullConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

export const statsQueue = new Queue('stats', {
  connection: bullConnection,
  defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 },
});

export const jobsQueue = new Queue('jobs', {
  connection: bullConnection,
  defaultJobOptions: { removeOnComplete: 500, removeOnFail: 5000, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
});
