// Needs the local compose: cd infra && docker compose up -d --wait postgres rabbitmq mailpit
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { serve } from '@hono/node-server';
import amqplib from 'amqplib';
import { eq, TransactionRollbackError } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Contato } from './domain/aviso.js';
import { queues } from './infra/consumer.js';
import { connectDatabase, type Executor } from './infra/db/database.js';
import { emails } from './infra/db/schema.js';
import { enviarProximo, guardar } from './infra/envio.js';
import { createLogger } from './infra/logger.js';
import { EXCHANGE } from './infra/rabbitmq.js';
import { startService } from './service.js';

const mailpitUrl = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const config = {
  // Unique queue names so the test does not compete with a running notificacao container.
  service: `test-${randomUUID().slice(0, 8)}`,
  port: 0,
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://notificacao:notificacao@localhost:5432/notificacao',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://facoffee:facoffee@localhost:5672',
  smtpUrl: process.env.SMTP_URL ?? 'smtp://localhost:1025',
  smtpFrom: 'FACOFFEE <facoffee@localhost>',
};
const logger = createLogger('test', () => {});
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const eventually = async <T>(
  check: () => Promise<T | undefined>,
  timeoutMs = 10_000,
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value !== undefined) return value;
    await sleep(100);
  }
  throw new Error('condition not met in time');
};

const caixaDe = async (email: string) => {
  const response = await fetch(
    `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  return ((await response.json()) as { messages: { Subject: string }[] }).messages;
};

const contato = (nome: string): Contato => ({
  id: randomUUID(),
  nome,
  email: `${nome.toLowerCase()}-${randomUUID().slice(0, 8)}@ufms.br`,
  desativado: false,
});

describe('envio', () => {
  const database = connectDatabase(config.databaseUrl);
  afterAll(async () => (await database).close());

  const t0 = new Date('1971-01-01T00:00:00Z');
  const depois = (segundos: number) => new Date(t0.getTime() + segundos * 1000);
  const falhaCom = (campos: Record<string, unknown>) => async () => {
    throw Object.assign(new Error('smtp'), campos);
  };

  // Runs in a transaction rolled back at the end: no relay running elsewhere sees the e-mail,
  // and in 1971 no committed e-mail is due yet.
  const isolado = async (teste: (tx: Executor, eventoId: string) => Promise<void>) => {
    const { db } = await database;
    const eventoId = randomUUID();
    await db
      .transaction(async (tx) => {
        await guardar(tx, eventoId, [{ para: 'x@ufms.br', assunto: 'a', texto: 't' }]);
        await tx
          .update(emails)
          .set({ proximaTentativaEm: t0 })
          .where(eq(emails.eventoId, eventoId));
        await teste(tx, eventoId);
        tx.rollback();
      })
      .catch((error) => {
        if (!(error instanceof TransactionRollbackError)) throw error;
      });
  };

  it('tenta de novo o e-mail que falhou, sem perdê-lo', () =>
    isolado(async (tx, eventoId) => {
      const enviados: string[] = [];
      const ok = async ({ para }: { para: string }) => {
        enviados.push(para);
      };

      const falha = await enviarProximo(tx, falhaCom({ code: 'ECONNECTION' }), t0);
      expect(falha).toMatchObject({ eventoId, tentativas: 1, recusado: false });
      expect(await enviarProximo(tx, ok, depois(30))).toBeUndefined();
      expect(await enviarProximo(tx, ok, depois(60))).toMatchObject({ eventoId });
      expect(enviados).toEqual(['x@ufms.br']);
      const [linha] = await tx.select().from(emails).where(eq(emails.eventoId, eventoId));
      expect(linha?.enviadoEm).toEqual(depois(60));
    }));

  it('guarda sem tentar de novo o e-mail recusado pelo destinatário', () =>
    isolado(async (tx, eventoId) => {
      const recusa = falhaCom({ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550 });
      expect(await enviarProximo(tx, recusa, t0)).toMatchObject({ eventoId, recusado: true });
      expect(await enviarProximo(tx, recusa, depois(24 * 3600))).toBeUndefined();
      const [linha] = await tx.select().from(emails).where(eq(emails.eventoId, eventoId));
      expect(linha).toMatchObject({ recusadoEm: t0, enviadoEm: null });
    }));
});

describe('service', () => {
  const ana = contato('Ana');
  const bia = contato('Bia');
  const usuario = serve({
    fetch: new Hono().get('/contato', (c) => c.json([ana, bia])).fetch,
    port: 0,
  });
  const amqp = amqplib.connect(config.rabbitmqUrl);
  const channel = amqp.then((c) => c.createChannel());
  // Started in beforeAll: the envio tests run first and their migration must finish before.
  let running: Awaited<ReturnType<typeof startService>>;

  beforeAll(async () => {
    if (!usuario.listening) await new Promise((resolve) => usuario.once('listening', resolve));
    const { port } = usuario.address() as AddressInfo;
    running = await startService({ ...config, usuarioUrl: `http://127.0.0.1:${port}` }, logger);
    await running.ready();
  });

  afterAll(async () => {
    await running.stop();
    usuario.close();
    const queue = queues(config.service);
    for (const name of [queue.events, queue.deadLetter]) await (await channel).deleteQueue(name);
    await (await amqp).close();
  });

  const pagamento = (participantId: string) => ({
    id: randomUUID(),
    type: 'finance.payment-received',
    version: 1,
    occurredAt: new Date().toISOString(),
    payload: { paymentId: randomUUID(), participantId, amountInCents: 18000, method: 'pix' },
  });
  const publicar = async (event: unknown) =>
    (await channel).publish(
      EXCHANGE,
      'finance.payment-received.v1',
      Buffer.from(JSON.stringify(event)),
    );

  it('envia um e-mail só, mesmo com o evento repetido', async () => {
    const event = pagamento(ana.id);
    await publicar(event);
    await publicar(event);
    await publicar(pagamento(bia.id));

    await eventually(async () => ((await caixaDe(bia.email)).length > 0 ? true : undefined));
    expect((await caixaDe(ana.email)).map((m) => m.Subject)).toEqual(['Pagamento recebido']);
  });
});
