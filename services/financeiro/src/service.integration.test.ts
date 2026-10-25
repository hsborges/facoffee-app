// Needs the local compose: cd infra && docker compose up -d --wait postgres rabbitmq seaweedfs
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import amqplib from 'amqplib';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import {
  type Repository,
  registrarCotaDevida,
  registrarSaida,
} from './application/participantes.js';
import type { Event } from './domain/event.js';
import { queues } from './infra/consumer.js';
import { connectDatabase } from './infra/db/database.js';
import { participanteRepository } from './infra/db/participante-repository.js';
import { createLogger } from './infra/logger.js';
import { EXCHANGE } from './infra/rabbitmq.js';
import { startService } from './service.js';

const config = {
  // Unique queue names so the test does not compete with a running financeiro container.
  service: `test-${randomUUID().slice(0, 8)}`,
  port: 0,
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://financeiro:financeiro@localhost:5432/financeiro',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://facoffee:facoffee@localhost:5672',
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:8333',
    accessKey: process.env.S3_ACCESS_KEY ?? 'facoffee',
    secretKey: process.env.S3_SECRET_KEY ?? 'facoffee-secret',
    bucket: 'financeiro',
  },
};
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const amqp = await amqplib.connect(config.rabbitmqUrl);
const channel = await amqp.createChannel();
const running = await startService(
  config,
  createLogger('test', () => {}),
);
const database = await connectDatabase(config.databaseUrl);
const repository = participanteRepository(database.db);

beforeAll(() => running.ready());

afterAll(async () => {
  await running.stop();
  for (const name of Object.values(queues(config.service))) await channel.deleteQueue(name);
  await amqp.close();
  await database.close();
});

const eventually = async (check: () => Promise<boolean>, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await check()) && Date.now() < deadline) await sleep(100);
  return check();
};

const evento = (type: string, payload: Record<string, unknown>) => ({
  id: randomUUID(),
  type,
  version: 1,
  occurredAt: new Date().toISOString(),
  payload,
});
const publicar = (event: ReturnType<typeof evento>) =>
  channel.publish(EXCHANGE, `${event.type}.v1`, Buffer.from(JSON.stringify(event)));
const entrou = (participantId: string) =>
  evento('participation.participant-joined', { participantId });
const saiu = (participantId: string) => evento('participation.participant-left', { participantId });
const cotaDevida = (participantId: string, month: string, amountInCents = 3000) =>
  evento('participation.contribution-due', {
    participantId,
    month,
    contributionType: 'full',
    amountInCents,
  });

it('keeps who entered and has not left in Participantes ativos, even with repeated events', async () => {
  const [ativo, saiuDepois, voltou] = [randomUUID(), randomUUID(), randomUUID()];
  const entrada = entrou(ativo);
  for (const event of [
    entrada,
    entrada,
    entrou(ativo),
    entrou(saiuDepois),
    saiu(saiuDepois),
    entrou(voltou),
    saiu(voltou),
    entrou(voltou),
  ]) {
    publicar(event);
  }

  const esperados = [ativo, voltou].sort();
  const ativos = async () =>
    (await repository.ativos()).filter((id) => [ativo, saiuDepois, voltou].includes(id));
  expect(await eventually(async () => (await ativos()).length === 2)).toBe(true);
  await sleep(1000);
  expect(await ativos()).toEqual(esperados);
});

it('records each Cota devida once per month, even with repeated events', async () => {
  const id = randomUUID();
  const novembro = cotaDevida(id, '2026-11');
  for (const event of [
    entrou(id),
    novembro,
    novembro,
    cotaDevida(id, '2026-11', 9999),
    cotaDevida(id, '2026-12'),
  ]) {
    publicar(event);
  }

  const cotas = async () => (await repository.buscar(id))?.cotas ?? [];
  expect(await eventually(async () => (await cotas()).length === 2)).toBe(true);
  await sleep(1000);
  expect(await cotas()).toEqual([
    { mes: '2026-11', tipoDeCota: 'completa', valorEmCentavos: 3000 },
    { mes: '2026-12', tipoDeCota: 'completa', valorEmCentavos: 3000 },
  ]);
});

