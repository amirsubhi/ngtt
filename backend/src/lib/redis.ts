import Redis from 'ioredis';
import { config } from './config';

export const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

export async function get(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function set(key: string, value: string): Promise<void> {
  await redis.set(key, value);
}

export async function setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
  await redis.setex(key, ttlSeconds, value);
}

export async function del(...keys: string[]): Promise<void> {
  await redis.del(...keys);
}

export async function lPush(key: string, ...values: string[]): Promise<void> {
  await redis.lpush(key, ...values);
}

export async function lTrim(key: string, start: number, stop: number): Promise<void> {
  await redis.ltrim(key, start, stop);
}

export async function lRange(key: string, start: number, stop: number): Promise<string[]> {
  return redis.lrange(key, start, stop);
}

export async function mGet(...keys: string[]): Promise<(string | null)[]> {
  return redis.mget(...keys);
}

export async function keys(pattern: string): Promise<string[]> {
  return redis.keys(pattern);
}

export async function incr(key: string): Promise<number> {
  return redis.incr(key);
}
