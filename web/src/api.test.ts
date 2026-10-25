import { afterEach, describe, expect, it, vi } from 'vitest';
import { comandar, ler, obterUsuarioLogado } from './api';

const usuario = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'João',
  email: 'joao@ufms.br',
  perfis: ['participante'],
};

const responde = (resposta: () => Promise<Response>) => {
  const fetch = vi.fn(resposta);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('obterUsuarioLogado', () => {
  it('asks the gateway with the access token', async () => {
    const fetch = responde(async () => Response.json(usuario));

    expect(await obterUsuarioLogado('token')).toEqual({ situacao: 'ativo', usuario });
    const [caminho, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(caminho).toBe('/api/usuario/eu');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
  });

  it('a deactivated access gets 403 from the gateway', async () => {
    responde(async () => Response.json({ error: 'acesso-desativado' }, { status: 403 }));
    expect(await obterUsuarioLogado('token')).toEqual({ situacao: 'desativado' });
  });

  it('any other failure, network included, is an error', async () => {
    responde(async () => Response.json({ error: 'internal-error' }, { status: 500 }));
    expect(await obterUsuarioLogado('token')).toEqual({ situacao: 'erro' });

    responde(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await obterUsuarioLogado('token')).toEqual({ situacao: 'erro' });
  });

  it('a 200 that is not JSON is an error', async () => {
    responde(async () => new Response('<!doctype html>', { status: 200 }));
    expect(await obterUsuarioLogado('token')).toEqual({ situacao: 'erro' });
  });
});

describe('ler', () => {
  it('reads a recurso with the access token', async () => {
    const fetch = responde(async () => Response.json({ saldoEmCentavos: 4500 }));

    expect(await ler('token', '/api/financeiro/caixinha')).toEqual({
      situacao: 'ok',
      valor: { saldoEmCentavos: 4500 },
    });
    const [caminho, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(caminho).toBe('/api/financeiro/caixinha');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
  });

  it('a 404 is a recurso not found, as for whoever never participated', async () => {
    responde(async () => Response.json({ error: 'participante-nao-encontrado' }, { status: 404 }));
    expect(await ler('token', '/api/financeiro/participante/eu')).toEqual({
      situacao: 'nao-encontrado',
    });
  });

  it('any other failure, network or a body that is not JSON included, is an error', async () => {
    for (const resposta of [
      async () => Response.json({ error: 'internal-error' }, { status: 500 }),
      async () => new Response('<!doctype html>', { status: 200 }),
      () => Promise.reject(new TypeError('Failed to fetch')),
    ]) {
      responde(resposta);
      expect(await ler('token', '/api/financeiro/caixinha')).toEqual({ situacao: 'erro' });
    }
  });
});

describe('comandar', () => {
  it('posts the comando as JSON with the access token', async () => {
    const fetch = responde(async () => new Response(null, { status: 204 }));

    expect(await comandar('token', '/api/participacao/entrar', { tipoDeCota: 'completa' })).toBe(
      true,
    );
    const [caminho, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(caminho).toBe('/api/participacao/entrar');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"tipoDeCota":"completa"}');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer token');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('posts without a body when the comando has none', async () => {
    const fetch = responde(async () => new Response(null, { status: 204 }));
    expect(await comandar('token', '/api/participacao/sair')).toBe(true);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('a refused comando or a network failure is not done', async () => {
    responde(async () => Response.json({ error: 'nao-participando' }, { status: 409 }));
    expect(await comandar('token', '/api/participacao/sair')).toBe(false);

    responde(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await comandar('token', '/api/participacao/sair')).toBe(false);
  });
});
