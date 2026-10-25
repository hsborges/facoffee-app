import { describe, expect, it } from 'vitest';
import { fail, ok } from '../domain/result.js';
import { createLogger } from '../infra/logger.js';
import { type ApiDependencies, createApp } from './app.js';

const desativado = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const ativo = '11111111-1111-4111-8111-111111111111';

const app = (deps: Partial<ApiDependencies> = {}) =>
  createApp({
    desativar: async (solicitante, usuarioId) =>
      solicitante.id === usuarioId || solicitante.perfis.includes('gestor')
        ? ok(undefined)
        : fail('sem-permissao'),
    estaDesativado: async (id) => id === desativado,
    health: async () => ({ database: true, rabbitmq: true }),
    logger: createLogger('test', () => {}),
    ...deps,
  });

describe('GET /eu', () => {
  it('the logged usuário from the gateway headers', async () => {
    const response = await app().request('/eu', {
      headers: {
        'x-user-id': 'user-1',
        'x-user-roles': 'default-roles-facoffee,gestor,participante',
        'x-user-name': 'Jo%C3%A3o%20Caf%C3%A9',
        'x-user-email': 'joao%40ufms.br',
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'user-1',
      nome: 'João Café',
      email: 'joao@ufms.br',
      perfis: ['gestor', 'participante'],
    });
  });

  it('empty fields when the gateway sends them empty', async () => {
    const response = await app().request('/eu', {
      headers: { 'x-user-id': 'user-1', 'x-user-roles': '', 'x-user-name': '', 'x-user-email': '' },
    });
    expect(await response.json()).toEqual({ id: 'user-1', nome: '', email: '', perfis: [] });
  });

  it('401 without the gateway identity', async () => {
    expect((await app().request('/eu')).status).toBe(401);
  });
});

describe('POST /:id/desativacao', () => {
  const post = (id: string, headers: Record<string, string>) =>
    app().request(`/${id}/desativacao`, { method: 'POST', headers });

  it('204 when the gestor deactivates someone else', async () => {
    expect((await post(ativo, { 'x-user-id': 'gestor-1', 'x-user-roles': 'gestor' })).status).toBe(
      204,
    );
  });

  it('204 when the usuário deactivates their own access', async () => {
    expect((await post(ativo, { 'x-user-id': ativo, 'x-user-roles': 'participante' })).status).toBe(
      204,
    );
  });

  it('403 when someone who is not gestor deactivates someone else', async () => {
    const response = await post(ativo, { 'x-user-id': 'user-2', 'x-user-roles': 'participante' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'sem-permissao' });
  });

  it('404 for an invalid id and 401 without the gateway identity', async () => {
    expect((await post('abc', { 'x-user-id': 'gestor-1', 'x-user-roles': 'gestor' })).status).toBe(
      404,
    );
    expect((await post(ativo, {})).status).toBe(401);
  });
});

// Called by the gateway ForwardAuth before every request (ADR 0009).
describe('GET /acesso', () => {
  it('204 for an active usuário and 403 for a deactivated one', async () => {
    expect((await app().request('/acesso', { headers: { 'x-user-id': ativo } })).status).toBe(204);
    expect((await app().request('/acesso', { headers: { 'x-user-id': desativado } })).status).toBe(
      403,
    );
  });

  it('401 without the gateway identity', async () => {
    expect((await app().request('/acesso')).status).toBe(401);
  });
});

describe('GET /health', () => {
  it('200 when every dependency is healthy and 503 otherwise', async () => {
    expect((await app().request('/health')).status).toBe(200);
    const unhealthy = app({ health: async () => ({ database: true, rabbitmq: false }) });
    expect((await unhealthy.request('/health')).status).toBe(503);
  });
});
