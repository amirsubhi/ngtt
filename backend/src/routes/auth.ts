import { FastifyInstance } from 'fastify';
import { registerRoute } from './auth/register';
import { loginRoute } from './auth/login';
import { tokenRoutes } from './auth/token';
import { passwordRoutes } from './auth/password';
import { passkeyRoutes } from './auth/passkey';
import { totpRoutes } from './auth/totp';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  await app.register(registerRoute);
  await app.register(loginRoute);
  await app.register(tokenRoutes);
  await app.register(passwordRoutes);
  await app.register(passkeyRoutes);
  await app.register(totpRoutes);
}
