import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { logger } from './logger';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  const pubClient = new Redis(config.redisUrl);
  const subClient = pubClient.duplicate();

  io = new Server(httpServer, {
    cors: { origin: config.frontendUrl, credentials: true },
  });

  io.adapter(createAdapter(pubClient, subClient));

  pubClient.on('error', err => logger.error(err, 'socket redis pub error'));
  subClient.on('error', err => logger.error(err, 'socket redis sub error'));

  logger.info('Socket.io initialized');
  return io;
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

export function verifySocketToken(token: string): { sub: number; username: string } {
  return jwt.verify(token, config.jwtAccessSecret) as unknown as { sub: number; username: string };
}
