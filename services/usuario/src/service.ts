import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { createApp } from './api/app.js';
import {
  desativarAcesso,
  listarUsuarios,
  reativarAcesso,
  registrarAcesso,
} from './application/usuarios.js';
import type { Config } from './infra/config.js';
import { connectDatabase } from './infra/db/database.js';
import { usuarioRepository } from './infra/db/usuario-repository.js';
import type { Logger } from './infra/logger.js';
import { startRelay } from './infra/outbox.js';
import { connectRabbitmq, createPublisher } from './infra/rabbitmq.js';

const clock = { now: () => new Date(), newId: randomUUID };

/**
 * Composition root: wires domain, application and infrastructure, then starts the HTTP server
 * and the outbox relay. No consumer: Usuário consumes no events.
 * `stop` closes the server first, then the relay and connections.
 */
export const startService = async (config: Config, logger: Logger) => {
  const database = await connectDatabase(config.databaseUrl);
  const connection = connectRabbitmq(config.rabbitmqUrl, logger);
  const publisher = createPublisher(connection);
  const stopRelay = startRelay(database.db, publisher.publish, logger);

  const repository = usuarioRepository(database.db);
  const app = createApp({
    desativar: desativarAcesso(repository, clock),
    registrarAcesso: registrarAcesso(repository),
    listar: listarUsuarios(repository),
    contato: repository.buscar,
    gestores: repository.gestores,
    reativar: reativarAcesso(repository),
    health: async () => ({
      database: await database.isHealthy(),
      rabbitmq: connection.isConnected(),
    }),
    logger,
  });
  const server = serve({ fetch: app.fetch, port: config.port });
  await new Promise((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  logger.info('service started', { port });

  return {
    port,
    stop: async () => {
      await new Promise((resolve) => server.close(resolve));
      await stopRelay();
      await publisher.close();
      await connection.close();
      await database.close();
      logger.info('service stopped');
    },
  };
};
