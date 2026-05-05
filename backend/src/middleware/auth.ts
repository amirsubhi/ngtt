import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../lib/config';
import { queryOne } from '../lib/db';
import { UnauthorizedError, ForbiddenError } from '../lib/errors';

interface JwtPayload {
  sub: number;
  username: string;
}

interface UserRow {
  id: number;
  username: string;
  group_id: number;
  is_staff: boolean;
  is_banned: boolean;
  slug: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow;
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();

  let payload: JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtAccessSecret) as unknown as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const user = await queryOne<UserRow>(
    `SELECT u.id, u.username, u.group_id, u.is_banned, ug.is_staff, ug.slug
     FROM users u JOIN user_groups ug ON ug.id = u.group_id
     WHERE u.id = ? AND u.is_deleted = FALSE`,
    [payload.sub],
  );
  if (!user) throw new UnauthorizedError();
  if (user.is_banned) throw new ForbiddenError('Account is banned');

  req.user = user;
}

export async function requireStaff(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!req.user?.is_staff) throw new ForbiddenError('Staff only');
}

export async function requireAdmin(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (req.user?.slug !== 'admin') throw new ForbiddenError('Admin only');
}
