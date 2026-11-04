// Needs the local compose: cd infra && docker compose -f docker-compose.dev.yml up -d --wait postgres rabbitmq seaweedfs
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import amqplib from 'amqplib';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import {
  type Repository,
  registrarCotaDevida,
  registrarSaida,
} from './application/participantes.js';
import { anoAnterior, type CaixinhaDoAno } from './domain/caixinha.js';
import { confirmar } from './domain/comprovante-enviado.js';
import type { Event } from './domain/event.js';
import { queues } from './infra/consumer.js';
import { comprovanteEnviadoRepository } from './infra/db/comprovante-enviado-repository.js';
import { connectDatabase } from './infra/db/database.js';
import { participanteRepository } from './infra/db/participante-repository.js';
import { comprovantesEnviados, gastos } from './infra/db/schema.js';
import { createLogger } from './infra/logger.js';
import { EXCHANGE } from './infra/rabbitmq.js';
import { startService } from './service.js';

const config = {
  // Unique queue names so the test does not compete with a running financeiro container.
  service: `test-${randomUUID().slice(0, 8)}`,
  port: 0,
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://financeiro@localhost:5432/financeiro',
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
  expect((await receber()).status).toBe(204);
  expect((await receber()).status).toBe(409);

  expect(await eventually(async () => publicados.length > 0)).toBe(true);
  await sleep(1000);
  expect(publicados).toMatchObject([
    {
      type: 'finance.payment-received',
      payload: { participantId: participante, amountInCents: 3000, method: 'pix' },
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
  expect((await receber(participante)).status).toBe(204);
  expect((await receber(participante)).status).toBe(204);

  const desconhecido = await receber(randomUUID());
  expect(desconhecido.status).toBe(404);
  expect(await desconhecido.json()).toEqual({ error: 'participante-nao-encontrado' });
});

it('turns a pagamento adiantado into crédito, abatido by the next cotas, across saída e retorno', async () => {
  const participante = randomUUID();
  const url = `http://localhost:${running.port}`;
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  const situacao = async () =>
    (await fetch(`${url}/participante/eu`, { headers: { 'x-user-id': participante } })).json();
  const quando = async (esperada: Record<string, unknown>) => {
    await eventually(async () => {
      const atual = await situacao();
      return Object.entries(esperada).every(([k, v]) => atual[k] === v);
    });
    expect(await situacao()).toMatchObject({ id: participante, ...esperada });
  };

  publicar(entrou(participante));
  publicar(cotaDevida(participante, '2026-11'));
  await quando({ participando: true, creditoEmCentavos: 0, pendenciaEmCentavos: 3000 });

  const pago = await fetch(`${url}/receber-pagamento`, {
    method: 'POST',
    headers: { ...gestor, 'content-type': 'application/json' },
    body: JSON.stringify({
      participanteId: participante,
      valorEmCentavos: 9000,
      forma: 'dinheiro',
    }),
  });
  expect(pago.status).toBe(204);
  await quando({ participando: true, creditoEmCentavos: 6000, pendenciaEmCentavos: 0 });

  publicar(cotaDevida(participante, '2026-12'));
  publicar(saiu(participante));
  await quando({ participando: false, creditoEmCentavos: 3000, pendenciaEmCentavos: 0 });

  publicar(entrou(participante));
  publicar(cotaDevida(participante, '2027-03'));
  publicar(cotaDevida(participante, '2027-04'));
  await quando({ participando: true, creditoEmCentavos: 0, pendenciaEmCentavos: 3000 });
  expect(await situacao()).toMatchObject({
    cotas: ['2027-04', '2027-03', '2026-12', '2026-11'].map((mes) => ({
      mes,
      tipoDeCota: 'completa',
      valorEmCentavos: 3000,
    })),
    complementos: [],
  });

  const todos = (await (await fetch(`${url}/participante`, { headers: gestor })).json()) as {
    id: string;
  }[];
  expect(todos.find((p) => p.id === participante)).toMatchObject({ pendenciaEmCentavos: 3000 });
  expect(
    (await fetch(`${url}/participante`, { headers: { 'x-user-id': participante } })).status,
  ).toBe(403);
});

it('registers a gasto do próprio bolso with its own nota, once per nota, by a known participante', async () => {
  const participante = randomUUID();
  publicar(entrou(participante));
  expect(await eventually(async () => (await repository.buscar(participante)) !== undefined)).toBe(
    true,
  );

  const url = `http://localhost:${running.port}`;
  const guardarNota = async (quem: string) => {
    const form = new FormData();
    form.append('arquivo', new Blob([new TextEncoder().encode('%PDF-1.7 nota')]), 'nota.pdf');
    const nota = await fetch(`${url}/guardar-nota`, {
      method: 'POST',
      headers: { 'x-user-id': quem },
      body: form,
    });
    return ((await nota.json()) as { id: string }).id;
  };
  const notaId = await guardarNota(participante);

  const registrar = (quem: string, nota = notaId) =>
    fetch(`${url}/registrar-gasto`, {
      method: 'POST',
      headers: { 'x-user-id': quem, 'content-type': 'application/json' },
      body: JSON.stringify({
        valorEmCentavos: 4590,
        origem: 'proprio-bolso',
        tipo: 'cafe',
        notaId: nota,
      }),
    });
  const outro = randomUUID();
  const comNotaAlheia = await registrar(outro);
  expect(comNotaAlheia.status).toBe(404);
  expect(await comNotaAlheia.json()).toEqual({ error: 'nota-nao-encontrada' });
  const desconhecido = await registrar(outro, await guardarNota(outro));
  expect(desconhecido.status).toBe(409);
  expect(await desconhecido.json()).toEqual({ error: 'nunca-participou' });

  const registrado = await registrar(participante);
  expect(registrado.status).toBe(201);
  const { id } = (await registrado.json()) as { id: string };
  expect((await registrar(participante)).status).toBe(409);

  expect(await database.db.select().from(gastos).where(eq(gastos.notaId, notaId))).toEqual([
    {
      id,
      participanteId: participante,
      valorEmCentavos: 4590,
      origem: 'proprio-bolso',
      tipo: 'cafe',
      notaId,
      registradoEm: expect.any(Date),
    },
  ]);
});

it('reembolsa a gasto do próprio bolso once and publishes Reembolso feito', async () => {
  const { queue } = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(queue, EXCHANGE, 'finance.reimbursement-made.v1');
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
  const url = `http://localhost:${running.port}`;
  const registrar = async (origem: string) => {
    const form = new FormData();
    form.append('arquivo', new Blob([new TextEncoder().encode('%PDF-1.7 nota')]), 'nota.pdf');
    const nota = await fetch(`${url}/guardar-nota`, {
      method: 'POST',
      headers: { 'x-user-id': participante },
      body: form,
    });
    const { id: notaId } = (await nota.json()) as { id: string };
    const gasto = await fetch(`${url}/registrar-gasto`, {
      method: 'POST',
      headers: { 'x-user-id': participante, 'content-type': 'application/json' },
      body: JSON.stringify({ valorEmCentavos: 4590, origem, tipo: 'reposicao', notaId }),
    });
    return ((await gasto.json()) as { id: string }).id;
  };
  const doBolso = await registrar('proprio-bolso');
  const reembolsar = (gastoId: string) =>
    fetch(`${url}/gasto/${gastoId}/reembolsar`, {
      method: 'POST',
      headers: { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' },
    });

  const [primeiro, concorrente] = await Promise.all([reembolsar(doBolso), reembolsar(doBolso)]);
  expect([primeiro.status, concorrente.status].sort()).toEqual([204, 409]);
  expect((await reembolsar(doBolso)).status).toBe(409);
  expect((await reembolsar(await registrar('caixinha'))).status).toBe(409);
  expect((await reembolsar(randomUUID())).status).toBe(404);
  const lista = await fetch(`${url}/gasto`, {
    headers: { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' },
  });
  const doParticipante = ((await lista.json()) as { participanteId: string }[]).filter(
    (gasto) => gasto.participanteId === participante,
  );
  expect(doParticipante).toMatchObject([
    { origem: 'caixinha', reembolsado: false },
    { id: doBolso, origem: 'proprio-bolso', valorEmCentavos: 4590, reembolsado: true },
  ]);

  expect(await eventually(async () => publicados.length > 0)).toBe(true);
  await sleep(1000);
  expect(publicados).toMatchObject([
    {
      type: 'finance.reimbursement-made',
      payload: {
        expenseId: doBolso,
        participantId: participante,
        amountInCents: 4590,
      },
    },
  ]);
});

it('keeps Saldo da caixinha and Gastos do ano anterior, with gastos pela caixinha and do próprio bolso', async () => {
  const participante = randomUUID();
  publicar(entrou(participante));
  expect(await eventually(async () => (await repository.buscar(participante)) !== undefined)).toBe(
    true,
  );
  const url = `http://localhost:${running.port}`;
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  const caixinha = async () =>
    (await (await fetch(`${url}/caixinha`, { headers: { 'x-user-id': participante } })).json()) as {
      saldoEmCentavos: number;
      gastosDoAnoAnteriorEmCentavos: number;
      gastosDoAnoAnteriorPorTipoEmCentavos: Record<string, number>;
    };
  const registrar = async (origem: string, valorEmCentavos: number) => {
    const form = new FormData();
    form.append('arquivo', new Blob([new TextEncoder().encode('%PDF-1.7 nota')]), 'nota.pdf');
    const nota = await fetch(`${url}/guardar-nota`, {
      method: 'POST',
      headers: { 'x-user-id': participante },
      body: form,
    });
    const { id: notaId } = (await nota.json()) as { id: string };
    const gasto = await fetch(`${url}/registrar-gasto`, {
      method: 'POST',
      headers: { 'x-user-id': participante, 'content-type': 'application/json' },
      body: JSON.stringify({ valorEmCentavos, origem, tipo: 'outros-itens', notaId }),
    });
    return ((await gasto.json()) as { id: string }).id;
  };
  const antes = await caixinha();

  await fetch(`${url}/receber-pagamento`, {
    method: 'POST',
    headers: { ...gestor, 'content-type': 'application/json' },
    body: JSON.stringify({
      participanteId: participante,
      valorEmCentavos: 10000,
      forma: 'dinheiro',
    }),
  });
  await registrar('caixinha', 3000);
  const doBolso = await registrar('proprio-bolso', 2500);
  expect((await caixinha()).saldoEmCentavos - antes.saldoEmCentavos).toBe(7000);

  await fetch(`${url}/gasto/${doBolso}/reembolsar`, { method: 'POST', headers: gestor });
  const depois = await caixinha();
  expect(depois.saldoEmCentavos - antes.saldoEmCentavos).toBe(4500);
  expect(depois.gastosDoAnoAnteriorEmCentavos).toBe(antes.gastosDoAnoAnteriorEmCentavos);

  // No route registers a gasto in the past, so these go straight to the table.
  const ano = anoAnterior(new Date());
  const gasto = (
    valorEmCentavos: number,
    origem: 'caixinha' | 'proprio-bolso',
    registradoEm: string,
    tipo: 'cafe' | 'reposicao' = 'cafe',
  ) => ({
    id: randomUUID(),
    participanteId: participante,
    valorEmCentavos,
    origem,
    tipo,
    notaId: randomUUID(),
    registradoEm: new Date(registradoEm),
  });
  await database.db.insert(gastos).values([
    gasto(700, 'caixinha', `${ano + 1}-01-01T03:59:00Z`), // 31/12 23:59 in Campo Grande
    gasto(50, 'proprio-bolso', `${ano}-06-15T12:00:00Z`, 'reposicao'),
    gasto(9, 'caixinha', `${ano}-01-01T03:59:00Z`), // still the year before, in Campo Grande
  ]);
  const doAno = await caixinha();
  expect(doAno.gastosDoAnoAnteriorEmCentavos - antes.gastosDoAnoAnteriorEmCentavos).toBe(750);
  const porTipo = (tipo: string) =>
    (doAno.gastosDoAnoAnteriorPorTipoEmCentavos[tipo] ?? 0) -
    (antes.gastosDoAnoAnteriorPorTipoEmCentavos[tipo] ?? 0);
  expect(porTipo('cafe')).toBe(700);
  expect(porTipo('reposicao')).toBe(50);
});

it('sums the Caixinha do ano per tipo de gasto, matching the Saldo da caixinha', async () => {
  const participante = randomUUID();
  publicar(entrou(participante));
  expect(await eventually(async () => (await repository.buscar(participante)) !== undefined)).toBe(
    true,
  );
  const url = `http://localhost:${running.port}`;
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  const ler = async <T>(caminho: string) =>
    (await (
      await fetch(`${url}${caminho}`, { headers: { 'x-user-id': participante } })
    ).json()) as T;
  const ano = anoAnterior(new Date()) + 1;
  const doAno = () => ler<CaixinhaDoAno>(`/caixinha/${ano}`);
  const registrar = async (origem: string, tipo: string, valorEmCentavos: number) => {
    const form = new FormData();
    form.append('arquivo', new Blob([new TextEncoder().encode('%PDF-1.7 nota')]), 'nota.pdf');
    const nota = await fetch(`${url}/guardar-nota`, {
      method: 'POST',
      headers: { 'x-user-id': participante },
      body: form,
    });
    const { id: notaId } = (await nota.json()) as { id: string };
    const gasto = await fetch(`${url}/registrar-gasto`, {
      method: 'POST',
      headers: { 'x-user-id': participante, 'content-type': 'application/json' },
      body: JSON.stringify({ valorEmCentavos, origem, tipo, notaId }),
    });
    return ((await gasto.json()) as { id: string }).id;
  };
  const antes = await doAno();

  await fetch(`${url}/receber-pagamento`, {
    method: 'POST',
    headers: { ...gestor, 'content-type': 'application/json' },
    body: JSON.stringify({
      participanteId: participante,
      valorEmCentavos: 10000,
      forma: 'dinheiro',
    }),
  });
  await registrar('caixinha', 'cafe', 3000);
  const doBolso = await registrar('proprio-bolso', 'reposicao', 2500);
  expect((await doAno()).gastosPorTipoEmCentavos.reposicao).toBe(
    antes.gastosPorTipoEmCentavos.reposicao,
  );
  await fetch(`${url}/gasto/${doBolso}/reembolsar`, { method: 'POST', headers: gestor });
  // 23:59 of 31 December the year before, in Campo Grande: it only changes the saldo no início.
  await database.db.insert(gastos).values({
    id: randomUUID(),
    participanteId: participante,
    valorEmCentavos: 9,
    origem: 'caixinha',
    tipo: 'cafe',
    notaId: randomUUID(),
    registradoEm: new Date(`${ano}-01-01T03:59:00Z`),
  });

  const depois = await doAno();
  expect(depois.saldoNoInicioEmCentavos - antes.saldoNoInicioEmCentavos).toBe(-9);
  expect(depois.recebidoEmCentavos - antes.recebidoEmCentavos).toBe(10000);
  expect(depois.gastosPorTipoEmCentavos.cafe - antes.gastosPorTipoEmCentavos.cafe).toBe(3000);
  expect(depois.gastosPorTipoEmCentavos.reposicao - antes.gastosPorTipoEmCentavos.reposicao).toBe(
    2500,
  );
  expect(depois.saldoNoFimEmCentavos).toBe(
    depois.saldoNoInicioEmCentavos +
      depois.recebidoEmCentavos -
      Object.values(depois.gastosPorTipoEmCentavos).reduce((a, b) => a + b, 0),
  );
  expect(depois.saldoNoFimEmCentavos).toBe(
    (await ler<{ saldoEmCentavos: number }>('/caixinha')).saldoEmCentavos,
  );
});

it('divides a complemento among the participantes ativos and abate the crédito of each one', async () => {
  const { queue } = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(queue, EXCHANGE, 'finance.top-up-requested.v1');
  const publicados: Event[] = [];
  await channel.consume(
    queue,
    (msg) => msg && publicados.push(JSON.parse(msg.content.toString())),
    { noAck: true },
  );

  const [comCredito, pendente, saiuAntes, entrouDepois] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  for (const event of [
    entrou(comCredito),
    entrou(pendente),
    cotaDevida(pendente, '2026-11'),
    entrou(saiuAntes),
    saiu(saiuAntes),
  ]) {
    publicar(event);
  }
  expect(
    await eventually(
      async () =>
        (await repository.buscar(saiuAntes))?.ativo === false &&
        (await repository.buscar(pendente))?.cotas.length === 1 &&
        (await repository.buscar(comCredito)) !== undefined,
    ),
  ).toBe(true);
  const url = `http://localhost:${running.port}`;
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  await fetch(`${url}/receber-pagamento`, {
    method: 'POST',
    headers: { ...gestor, 'content-type': 'application/json' },
    body: JSON.stringify({ participanteId: comCredito, valorEmCentavos: 10000, forma: 'dinheiro' }),
  });

  // Every ativo left in the shared database shares it too; one centavo is left over.
  const ativos = await repository.ativos();
  const valorTotal = ativos.length * 100 + 1;
  const solicitado = await fetch(`${url}/solicitar-complemento`, {
    method: 'POST',
    headers: { ...gestor, 'content-type': 'application/json' },
    body: JSON.stringify({ valorEmCentavos: valorTotal }),
  });
  expect(solicitado.status).toBe(204);
  publicar(entrou(entrouDepois));
  publicar(saiu(pendente));

  expect(await eventually(async () => publicados.length > 0)).toBe(true);
  const { payload } = publicados[0] as Event<
    string,
    {
      topUpId: string;
      totalAmountInCents: number;
      shares: { participantId: string; amountInCents: number }[];
    }
  >;
  expect(payload).toMatchObject({ totalAmountInCents: valorTotal });
  expect(payload.shares.map((s) => s.participantId)).toEqual(ativos);
  expect(payload.shares.reduce((total, s) => total + s.amountInCents, 0)).toBe(valorTotal);
  const parte = (quem: string) =>
    payload.shares.find((s) => s.participantId === quem)?.amountInCents;
  expect(parte(saiuAntes)).toBeUndefined();

  const situacao = async (quem: string) =>
    (await fetch(`${url}/participante/eu`, { headers: { 'x-user-id': quem } })).json();
  expect(await eventually(async () => (await situacao(entrouDepois)).participando === true)).toBe(
    true,
  );
  expect(await eventually(async () => (await situacao(pendente)).participando === false)).toBe(
    true,
  );
  expect(await situacao(comCredito)).toMatchObject({
    creditoEmCentavos: 10000 - (parte(comCredito) ?? 0),
  });
  expect(await situacao(pendente)).toMatchObject({
    pendenciaEmCentavos: 3000 + (parte(pendente) ?? 0),
    complementos: [{ id: payload.topUpId, parteEmCentavos: parte(pendente) }],
  });
  expect(await situacao(entrouDepois)).toMatchObject({ pendenciaEmCentavos: 0 });
  expect(await situacao(saiuAntes)).toMatchObject({ pendenciaEmCentavos: 0 });
});

it('counts a comprovante enviado as pagamento only once confirmado, for the valor confirmado', async () => {
  const { queue } = await channel.assertQueue('', { exclusive: true });
  for (const rk of [
    'finance.payment-received.v1',
    'finance.receipt-sent.v1',
    'finance.receipt-rejected.v1',
  ])
    await channel.bindQueue(queue, EXCHANGE, rk);
  const publicados: Event[] = [];
  await channel.consume(
    queue,
    (msg) => msg && publicados.push(JSON.parse(msg.content.toString())),
    { noAck: true },
  );

  const participante = randomUUID();
  publicar(entrou(participante));
  publicar(cotaDevida(participante, '2026-11'));
  const doParticipante = { 'x-user-id': participante };
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  const url = `http://localhost:${running.port}`;
  const ler = async <T>(caminho: string, headers: Record<string, string> = doParticipante) =>
    (await (await fetch(`${url}${caminho}`, { headers })).json()) as T;
  const situacao = () =>
    ler<{ pendenciaEmCentavos: number; creditoEmCentavos: number }>('/participante/eu');
  expect(await eventually(async () => (await situacao()).pendenciaEmCentavos === 3000)).toBe(true);
  const comandar = (caminho: string, headers: Record<string, string>, body?: unknown) =>
    fetch(`${url}${caminho}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const enviarComprovante = async (valorEmCentavos: number) => {
    const form = new FormData();
    form.append('participanteId', participante);
    form.append('arquivo', new Blob([new TextEncoder().encode('%PDF-1.7 pix')]), 'pix.pdf');
    const guardado = await fetch(`${url}/guardar-comprovante`, {
      method: 'POST',
      headers: doParticipante,
      body: form,
    });
    expect(guardado.status).toBe(201);
    const { id: comprovanteId } = (await guardado.json()) as { id: string };
    const enviado = await comandar('/enviar-comprovante', doParticipante, {
      valorEmCentavos,
      comprovanteId,
    });
    expect(enviado.status).toBe(201);
    return { comprovanteId, id: ((await enviado.json()) as { id: string }).id };
  };
  const saldo = async () => (await ler<{ saldoEmCentavos: number }>('/caixinha')).saldoEmCentavos;

  const confirmado = await enviarComprovante(9000);
  const recusado = await enviarComprovante(3000);
  const cancelado = await enviarComprovante(1000);
  const disputado = await enviarComprovante(1000);
  const repetido = await comandar('/enviar-comprovante', doParticipante, {
    valorEmCentavos: 1000,
    comprovanteId: confirmado.comprovanteId,
  });
  expect(repetido.status).toBe(409);
  const editar = (comprovanteId: string) =>
    comandar(`/comprovante-enviado/${confirmado.id}/editar`, doParticipante, {
      valorEmCentavos: 6000,
      comprovanteId,
    });
  expect((await editar(cancelado.comprovanteId)).status).toBe(409);
  expect((await editar(confirmado.comprovanteId)).status).toBe(204);
  const cancelar = (id: string) => comandar(`/comprovante-enviado/${id}/cancelar`, doParticipante);
  expect((await cancelar(cancelado.id)).status).toBe(204);
  const aConfirmar = (await ler<{ id: string }[]>('/comprovante-enviado', gestor)).map((c) => c.id);
  expect(aConfirmar).toEqual(expect.arrayContaining([confirmado.id, recusado.id, disputado.id]));
  expect(aConfirmar).not.toContain(cancelado.id);
  // Before the confirmação, neither the situação nor the saldo changes.
  const saldoAntes = await saldo();
  expect(await situacao()).toMatchObject({ pendenciaEmCentavos: 3000 });

  const confirmou = await comandar(`/comprovante-enviado/${confirmado.id}/confirmar`, gestor, {
    valorEmCentavos: 5000,
    comprovanteId: confirmado.comprovanteId,
  });
  expect(confirmou.status).toBe(204);
  const recusar = (id: string, motivo: string) =>
    comandar(`/comprovante-enviado/${id}/recusar`, gestor, { motivo });
  expect((await recusar(recusado.id, '')).status).toBe(400);
  expect((await recusar(recusado.id, 'Valor diferente do PIX')).status).toBe(204);
  expect((await cancelar(confirmado.id)).status).toBe(409);
  // Confirmar and recusar at the same time: only one happens.
  const disputa = await Promise.all([
    comandar(`/comprovante-enviado/${disputado.id}/confirmar`, gestor, {
      valorEmCentavos: 1000,
      comprovanteId: disputado.comprovanteId,
    }),
    recusar(disputado.id, 'Repetido'),
  ]);
  expect(disputa.filter((r) => r.status === 409)).toHaveLength(1);
  const extra = disputa[0]?.status === 204 ? 1000 : 0;

  expect(await situacao()).toMatchObject({
    creditoEmCentavos: 2000 + extra,
    pendenciaEmCentavos: 0,
  });
  expect((await saldo()) - saldoAntes).toBe(5000 + extra);
  expect(await ler('/comprovante-enviado/eu')).toMatchObject([
    { id: disputado.id, situacao: extra ? 'confirmado' : 'recusado' },
    { id: recusado.id, situacao: 'recusado', motivo: 'Valor diferente do PIX' },
    {
      id: confirmado.id,
      situacao: 'confirmado',
      valorEmCentavos: 6000,
      valorConfirmadoEmCentavos: 5000,
    },
  ]);
  expect(
    (await fetch(`${url}/comprovante/${confirmado.comprovanteId}`, { headers: gestor })).status,
  ).toBe(200);

  const doTipo = (type: string) => publicados.filter((e) => e.type === type);
  expect(await eventually(async () => doTipo('finance.receipt-rejected').length > 0)).toBe(true);
  await sleep(1000);
  const pagamentos = doTipo('finance.payment-received');
  expect(pagamentos).toHaveLength(extra ? 2 : 1);
  expect(pagamentos[0]).toMatchObject({
    payload: { participantId: participante, amountInCents: 5000 },
  });
  // Edição and cancelamento publish nothing; the repeated envio was not saved.
  expect(doTipo('finance.receipt-sent').map((e) => e.payload)).toEqual(
    [confirmado, recusado, cancelado, disputado].map(({ id }, i) => ({
      receiptId: id,
      participantId: participante,
      amountInCents: [9000, 3000, 1000, 1000][i],
    })),
  );
  expect(doTipo('finance.receipt-rejected').map((e) => e.payload)).toEqual([
    {
      receiptId: recusado.id,
      participantId: participante,
      amountInCents: 3000,
      reason: 'Valor diferente do PIX',
    },
    ...(extra
      ? []
      : [
          {
            receiptId: disputado.id,
            participantId: participante,
            amountInCents: 1000,
            reason: 'Repetido',
          },
        ]),
  ]);
});

it('keeps a comprovante enviado to an arquivo no pagamento used and to the version the gestor saw', async () => {
  const participante = randomUUID();
  publicar(entrou(participante));
  expect(await eventually(async () => (await repository.buscar(participante)) !== undefined)).toBe(
    true,
  );
  const doParticipante = { 'x-user-id': participante };
  const gestor = { 'x-user-id': randomUUID(), 'x-user-roles': 'gestor' };
  const url = `http://localhost:${running.port}`;
  const guardar = async (headers: Record<string, string>) => {
    const form = new FormData();
    form.append('participanteId', participante);
    form.append('arquivo', new Blob([new TextEncoder().encode('%PDF-1.7 pix')]), 'pix.pdf');
    const guardado = await fetch(`${url}/guardar-comprovante`, {
      method: 'POST',
      headers,
      body: form,
    });
    return ((await guardado.json()) as { id: string }).id;
  };
  const comandar = (caminho: string, headers: Record<string, string>, body: unknown) =>
    fetch(`${url}${caminho}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  // An arquivo the gestor already received a pagamento with is not sent again.
  const recebido = await guardar(gestor);
  const pagamento = await comandar('/receber-pagamento', gestor, {
    participanteId: participante,
    valorEmCentavos: 3000,
    forma: 'pix',
    comprovanteId: recebido,
  });
  expect(pagamento.status).toBe(204);
  const reenviado = await comandar('/enviar-comprovante', doParticipante, {
    valorEmCentavos: 3000,
    comprovanteId: recebido,
  });
  expect(reenviado.status).toBe(409);
  expect(await reenviado.json()).toEqual({ error: 'comprovante-ja-usado' });
  const enviado = await comandar('/enviar-comprovante', doParticipante, {
    valorEmCentavos: 3000,
    comprovanteId: await guardar(doParticipante),
  });
  const { id } = (await enviado.json()) as { id: string };
  const editar = (comprovanteId: string) =>
    comandar(`/comprovante-enviado/${id}/editar`, doParticipante, {
      valorEmCentavos: 3000,
      comprovanteId,
    });
  const trocado = await editar(recebido);
  expect(trocado.status).toBe(409);
  expect(await trocado.json()).toEqual({ error: 'comprovante-ja-usado' });

  // An edição saved while the gestor confirms: the confirmação changes nothing.
  const comprovantes = comprovanteEnviadoRepository(database.db);
  const lido = await comprovantes.buscar(id);
  if (!lido) throw new Error('comprovante enviado not saved');
  expect((await editar(await guardar(doParticipante))).status).toBe(204);
  const confirmado = confirmar(
    { perfis: ['gestor'] },
    lido,
    { valorConfirmadoEmCentavos: 3000, comprovanteId: lido.comprovanteId },
    { pagamentoId: randomUUID(), eventId: randomUUID(), agora: new Date() },
  );
  if (!confirmado.ok) throw new Error(confirmado.error);
  const { comprovante, pagamento: novo, evento } = confirmado.value;
  expect(await comprovantes.confirmar(comprovante, novo, [evento])).toEqual({
    ok: false,
    error: 'comprovante-alterado',
  });
  expect(await comprovantes.buscar(id)).toMatchObject({ situacao: 'a-confirmar' });

  // A confirmado has the valor confirmado and a recusado the motivo, or the row is not saved.
  for (const situacao of ['confirmado', 'recusado'] as const) {
    await expect(
      database.db.insert(comprovantesEnviados).values({
        id: randomUUID(),
        participanteId: participante,
        comprovanteId: randomUUID(),
        valorEmCentavos: 3000,
        enviadoEm: new Date(),
        situacao,
      }),
    ).rejects.toThrow();
  }
});
