import { describe, expect, it } from 'vitest';
import { fail, ok } from '../domain/result.js';
import { createLogger } from '../infra/logger.js';
import { type ApiDependencies, createApp } from './app.js';

const participando = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const novo = '11111111-1111-4111-8111-111111111111';

const pedidos: unknown[] = [];

const app = (deps: Partial<ApiDependencies> = {}) =>
  createApp({
    pedirEntrada: async (id, tipoDeCota) => {
      pedidos.push({ id, tipoDeCota });
      return id === participando ? fail('ja-participando') : ok(undefined);
    },
    trocarTipo: async (id, tipoDeCota) => {
      pedidos.push({ id, tipoDeCota });
      return id === participando ? ok(undefined) : fail('nao-participando');
    },
    pedirSaida: async (id) => {
      pedidos.push({ id });
      return id === participando ? ok(undefined) : fail('nao-participando');
    },
    definirValor: async (solicitante, valor) => {
      pedidos.push({ solicitante, valor });
      if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
      if (valor.ano < 2026) return fail('ano-passado');
      return valor.valorEmCentavos === 9999 ? fail('valor-ja-definido') : ok(undefined);
    },
    consultarParticipante: async (id) =>
      id === participando
        ? ok({ id, tipoDeCota: 'so-cafe', participando: true, troca: null })
        : fail('participante-nao-encontrado'),
    iniciarAno: async () => ({ valoresRepetidos: 1 }),
    iniciarMes: async () => ({ cotasDevidas: 2, semValorDaCota: 0 }),
    health: async () => ({ database: true, rabbitmq: true }),
    logger: createLogger('test', () => {}),
    ...deps,
  });

const post = (path: string, headers: Record<string, string>, body?: unknown) =>
  app().request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('POST /entrar', () => {
  it('204 and enters the logged-in person with the chosen tipo de cota', async () => {
    pedidos.length = 0;
    expect((await post('/entrar', { 'x-user-id': novo }, { tipoDeCota: 'so-cafe' })).status).toBe(
      204,
    );
    expect(pedidos).toEqual([{ id: novo, tipoDeCota: 'so-cafe' }]);
  });

  it('409 when already participando', async () => {
    const response = await post(
      '/entrar',
      { 'x-user-id': participando },
      { tipoDeCota: 'completa' },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'ja-participando' });
  });

  it('400 for a missing or unknown tipo de cota, or a body that is not json', async () => {
    for (const body of [{}, { tipoDeCota: 'cha' }, 'nope']) {
      const response = await post('/entrar', { 'x-user-id': novo }, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'tipo-de-cota-invalido' });
    }
  });
});

describe('POST /trocar-tipo-de-cota', () => {
  it('204 and trocas the tipo de cota of the logged-in person', async () => {
    pedidos.length = 0;
    const response = await post(
      '/trocar-tipo-de-cota',
      { 'x-user-id': participando },
      { tipoDeCota: 'completa' },
    );
    expect(response.status).toBe(204);
    expect(pedidos).toEqual([{ id: participando, tipoDeCota: 'completa' }]);
  });

  it('409 when not participando and 400 for an unknown tipo de cota', async () => {
    const naoParticipa = await post(
      '/trocar-tipo-de-cota',
      { 'x-user-id': novo },
      { tipoDeCota: 'completa' },
    );
    expect(naoParticipa.status).toBe(409);
    expect(await naoParticipa.json()).toEqual({ error: 'nao-participando' });
    const invalido = await post('/trocar-tipo-de-cota', { 'x-user-id': novo }, { tipoDeCota: 1 });
    expect(invalido.status).toBe(400);
  });
});

describe('POST /sair', () => {
  it('204 when the logged-in person leaves, 409 when not participando', async () => {
    expect((await post('/sair', { 'x-user-id': participando })).status).toBe(204);
    const response = await post('/sair', { 'x-user-id': novo });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'nao-participando' });
  });
});