it('does not undo a saída handled while a Cota devida was in progress', async () => {
  const id = randomUUID();
  publicar(entrou(id));
  expect(await eventually(async () => (await repository.buscar(id))?.ativo === true)).toBe(true);

  let soltar = () => {};
  const solta = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  const cota = database.db.transaction(async (tx) => {
    const real = participanteRepository(tx);
    // holds the cota between reading and saving the participante
    const devagar: Repository = {
      ...real,
      buscar: async (buscado) => {
        const participante = await real.buscar(buscado);
        await solta;
        return participante;
      },
    };
    return registrarCotaDevida(devagar)(cotaDevida(id, '2026-11') as Event);
  });
  await sleep(200);
  const saida = database.db.transaction((tx) =>
    registrarSaida(participanteRepository(tx))(saiu(id) as Event),
  );
  await sleep(500);
  soltar();
  await Promise.all([cota, saida]);

  expect(await repository.buscar(id)).toMatchObject({ ativo: false, cotas: [{ mes: '2026-11' }] });
});

it('guarda a comprovante in S3 and serves it only to its participante and the gestor', async () => {
  const participante = randomUUID();
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  const pdf = new TextEncoder().encode('%PDF-1.7 comprovante');
  const form = new FormData();
  form.append('participanteId', participante);
  form.append('arquivo', new Blob([pdf]), 'comprovante.pdf');
  const url = `http://localhost:${running.port}`;

  const guardado = await fetch(`${url}/guardar-comprovante`, {
    method: 'POST',
    headers: gestor,
    body: form,
  });
  expect(guardado.status).toBe(201);
  const { id } = (await guardado.json()) as { id: string };

  const baixar = (headers: Record<string, string>) =>
    fetch(`${url}/comprovante/${id}`, { headers });
  const doParticipante = await baixar({ 'x-user-id': participante });
  expect(doParticipante.status).toBe(200);
  expect(doParticipante.headers.get('content-type')).toBe('application/pdf');
  expect(new Uint8Array(await doParticipante.arrayBuffer())).toEqual(pdf);
  expect((await baixar(gestor)).status).toBe(200);
  expect((await baixar({ 'x-user-id': randomUUID() })).status).toBe(404);
  expect((await fetch(`${url}/nota/${id}`, { headers: gestor })).status).toBe(404);
});

it('receives a pagamento por PIX and publishes Pagamento recebido, once per comprovante', async () => {
  const { queue } = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(queue, EXCHANGE, 'finance.payment-received.v1');
  const publicados: Event[] = [];
  await channel.consume(
    queue,
    (msg) => msg && publicados.push(JSON.parse(msg.content.toString())),
    {
      noAck: true,
    },
  );

  const participante = randomUUID();
  publicar(entrou(participante));
  expect(await eventually(async () => (await repository.buscar(participante)) !== undefined)).toBe(
    true,
  );

  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  const url = `http://localhost:${running.port}`;
  const form = new FormData();
  form.append('participanteId', participante);
  form.append('arquivo', new Blob([new TextEncoder().encode('%PDF-1.7 pix')]), 'pix.pdf');
  const guardado = await fetch(`${url}/guardar-comprovante`, {
    method: 'POST',
    headers: gestor,
    body: form,
  });
  const { id: comprovanteId } = (await guardado.json()) as { id: string };

  const receber = () =>
    fetch(`${url}/receber-pagamento`, {
      method: 'POST',
      headers: { ...gestor, 'content-type': 'application/json' },
      body: JSON.stringify({
        participanteId: participante,
        valorEmCentavos: 3000,
        forma: 'pix',
        comprovanteId,
      }),
    });
  const recebido = await receber();
  expect(recebido.status).toBe(201);
  const { id } = (await recebido.json()) as { id: string };
  expect((await receber()).status).toBe(409);

  expect(await eventually(async () => publicados.length > 0)).toBe(true);
  await sleep(1000);
  expect(publicados).toMatchObject([
    {
      type: 'finance.payment-received',
      payload: { paymentId: id, participantId: participante, amountInCents: 3000, method: 'pix' },
    },
  ]);
});

it('receives repeated pagamentos em dinheiro, only from a participante Financeiro knows', async () => {
  const participante = randomUUID();
  publicar(entrou(participante));
  expect(await eventually(async () => (await repository.buscar(participante)) !== undefined)).toBe(
    true,
  );

  const receber = (participanteId: string) =>
    fetch(`http://localhost:${running.port}/receber-pagamento`, {
      method: 'POST',
      headers: {
        'x-user-id': randomUUID(),
        'x-user-roles': 'gestor',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ participanteId, valorEmCentavos: 1500, forma: 'dinheiro' }),
    });
  expect((await receber(participante)).status).toBe(201);
  expect((await receber(participante)).status).toBe(201);

  const desconhecido = await receber(randomUUID());
  expect(desconhecido.status).toBe(404);
  expect(await desconhecido.json()).toEqual({ error: 'participante-nao-encontrado' });
});
