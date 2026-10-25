import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import nodemailer from 'nodemailer';
import { createApp } from './api/app.js';
import { avisar, type BuscarContatos } from './application/avisos.js';
import type { Config } from './infra/config.js';
import { type Handler, startConsumer } from './infra/consumer.js';
import { connectDatabase } from './infra/db/database.js';
import { type Enviar, guardar, startEnvio } from './infra/envio.js';
import type { Logger } from './infra/logger.js';
import { connectRabbitmq } from './infra/rabbitmq.js';

// Internal route of Usuário, kept out of the gateway (ADR 0019).
const buscarContatos =
  (usuarioUrl: string): BuscarContatos =>
  async () => {
    const response = await fetch(new URL('/contato', usuarioUrl), {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`usuario answered ${response.status}`);
    return response.json();
  };

/**
 * Composition root: consumes *Valor da cota definido*, *Pagamento recebido*, *Complemento
 * solicitado* and *Reembolso feito*, stores their e-mails in the event's transaction, and sends
 * them by SMTP apart, retrying failures (ADR 0019). `stop` closes the server first, then the
 * consumer, the sending and the connections.
 */
export const startService = async (config: Config, logger: Logger) => {
  const database = await connectDatabase(config.databaseUrl);
  const connection = connectRabbitmq(config.rabbitmqUrl, logger);
  const smtp = nodemailer.createTransport(config.smtpUrl);
  const enviar: Enviar = async ({ para, assunto, texto }) => {
    await smtp.sendMail({ from: config.smtpFrom, to: para, subject: assunto, text: texto });
  };
  const stopEnvio = startEnvio(database.db, enviar, logger);

  const handler: Handler = async (event, tx) => {
    const result = await avisar(buscarContatos(config.usuarioUrl), (eventoId, emails) =>
      guardar(tx, eventoId, emails),
    )(event);
    if (!result.ok) throw new Error(result.error);
    if (result.value.length > 0)
      logger.warn('participantes without contato get no e-mail', {
        eventId: event.id,
        participantes: result.value,
      });
  };
  const consumer = startConsumer({
    connection,
    db: database.db,
    service: config.service,
    logger,
    handlers: {
      'participation.contribution-amount-set.v1': handler,
      'finance.payment-received.v1': handler,
      'finance.top-up-requested.v1': handler,
      'finance.reimbursement-made.v1': handler,
    },
  });

  const app = createApp({
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
      await consumer.close();
      await stopEnvio();
      smtp.close();
      await connection.close();
      await database.close();
      logger.info('service stopped');
    },
  };
};
