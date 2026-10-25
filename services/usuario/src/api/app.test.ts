import { describe, expect, it } from 'vitest';
import { fail, ok } from '../domain/result.js';
import { createLogger } from '../infra/logger.js';
import { type ApiDependencies, createApp } from './app.js';

const desativado = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const ativo = '11111111-1111-4111-8111-111111111111';

const registrados: unknown[] = [];

const app = (deps: Partial<ApiDependencies> = {}) =>
  createApp({
    desativar: async (solicitante, usuarioId) =>
      solicitante.id === usuarioId || solicitante.perfis.includes('gestor')
        ? ok(undefined)
        : fail('sem-permissao'),
    registrarAcesso: async (usuario) => {
      registrados.push(usuario);
      return usuario.id === desativado ? 'desativado' : 'ativo';
    },
    listar: async (solicitante) =>
      solicitante.perfis.includes('gestor')
        ? ok([{ id: ativo, nome: 'João', email: 'joao@ufms.br', desativado: false }])
        : fail('sem-permissao'),
    contato: async (id) =>
      id === ativo ? { id: ativo, nome: 'João', email: 'joao@ufms.br' } : undefined,
    reativar: async (solicitante) =>
      solicitante.perfis.includes('gestor') ? ok(undefined) : fail('sem-permissao'),
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

describe('POST /:id/desativar', () => {
  const post = (id: string, headers: Record<string, string>) =>
    app().request(`/${id}/desativar`, { method: 'POST', headers });

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

// Called by the gateway ForwardAuth before every request (ADR 0011).
describe('GET /acesso', () => {
  it('204 for an active usuário and 403 for a deactivated one', async () => {
    expect((await app().request('/acesso', { headers: { 'x-user-id': ativo } })).status).toBe(204);
    expect((await app().request('/acesso', { headers: { 'x-user-id': desativado } })).status).toBe(
      403,
    );
  });

  it('registers the usuário with the nome and email from the gateway headers', async () => {
    registrados.length = 0;
    await app().request('/acesso', {
      headers: { 'x-user-id': ativo, 'x-user-name': 'Jo%C3%A3o', 'x-user-email': 'joao%40ufms.br' },
    });
    expect(registrados).toMatchObject([{ id: ativo, nome: 'João', email: 'joao@ufms.br' }]);
  });

  it('204 without registering for an id that is not a uuid', async () => {
    registrados.length = 0;
    expect((await app().request('/acesso', { headers: { 'x-user-id': 'user-1' } })).status).toBe(
      204,
    );
    expect(registrados).toEqual([]);
  });

  it('401 without the gateway identity', async () => {
    expect((await app().request('/acesso')).status).toBe(401);
  });
});

describe('GET /', () => {
  it('the usuários for the gestor', async () => {
    const response = await app().request('/', {
      headers: { 'x-user-id': 'gestor-1', 'x-user-roles': 'gestor' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: ativo, nome: 'João', email: 'joao@ufms.br', desativado: false },
    ]);
  });

  it('403 for someone who is not gestor and 401 without the gateway identity', async () => {
    const response = await app().request('/', {
      headers: { 'x-user-id': 'user-2', 'x-user-roles': 'participante' },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'sem-permissao' });
    expect((await app().request('/')).status).toBe(401);
  });
});

describe('GET /contato/:id', () => {
  it('nome and e-mail of one usuário, without identity: internal to Notificação', async () => {
    const response = await app().request(`/contato/${ativo}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: ativo, nome: 'João', email: 'joao@ufms.br' });
  });

  it('404 for an unknown usuário or an id that is not a uuid', async () => {
    expect((await app().request(`/contato/${desativado}`)).status).toBe(404);
    expect((await app().request('/contato/abc')).status).toBe(404);
  });

  it('404 for a request through the gateway, which always sends X-User-Id', async () => {
    const response = await app().request(`/contato/${ativo}`, {
      headers: { 'x-user-id': 'gestor-1', 'x-user-roles': 'gestor' },
    });
    expect(response.status).toBe(404);
  });
});

describe('POST /:id/reativar', () => {
  const post = (id: string, headers: Record<string, string>) =>
    app().request(`/${id}/reativar`, { method: 'POST', headers });

  it('204 when the gestor reactivates an access', async () => {
    const gestor = { 'x-user-id': 'gestor-1', 'x-user-roles': 'gestor' };
    expect((await post(desativado, gestor)).status).toBe(204);
  });

  it('403 when someone who is not gestor reactivates', async () => {
    const response = await post(desativado, {
      'x-user-id': 'user-2',
      'x-user-roles': 'participante',
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'sem-permissao' });
  });

  it('404 for an invalid id and 401 without the gateway identity', async () => {
    expect((await post('abc', { 'x-user-id': 'gestor-1', 'x-user-roles': 'gestor' })).status).toBe(
      404,
    );
    expect((await post(desativado, {})).status).toBe(401);
  });
});

it.each(['desativacao', 'reativacao'])('404 on the old path POST /:id/%s', async (path) => {
  const headers = { 'x-user-id': 'gestor-1', 'x-user-roles': 'gestor' };
  expect((await app().request(`/${ativo}/${path}`, { method: 'POST', headers })).status).toBe(404);
});

describe('GET /health', () => {
  it('200 when every dependency is healthy and 503 otherwise', async () => {
    expect((await app().request('/health')).status).toBe(200);
    const unhealthy = app({ health: async () => ({ database: true, rabbitmq: false }) });
    expect((await unhealthy.request('/health')).status).toBe(503);
  });
});
