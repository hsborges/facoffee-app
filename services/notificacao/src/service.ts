import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import nodemailer from 'nodemailer';
import { createApp } from './api/app.js';
import { avisar, type BuscarContato, type BuscarGestores } from './application/avisos.js';
import { type BuscarPendentes, lembrarPendentes } from './application/lembretes.js';
import { pendentesDe } from './domain/lembrete.js';
import type { Config } from './infra/config.js';
import { type Handler, startConsumer } from './infra/consumer.js';
import { connectDatabase } from './infra/db/database.js';
import { type Enviar, guardar, startEnvio } from './infra/envio.js';
import { buscarRegistrados, registrar } from './infra/lembretes.js';
import type { Logger } from './infra/logger.js';
import { connectRabbitmq } from './infra/rabbitmq.js';

// Internal route of Usuário, kept out of the gateway (ADR 0020).
const buscarContato =
  (usuarioUrl: string): BuscarContato =>
  async (id) => {
    const response = await fetch(new URL(`/contato/${id}`, usuarioUrl), {
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`usuario answered ${response.status}`);
    return response.json();
  };

// Internal route of Usuário, kept out of the gateway (ADR 0031).
const buscarGestores =
  (usuarioUrl: string): BuscarGestores =>
  async () => {
    const response = await fetch(new URL('/contato/gestor', usuarioUrl), {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`usuario answered ${response.status}`);
    return response.json();
  };

// Internal route of Financeiro, kept out of the gateway (ADR 0027).
const buscarPendentes =
  (financeiroUrl: string): BuscarPendentes =>
  async () => {
    const response = await fetch(new URL('/pendente', financeiroUrl), {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`financeiro answered ${response.status}`);
    const pendentes = pendentesDe(await response.json());
    if (!pendentes) throw new Error('financeiro answered invalid pendentes');
    return pendentes;
  };

/**
 * Composition root: consumes *Pagamento recebido*, *Complemento solicitado*, *Reembolso feito*,
 * *Comprovante enviado* and *Comprovante recusado* (ADR 0031), stores their e-mails in the event's
 * transaction, and sends them by SMTP apart, retrying failures (ADR 0020). *Valor da cota
 * definido* is consumed but sends nothing yet. The agendador's `POST /lembrar-pendentes` avisa the cota devida and lembra the pendentes (ADR 0027), at `agora`;
 * tests pass a fixed clock. `stop` closes the server first, then the consumer, the sending and the connections.
 */
export const startService = async (
  config: Config,
  logger: Logger,
  agora: () => Date = () => new Date(),
) => {
  const database = await connectDatabase(config.databaseUrl);
  const connection = connectRabbitmq(config.rabbitmqUrl, logger);
  // Nodemailer waits up to 10 minutes by default, holding the e-mail's row lock meanwhile.
  const smtp = nodemailer.createTransport({
    url: config.smtpUrl,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  const enviar: Enviar = async ({ para, assunto, texto }) => {
    await smtp.sendMail({ from: config.smtpFrom, to: para, subject: assunto, text: texto });
  };
  const stopEnvio = startEnvio(database.db, enviar, logger);

  const handler: Handler = async (event, tx) => {
    const result = await avisar(
      buscarContato(config.usuarioUrl),
      buscarGestores(config.usuarioUrl),
      (eventoId, emails) => guardar(tx, eventoId, emails),
    )(event);
    if (!result.ok) throw new Error(result.error);
    const { semContato, semGestor } = result.value;
    if (semContato.length > 0)
      logger.warn('participantes without contato get no e-mail', {
        eventId: event.id,
        participantes: semContato,
      });
    if (semGestor) logger.warn('no gestor known to get the e-mail', { eventId: event.id });
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
      'finance.receipt-sent.v1': handler,
      'finance.receipt-rejected.v1': handler,
    },
  });

  const lembrar = lembrarPendentes(
    buscarPendentes(config.financeiroUrl),
    buscarRegistrados(database.db),
    buscarContato(config.usuarioUrl),
    registrar(database.db),
    config.horaDosLembretes,
  );
  const app = createApp({
    health: async () => ({
      database: await database.isHealthy(),
      rabbitmq: connection.isConnected(),
    }),
    lembrarPendentes: async () => {
      const { lembretes, semContato } = await lembrar(agora());
      if (semContato.length > 0)
        logger.warn('participantes without contato get no lembrete', { participantes: semContato });
      return { lembretes };
    },
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
