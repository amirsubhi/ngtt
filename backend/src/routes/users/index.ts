import { FastifyInstance } from 'fastify';
import { profileRoutes } from './profile';
import { userSettingsRoutes } from './settings';
import { accountRoutes } from './account';
import { opensubtitlesRoutes } from './opensubtitles';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  await app.register(profileRoutes);
  await app.register(userSettingsRoutes);
  await app.register(accountRoutes);
  await app.register(opensubtitlesRoutes);
}
