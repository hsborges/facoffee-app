import { afterEach, describe, expect, it, vi } from 'vitest';
import { obterUsuarioLogado } from './api';

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
