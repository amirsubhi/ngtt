import { FastifyInstance } from 'fastify';
import { uploadRoutes } from './upload';
import { browseRoutes } from './browse';
import { detailRoutes } from './detail';
import { downloadRoutes } from './download';
import { screenshotRoutes } from './screenshots';
import { interactRoutes } from './interact';

export async function torrentRoutes(app: FastifyInstance): Promise<void> {
  await app.register(uploadRoutes);
  await app.register(browseRoutes);
  await app.register(detailRoutes);
  await app.register(downloadRoutes);
  await app.register(screenshotRoutes);
  await app.register(interactRoutes);
}
