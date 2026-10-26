import { describe, expect, it } from 'vitest';
import { createLogger } from '../infra/logger.js';
import { type ApiDependencies, createApp } from './app.js';

const app = (deps: Partial<ApiDependencies> = {}) =>
  createApp({
    health: async () => ({ database: true, rabbitmq: true }),
    lembrarPendentes: async () => ({ lembretes: 2 }),
    logger: createLogger('test', () => {}),
    ...deps,
  });

describe('POST /lembrar-pendentes', () => {
  it('runs the agendador trigger and answers how many lembretes were registered', async () => {
    const response = await app().request('/lembrar-pendentes', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ lembretes: 2 });
  });

  it('500 when Financeiro or Usuário fails, so the agendador logs it and retries later', async () => {
    const response = await app({
      lembrarPendentes: async () => {
        throw new Error('financeiro fora do ar');
      },
    }).request('/lembrar-pendentes', { method: 'POST' });
    expect(response.status).toBe(500);
  });
});

describe('GET /health', () => {
  it('200 when every dependency is healthy', async () => {
    const response = await app().request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      dependencies: { database: true, rabbitmq: true },
    });
  });

  it('503 when a dependency fails', async () => {
    const response = await app({
      health: async () => ({ database: true, rabbitmq: false }),
    }).request('/health');
    expect(response.status).toBe(503);
  });
});
