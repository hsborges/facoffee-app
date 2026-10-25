import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { createApp } from './api/app.js';
import { confirmExample, registerExample } from './application/examples.js';
import type { Config } from './infra/config.js';
import { startConsumer } from './infra/consumer.js';
import { connectDatabase } from './infra/db/database.js';
import { exampleRepository } from './infra/db/example-repository.js';
import type { Logger } from './infra/logger.js';
import { startRelay } from './infra/outbox.js';
import { connectRabbitmq, createPublisher } from './infra/rabbitmq.js';

const clock = { now: () => new Date(), newId: randomUUID };

/**
 * Composition root: wires domain, application and infrastructure, then starts the HTTP server,
 * the outbox relay and the consumer. `stop` closes the server first, then the relay, consumer and connections.
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
      'example.example-registered.v1': async (event, tx) => {
        const result = await confirmExample(exampleRepository(tx), clock)(event);
        if (!result.ok) throw new Error(result.error);
      },
    },
  });

  const repository = exampleRepository(database.db);
  const app = createApp({
    register: registerExample(repository, clock),
    find: repository.find,
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
      await consumer.close();
      await publisher.close();
      await connection.close();
      await database.close();
      logger.info('service stopped');
    },
  };
};
