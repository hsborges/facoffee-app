import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { createApp } from './api/app.js';
import {
  baixarComprovante,
  baixarNota,
  comprovanteDoParticipante,
  guardarComprovante,
  guardarNota,
} from './application/arquivos.js';
import { receberPagamento } from './application/pagamentos.js';
import {
  type PayloadInvalido,
  type Repository,
  registrarCotaDevida,
  registrarEntrada,
  registrarSaida,
} from './application/participantes.js';
import type { Event } from './domain/event.js';
import type { Result } from './domain/result.js';
import { connectArmazem } from './infra/armazem-s3.js';
import type { Config } from './infra/config.js';
import { type Handler, startConsumer } from './infra/consumer.js';
import { connectDatabase } from './infra/db/database.js';
import { pagamentoRepository } from './infra/db/pagamento-repository.js';
import { participanteRepository } from './infra/db/participante-repository.js';
import type { Logger } from './infra/logger.js';
import { startRelay } from './infra/outbox.js';
import { connectRabbitmq, createPublisher } from './infra/rabbitmq.js';

// Runs a use case in the consumer's transaction; a refused payload throws, so it is retried.
const handler =
  (
    useCase: (repository: Repository) => (event: Event) => Promise<Result<void, PayloadInvalido>>,
  ): Handler =>
  async (event, tx) => {
    const result = await useCase(participanteRepository(tx))(event);
    if (!result.ok) throw new Error(result.error);
  };

/**
 * Composition root: wires domain, application and infrastructure (including the S3 armazenamento
 * of comprovantes and notas), then starts the HTTP server, the outbox relay and the consumer of
 * *Participante entrou*, *Participante saiu* and *Cota devida*.
 * `stop` closes the server first, then the relay, consumer and connections.
 */
export const startService = async (config: Config, logger: Logger) => {
  const { armazem, ...armazenamento } = await connectArmazem(config.s3);
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
      'participation.participant-joined.v1': handler(registrarEntrada),
      'participation.participant-left.v1': handler(registrarSaida),
      'participation.contribution-due.v1': handler(registrarCotaDevida),
    },
  });

  const app = createApp({
    guardarComprovante: guardarComprovante(armazem, randomUUID),
    guardarNota: guardarNota(armazem, randomUUID),
    baixarComprovante: baixarComprovante(armazem),
    baixarNota: baixarNota(armazem),
    receberPagamento: receberPagamento(
      pagamentoRepository(database.db),
      comprovanteDoParticipante(armazem),
      { now: () => new Date(), newId: randomUUID },
    ),
    health: async () => ({
      database: await database.isHealthy(),
      rabbitmq: connection.isConnected(),
      armazenamento: await armazenamento.isHealthy(),
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
      armazenamento.close();
      logger.info('service stopped');
    },
  };
};
