import { describe, expect, it } from 'vitest';
import { app } from './app.js';

describe('GET /eu', () => {
  it('the logged usuário from the gateway headers', async () => {
    const response = await app.request('/eu', {
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
    const response = await app.request('/eu', {
      headers: { 'x-user-id': 'user-1', 'x-user-roles': '', 'x-user-name': '', 'x-user-email': '' },
    });
    expect(await response.json()).toEqual({ id: 'user-1', nome: '', email: '', perfis: [] });
  });

  it('401 without the gateway identity', async () => {
    expect((await app.request('/eu')).status).toBe(401);
  });
});

describe('GET /health', () => {
  it('200', async () => {
    expect((await app.request('/health')).status).toBe(200);
  });
});