describe('GET /participante/eu', () => {
  it('200 with the participação of the logged-in person', async () => {
    const response = await app().request('/participante/eu', {
      headers: { 'x-user-id': participando },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: participando,
      tipoDeCota: 'so-cafe',
      participando: true,
      troca: null,
    });
  });

  it('404 for someone who never participated and 401 without the gateway identity', async () => {
    const response = await app().request('/participante/eu', { headers: { 'x-user-id': novo } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'participante-nao-encontrado' });
    expect((await app().request('/participante/eu')).status).toBe(401);
  });
});

describe('POST /definir-valor-da-cota', () => {
  const valor = { tipoDeCota: 'completa', ano: 2027, valorEmCentavos: 3000 };
  const gestor = { 'x-user-id': novo, 'x-user-roles': 'default-roles-facoffee,gestor' };

  it('204 and passes the roles of the logged-in person along with the valor', async () => {
    pedidos.length = 0;
    expect((await post('/definir-valor-da-cota', gestor, valor)).status).toBe(204);
    expect(pedidos).toEqual([
      { solicitante: { perfis: ['default-roles-facoffee', 'gestor'] }, valor },
    ]);
  });

  it.each([
    [
      '403 for a participante who is not the gestor',
      { 'x-user-id': novo },
      valor,
      403,
      'sem-permissao',
    ],
    [
      '409 when already defined',
      gestor,
      { ...valor, valorEmCentavos: 9999 },
      409,
      'valor-ja-definido',
    ],
    ['400 for a past year', gestor, { ...valor, ano: 2025 }, 400, 'ano-passado'],
  ])('%s', async (_case, headers, body, status, error) => {
    const response = await post('/definir-valor-da-cota', headers, body);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it('400 for an unknown tipo de cota or a valor or year that is not a positive integer', async () => {
    for (const body of [
      { ...valor, tipoDeCota: 'cha' },
      { ...valor, valorEmCentavos: 0 },
      { ...valor, valorEmCentavos: 25.5 },
      { ...valor, valorEmCentavos: '2500' },
      { ...valor, valorEmCentavos: 2 ** 31 },
      { ...valor, ano: undefined },
      'nope',
    ]) {
      const response = await post('/definir-valor-da-cota', gestor, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'pedido-invalido' });
    }
  });
});

describe('gatilhos do agendador', () => {
  it('POST /iniciar-ano and POST /iniciar-mes run without identity and answer what they did', async () => {
    const ano = await post('/iniciar-ano', {});
    expect(ano.status).toBe(200);
    expect(await ano.json()).toEqual({ valoresRepetidos: 1 });

    const mes = await post('/iniciar-mes', {});
    expect(mes.status).toBe(200);
    expect(await mes.json()).toEqual({ cotasDevidas: 2, semValorDaCota: 0 });
  });

  // The gateway blocks only the exact paths, so variants must not reach the triggers either.
  it.each(['/iniciar-mes/', '/INICIAR-MES', '/iniciar-ano/'])('404 on %s', async (path) => {
    expect((await post(path, {})).status).toBe(404);
  });
});

describe('identity', () => {
  it.each(['/entrar', '/trocar-tipo-de-cota', '/sair', '/definir-valor-da-cota'])(
    '401 on %s without the gateway identity or with an id that is not a uuid',
    async (path) => {
      expect((await post(path, {}, { tipoDeCota: 'completa' })).status).toBe(401);
      expect((await post(path, { 'x-user-id': 'user-1' }, { tipoDeCota: 'completa' })).status).toBe(
        401,
      );
    },
  );

  it.each(['/entrada', '/troca-cota', '/saida', '/valor-da-cota'])(
    '404 on the old path %s',
    async (path) => {
      expect((await post(path, { 'x-user-id': novo }, { tipoDeCota: 'completa' })).status).toBe(
        404,
      );
    },
  );
});

describe('GET /health', () => {
  it('200 when every dependency is healthy and 503 otherwise', async () => {
    expect((await app().request('/health')).status).toBe(200);
    const unhealthy = app({ health: async () => ({ database: true, rabbitmq: false }) });
    expect((await unhealthy.request('/health')).status).toBe(503);
  });
});
