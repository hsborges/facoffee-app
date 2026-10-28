import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { createApp } from './api/app.js';
import { iniciarMes } from './application/cotas.js';
import {
  consultarParticipante,
  encerrarAoDesativarAcesso,
  listarParticipantes,
  pedirEntrada,
  pedirSaida,
  trocarTipo,
} from './application/participantes.js';
import { consultarValoresDaCota, definirValor, iniciarAno } from './application/tipos-de-cota.js';
import type { Config } from './infra/config.js';
import { startConsumer } from './infra/consumer.js';
import { cotaRepository } from './infra/db/cota-repository.js';
import { connectDatabase } from './infra/db/database.js';
import { participanteRepository } from './infra/db/participante-repository.js';
import { valorDaCotaRepository } from './infra/db/valor-da-cota-repository.js';
import type { Logger } from './infra/logger.js';
import { startRelay } from './infra/outbox.js';
import { connectRabbitmq, createPublisher } from './infra/rabbitmq.js';

const clock = { now: () => new Date(), newId: randomUUID };

/**
 * Composition root: wires domain, application and infrastructure, then starts the HTTP server,
 * the outbox relay and the consumer of *Usuário desativado*.
 * `stop` closes the server first, then the relay, consumer and connections.
 */
export const startService = async (config: Config, logger: Logger) => {
  const database = await connectDatabase(config.databaseUrl);
  const connection = connectRabbitmq(config.rabbitmqUrl, logger);
  const publisher = createPublisher(connection);
  const stopRelay = startRelay(database.db, publisher.publish, logger);
  const consumer = startConsumer({
    connection,
    db: database.db,
    service: config.service,
    logger,
    handlers: {
      'user.user-deactivated.v1': async (event, tx) => {
        const result = await encerrarAoDesativarAcesso(participanteRepository(tx), clock)(event);
        if (!result.ok) throw new Error(result.error);
      },
    },
  });

  const repository = participanteRepository(database.db);
  const valores = valorDaCotaRepository(database.db);
  const app = createApp({
    pedirEntrada: pedirEntrada(repository, clock),
    trocarTipo: trocarTipo(repository, clock),
    pedirSaida: pedirSaida(repository, clock),
    definirValor: definirValor(valores, clock),
    consultarParticipante: consultarParticipante(repository, clock),
    listarParticipantes: listarParticipantes(repository, clock),
    consultarValoresDaCota: consultarValoresDaCota(valores, clock),
    iniciarAno: iniciarAno(valores, clock),
    iniciarMes: iniciarMes(cotaRepository(database.db), valores, clock),
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
    ready: consumer.ready,
    stop: async () => {
      await new Promise((resolve) => server.close(resolve));
      await stopRelay();
      await consumer.close();
      await publisher.close();
      await connection.close();
      await database.close();
      logger.info('service stopped');
    },
  };
};
