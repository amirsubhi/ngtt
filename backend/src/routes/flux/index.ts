import { FastifyPluginAsync } from 'fastify';
import { fluxStoreRoutes } from './store';
import { fluxPurchaseRoutes } from './purchase';
import { fluxBalanceRoutes } from './balance';
import { fluxGiftRoutes } from './gift';

export const fluxRoutes: FastifyPluginAsync = async app => {
  await app.register(fluxStoreRoutes);
  await app.register(fluxPurchaseRoutes);
  await app.register(fluxBalanceRoutes);
  await app.register(fluxGiftRoutes);
};
