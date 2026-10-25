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
    health: async () => ({ database: true, rabbitmq: true }),
    logger: createLogger('test', () => {}),
    ...deps,
  });

describe('POST /entrada', () => {
  const post = (headers: Record<string, string>, body: unknown) =>
    app().request('/entrada', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  it('204 and enters the logged-in person with the chosen tipo de cota', async () => {
    pedidos.length = 0;
    expect((await post({ 'x-user-id': novo }, { tipoDeCota: 'so-cafe' })).status).toBe(204);
    expect(pedidos).toEqual([{ id: novo, tipoDeCota: 'so-cafe' }]);
  });

  it('409 when already participando', async () => {
    const response = await post({ 'x-user-id': participando }, { tipoDeCota: 'completa' });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'ja-participando' });
  });

  it('400 for a missing or unknown tipo de cota, or a body that is not json', async () => {
    for (const body of [{}, { tipoDeCota: 'cha' }, 'nope']) {
      const response = await post({ 'x-user-id': novo }, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'tipo-de-cota-invalido' });
    }
  });

  it('401 without the gateway identity or with an id that is not a uuid', async () => {
    expect((await post({}, { tipoDeCota: 'completa' })).status).toBe(401);
    expect((await post({ 'x-user-id': 'user-1' }, { tipoDeCota: 'completa' })).status).toBe(401);
  });
});

describe('GET /health', () => {
  it('200 when every dependency is healthy and 503 otherwise', async () => {
    expect((await app().request('/health')).status).toBe(200);
    const unhealthy = app({ health: async () => ({ database: true, rabbitmq: false }) });
    expect((await unhealthy.request('/health')).status).toBe(503);
  });
});
